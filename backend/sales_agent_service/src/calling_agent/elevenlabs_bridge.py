"""
Bridge between ElevenLabs Conversational AI and the existing Groq/LangGraph sales agent.
"""

import json
import os
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import requests
from flask import Response, jsonify, request, stream_with_context
from groq import Groq

from sales_agent.single_agent_graph import create_sales_graph, SalesState
from utils.groq_chat import GroqChat
from utils.prompts import (
    GENERAL_SALES_AGENT,
    VOICE_SALES_AGENT,
    VOICE_SALES_AGENT_EXPRESSIVE,
    VOICE_SUPPORT_AGENT,
    VOICE_SUPPORT_AGENT_EXPRESSIVE,
    get_emotion_guidance,
)
from utils.example_company.example_customer import example_customer
from utils.example_company.products_data import Products_data
from calling_agent import demo_config, session_store, voice_tools
from calling_agent.public_url import resolve_public_url

ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"
_executor = ThreadPoolExecutor(max_workers=4)
_llm_request_count = 0
_last_llm_preview = ""

# LangGraph is the sales agent brain. Set VOICE_USE_LANGGRAPH=0 only to debug with a fast Groq-only path.
USE_LANGGRAPH = os.getenv("VOICE_USE_LANGGRAPH", "1").lower() not in ("0", "false", "no")

# fast       -> turbo_v2_5: strip bracket/paren tags (they would be read as text)
# expressive -> v3_conversational: KEEP [laughs]/[sighs]/[chuckles] so TTS performs them
VOICE_TTS_MODE = (os.getenv("VOICE_TTS_MODE") or "fast").lower()
EXPRESSIVE_MODE = VOICE_TTS_MODE == "expressive"

# Voice streaming uses sentence-by-sentence Groq output (no filler prefixes).
# Fillers caused double speech ("Sure thing, so... Yeah, totally...") and confused TTS.


def _opening_hook(cfg: demo_config.DemoConfig) -> str:
    """Spoken first line when the voice session starts."""
    if cfg.mode == "support":
        return (
            f"Hi, thanks for calling {cfg.company_name} support — this is {cfg.agent_name}. "
            f"What can I help you with today?"
        )
    product = cfg.product_name()
    return (
        f"Hey — it's {cfg.agent_name} from {cfg.company_name}. "
        f"I'll keep this quick — we help teams with {product}. "
        f"Got thirty seconds?"
    )


def _sync_elevenlabs_first_message(cfg: demo_config.DemoConfig) -> None:
    """Push opening hook to ElevenLabs so the first spoken line matches demo mode."""
    agent_id = os.getenv("ELEVENLABS_AGENT_ID")
    api_key = os.getenv("eleven_labs_key")
    if not agent_id or not api_key:
        return
    msg = _opening_hook(cfg)
    try:
        resp = requests.patch(
            f"{ELEVENLABS_API_BASE}/convai/agents/{agent_id}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={"conversation_config": {"agent": {"first_message": msg}}},
            timeout=15,
        )
        if resp.ok:
            print(f"[elevenlabs] first_message synced ({cfg.mode}): {msg[:80]}...")
        else:
            print(f"[elevenlabs] first_message sync HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[elevenlabs] first_message sync error: {e}")


# Strip anything that ElevenLabs TTS would mispronounce or read as a stage direction.
_QUOTE_RX = re.compile(r"^[\s\"'\u201c\u201d\u2018\u2019]+|[\s\"'\u201c\u201d\u2018\u2019]+$")
_BRACKET_TAG_RX = re.compile(r"\[[^\]]*\]")
_PAREN_DIRECTION_RX = re.compile(
    r"\((?:pause|laughs?|chuckles?|sighs?|smiles?|softly|warmly|whispers?|exhales?)[^)]*\)",
    re.IGNORECASE,
)
_MARKDOWN_RX = re.compile(r"(\*\*|__|\*|_|`)")


def _clean_voice_reply(text: str) -> str:
    """Strip anything TTS would mispronounce. In expressive mode we KEEP bracket
    tags like [laughs] so eleven_v3_conversational performs them as real sounds.
    Parenthetical stage directions are always stripped — they get read aloud."""
    if not text:
        return text
    if not EXPRESSIVE_MODE:
        text = _BRACKET_TAG_RX.sub("", text)
    text = _PAREN_DIRECTION_RX.sub("", text)
    text = _MARKDOWN_RX.sub("", text)
    text = _QUOTE_RX.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def _pick_voice_prompt_template(mode: str) -> str:
    """Pick the right voice prompt for current mode + expressive flag."""
    if mode == "support":
        return VOICE_SUPPORT_AGENT_EXPRESSIVE if EXPRESSIVE_MODE else VOICE_SUPPORT_AGENT
    return VOICE_SALES_AGENT_EXPRESSIVE if EXPRESSIVE_MODE else VOICE_SALES_AGENT


def _format_catalog(products: list | None) -> str:
    """One line per product with price — fed into the prompt so the agent can quote."""
    if not products:
        return "(no products configured — use list_products if asked)"
    lines = []
    for p in products[:25]:
        cur = p.get("currency", "USD")
        lines.append(f"- {p.get('name')}: {cur} {p.get('price')}")
    return "\n".join(lines)


def _profile_blob(session) -> str:
    p = session.company_profile or {}
    parts = [f"Company name: {session.company_name}"]
    if p.get("description"):
        parts.append(f"About: {p['description']}")
    if p.get("pitch_details"):
        parts.append(f"Sales details: {p['pitch_details']}")
    if p.get("website"):
        parts.append(f"Website: {p['website']}")
    return "\n".join(parts)


def _build_system_prompt(messages: list | None = None, session=None) -> str:
    """Build the system prompt.

    With a `session` (authenticated dashboard call) we inject that business's
    profile + live product catalog + the customer's detected emotion. Without one
    (anonymous /voice-demo) we fall back to the shared global demo_config.

    We use .replace() rather than .format() because company text may contain
    `{` characters that would break str.format.
    """
    if session is not None:
        template = _pick_voice_prompt_template(session.mode)
        base = (
            template
            .replace("{company_data}", _profile_blob(session)[:1400])
            .replace("{company_name}", session.company_name or "our company")
            .replace("{agent_name}", session.agent_name or "Alex")
            .replace("{product_catalog}", _format_catalog(session.products))
        )
        parts = [base, get_emotion_guidance(session.last_emotion)]
        if session.escalated or session.human_present:
            parts.append(
                "IMPORTANT: A human agent is joining this call. De-escalate, STOP selling, "
                "keep replies brief, and let the human take over."
            )
        parts.append("Current conversation phase:\n" + _conversation_phase_hint(messages or [], session.mode))
        return "\n\n".join(parts)

    cfg = demo_config.current()
    template = _pick_voice_prompt_template(cfg.mode)
    company_blob = cfg.system_company_blob()[:1200]
    demo_catalog = f"- {cfg.product_name()}: see pitch details above"
    base = (
        template
        .replace("{company_data}", company_blob)
        .replace("{company_name}", cfg.company_name)
        .replace("{agent_name}", cfg.agent_name)
        .replace("{product_catalog}", demo_catalog)
    )
    phase = _conversation_phase_hint(messages or [], cfg.mode)
    return f"{base}\n\nCurrent conversation phase:\n{phase}"


def _conversation_phase_hint(messages: list, mode: str) -> str:
    """Lightweight turn-aware guidance — replaces LangGraph stages during live voice."""
    convo = [m for m in _normalize_messages(messages) if m["role"] in ("user", "assistant")]
    user_turns = sum(1 for m in convo if m["role"] == "user")

    if mode == "support":
        if user_turns <= 1:
            return "Listen and clarify the issue. One warm acknowledgement + one question."
        if user_turns <= 3:
            return "Diagnose step-by-step. One fix or one question — never sell."
        return "Confirm resolution or offer escalation/callback. Stay helpful, stay on their issue."

    if user_turns == 0:
        return "They may not have spoken yet — if replying, use opening hook: pain + product + question."
    if user_turns == 1:
        return "Discovery — ask ONE question about their biggest pain, tie to product from company data."
    if user_turns <= 3:
        return "Pitch — one benefit matched to what THEY said, one proof point from company data, one question."
    if user_turns <= 5:
        return "Handle objection — empathize, reframe ONE benefit, suggest pilot or short follow-up."
    return "Close — one concrete next step (pilot, demo, email). Stay on YOUR product only."


def _normalize_messages(messages: list) -> list[dict]:
    out = []
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role not in ("user", "assistant", "system") or not content:
            continue
        if isinstance(content, list):
            text = " ".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            ).strip()
            if text:
                out.append({"role": role, "content": text})
        else:
            out.append({"role": role, "content": str(content)})
    return out


def _compact_company_data() -> dict:
    """Smaller company payload so LangGraph fits Groq token limits during live voice."""
    cfg = demo_config.current()
    return {
        "company_name": cfg.company_name,
        "summary": cfg.system_company_blob()[:1200],
        "mode": cfg.mode,
    }


def _compact_product() -> dict:
    """Product payload from live demo config (not hardcoded database)."""
    cfg = demo_config.current()
    info = cfg.product_info_dict()
    details = info.get("details") or ""
    features = []
    if details:
        for chunk in re.split(r"[.,;]", details):
            chunk = chunk.strip()
            if chunk and len(chunk) > 8:
                features.append(chunk[:120])
            if len(features) >= 4:
                break
    return {
        "name": info.get("name", cfg.company_name),
        "description": info.get("description", ""),
        "key_features": features or [details[:120]] if details else [],
        "details": details,
    }


def _trim_convo(messages: list, max_turns: int = 6) -> list[dict]:
    convo = [
        m for m in _normalize_messages(messages) if m["role"] in ("user", "assistant")
    ]
    return convo[-max_turns:]


def _generate_reply_langgraph(messages: list) -> str:
    convo = _trim_convo(messages)
    if not convo or convo[-1]["role"] != "user":
        cfg = demo_config.current()
        return f"Hello! This is {cfg.agent_name} from {cfg.company_name}. How can I help you today?"

    # 8b fits voice TPM limits; full 70b prompts exceed Groq on-demand caps.
    model = os.getenv("VOICE_LLM_MODEL", "llama-3.1-8b-instant")
    llm = GroqChat(model=model)
    llm.conversation_history = [
        {"role": m["role"], "content": m["content"]} for m in convo[:-1]
    ]

    state = SalesState(
        chat_history=list(convo),
        current_node="classifier",
        company_data=_compact_company_data(),
        customer_data={
            "customer_name": example_customer.get("customer_name", "Customer"),
            "customer_company": example_customer.get("customer_company", ""),
        },
        product_info=_compact_product(),
        conversation_ended=False,
        end_message={"Nothiong": "Nothing"},
    )
    graph = create_sales_graph(llm)
    final_state = graph.invoke(state)
    reply = final_state["chat_history"][-1]["content"]
    return (reply or "").strip()


def _generate_reply(messages: list) -> str:
    if not USE_LANGGRAPH:
        return _generate_reply_fast(messages)

    try:
        reply = _generate_reply_langgraph(messages)
        if reply:
            return reply
        print("[custom-llm] LangGraph returned empty — falling back to fast Groq")
    except Exception as e:
        print(f"[custom-llm] LangGraph error: {e} — falling back to fast Groq")

    return _generate_reply_fast(messages)


_groq_singleton: Groq | None = None


def _groq_client() -> Groq:
    # Reuse one client so the TLS/HTTP connection to Groq stays warm (cuts ~100-300ms per call).
    # max_retries=1 prevents the SDK from blocking 60+s on rate-limit retries;
    # timeout=12 allows enough headroom for tool-call flows (2 Groq round-trips + dispatch).
    # The filler text "Let me check that for you..." keeps VAPI from disconnecting.
    global _groq_singleton
    if _groq_singleton is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        _groq_singleton = Groq(api_key=api_key, max_retries=1, timeout=12)
    return _groq_singleton


def _generate_reply_fast(messages: list) -> str:
    """Single Groq call — fast enough for live voice (<8s)."""
    convo = [
        m for m in _normalize_messages(messages) if m["role"] in ("user", "assistant")
    ]
    if not convo or convo[-1]["role"] != "user":
        cfg = demo_config.current()
        return _opening_hook(cfg)

    model = os.getenv("VOICE_LLM_MODEL", "llama-3.1-8b-instant")
    groq_messages = [{"role": "system", "content": _build_system_prompt(messages)}]
    groq_messages.extend(convo)

    try:
        response = _groq_client().chat.completions.create(
            model=model,
            messages=groq_messages,
            temperature=0.5,
            max_tokens=120,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"[custom-llm] Groq fast-reply error: {e}")
        return "Sorry, I had a brief hiccup. Could you repeat that?"


def _opening_hook_session(session) -> str:
    if session.mode == "support":
        return (
            f"Hi, thanks for reaching {session.company_name} support — this is {session.agent_name}. "
            f"What can I help you with today?"
        )
    return (
        f"Hey — it's {session.agent_name} from {session.company_name}. "
        f"I'll keep this quick. Got thirty seconds?"
    )


def _generate_reply_session(messages: list, session) -> str:
    """Session-aware generation WITH tool calling (price/stock/order/escalate).

    One tool round-trip only when the model decides to use a tool, so ordinary
    chit-chat turns stay single-call and fast.
    """
    convo = _trim_convo(messages)
    if not convo or convo[-1]["role"] != "user":
        return _opening_hook_session(session)

    model = os.getenv("VOICE_LLM_MODEL", "llama-3.1-8b-instant")
    groq_messages = [{"role": "system", "content": _build_system_prompt(messages, session)}]
    groq_messages.extend(convo)

    tools = voice_tools.tool_schemas() if session.products else None
    client = _groq_client()

    kwargs = dict(model=model, messages=groq_messages, temperature=0.5, max_tokens=320)
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    resp = client.chat.completions.create(**kwargs)
    msg = resp.choices[0].message
    tool_calls = getattr(msg, "tool_calls", None)

    if tool_calls:
        groq_messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [voice_tools.serialize_tool_call(tc) for tc in tool_calls],
        })
        for tc in tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            result = voice_tools.dispatch(tc.function.name, args, session)
            groq_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })
        # Second pass: turn tool results into a natural spoken reply.
        resp2 = client.chat.completions.create(
            model=model, messages=groq_messages, temperature=0.6, max_tokens=200
        )
        return (resp2.choices[0].message.content or "").strip()

    return (msg.content or "").strip()


def _stream_session_tokens(messages: list, session):
    """Stream tokens for a session call WITH tool support, low latency.

    Ordinary turns stream straight from the first Groq call (first audio in
    ~1s). Only when the model actually emits a tool call do we buffer, run the
    tool, and stream the follow-up reply — so price/stock/order turns still work
    without slowing down normal conversation.
    """
    convo = _trim_convo(messages)

    model = os.getenv("VOICE_LLM_MODEL", "llama-3.1-8b-instant")
    groq_messages = [{"role": "system", "content": _build_system_prompt(messages, session)}]
    groq_messages.extend(convo)
    tools = voice_tools.tool_schemas() if session.products else None
    client = _groq_client()

    kwargs = dict(model=model, messages=groq_messages, temperature=0.5, max_tokens=150, stream=True)
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    try:
        stream = client.chat.completions.create(**kwargs)
        tool_calls: dict = {}      # index -> {id, name, args}
        content_text = ""
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if getattr(delta, "content", None):
                content_text += delta.content
                yield delta.content
            if getattr(delta, "tool_calls", None):
                for tc in delta.tool_calls:
                    slot = tool_calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function and tc.function.name:
                        slot["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        slot["args"] += tc.function.arguments

        # No tool call → we already streamed the whole reply.
        if not tool_calls:
            return

        # Yield filler text so VAPI has something to say while we run the tool
        # only if the LLM didn't already say anything.
        if not content_text:
            yield "Let me check that for you... "

        # Tool path: execute, then stream the natural-language follow-up.
        groq_messages.append({
            "role": "assistant",
            "content": content_text,
            "tool_calls": [
                {"id": s["id"], "type": "function",
                 "function": {"name": s["name"], "arguments": s["args"] or "{}"}}
                for s in tool_calls.values()
            ],
        })
        for s in tool_calls.values():
            try:
                args = json.loads(s["args"] or "{}")
            except Exception:
                args = {}
            result = voice_tools.dispatch(s["name"], args, session)
            groq_messages.append({"role": "tool", "tool_call_id": s["id"], "content": json.dumps(result)})

        stream2 = client.chat.completions.create(
            model=model, messages=groq_messages, temperature=0.6, max_tokens=200, stream=True
        )
        for chunk in stream2:
            if chunk.choices and getattr(chunk.choices[0].delta, "content", None):
                yield chunk.choices[0].delta.content
    except Exception as e:
        print(f"[custom-llm] Groq session-stream error: {e}")
        yield "Sorry, I had a brief hiccup. Could you repeat that?"


def _chunk_text(text: str):
    """Yield a string in small word-groups so SSE output still feels streamed."""
    words = text.split(" ")
    group = []
    for w in words:
        group.append(w)
        if len(group) >= 3:
            yield " ".join(group) + " "
            group = []
    if group:
        yield " ".join(group)


def _safe_answer(text: str | None) -> str:
    cleaned = _clean_voice_reply(str(text)) if text else ""
    if cleaned:
        return cleaned
    return "Sorry, could you repeat that? I want to make sure I understood you."


def _stream_groq_tokens(messages: list):
    """Yield text fragments from Groq streaming API."""
    convo = [
        m for m in _normalize_messages(messages) if m["role"] in ("user", "assistant")
    ]

    model = os.getenv("VOICE_LLM_MODEL", "llama-3.1-8b-instant")
    groq_messages = [{"role": "system", "content": _build_system_prompt(messages)}]
    groq_messages.extend(convo)

    try:
        stream = _groq_client().chat.completions.create(
            model=model,
            messages=groq_messages,
            temperature=0.5,
            max_tokens=120,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as e:
        print(f"[custom-llm] Groq stream error: {e}")
        yield "Sorry, I had a brief hiccup. Could you repeat that?"


# Sentence terminator (incl. "..." and trailing quotes/brackets) used to flush
# complete sentences to TTS as soon as they're ready.
_SENTENCE_END_RX = re.compile(r"[^.!?]*[.!?]+[\"')\]\u201d\u2019]*\s*")


def _iter_voice_sentences(messages: list):
    """Stream Groq tokens but yield CLEANED sentences the moment each completes.

    This is the key latency win: ElevenLabs starts speaking sentence #1 while
    sentence #2 is still being generated, instead of waiting for the whole reply.
    """
    buf = ""
    emitted_any = False
    for delta in _stream_groq_tokens(messages):
        buf += delta
        # Flush every complete sentence currently sitting in the buffer.
        while True:
            m = _SENTENCE_END_RX.match(buf)
            if not m or m.end() == 0:
                break
            # If the terminator run sits exactly at the buffer edge, wait for the
            # next token — it may be a longer run like "..." split across tokens.
            if m.end() == len(buf):
                break
            sentence = buf[: m.end()]
            buf = buf[m.end():]
            cleaned = _clean_voice_reply(sentence)
            if cleaned:
                emitted_any = True
                yield cleaned + " "
    # Flush whatever is left (a final sentence with no terminator).
    cleaned = _clean_voice_reply(buf)
    if cleaned:
        emitted_any = True
        yield cleaned
    if not emitted_any:
        yield _safe_answer(None)


def _sse_chunk(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def register_elevenlabs_routes(app):
    @app.before_request
    def _log_voice_requests():
        if request.path.startswith("/v1") or "chat/completions" in request.path:
            print(f"[voice-http] {request.method} {request.path} from={request.remote_addr}")

    # VAPI custom-llm behaviour differs by version: some POST to the exact `model.url`,
    # others append `/chat/completions` to it. Register every variant so the LLM is
    # reachable no matter how the provider constructs the path.
    @app.route("/v1/chat/completions", methods=["POST", "OPTIONS"])
    @app.route("/chat/completions", methods=["POST", "OPTIONS"])
    @app.route("/v1/chat/completions/chat/completions", methods=["POST", "OPTIONS"])
    @app.route("/v1", methods=["POST", "OPTIONS"])
    def chat_completions():
        if request.method == "OPTIONS":
            resp = Response("", status=204)
            resp.headers["Access-Control-Allow-Origin"] = "*"
            resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return resp

        body = request.get_json(force=True, silent=True) or {}
        messages = body.get("messages", []) or []
        model = body.get("model") or "sales-agent"
        # Authenticated dashboard calls pass ?session_id=... (set in the VAPI
        # assistant's model.url). When present we use the per-business session +
        # tool calling; otherwise we fall back to the global demo path.
        session_id = request.args.get("session_id")
        # Guard against providers that append to the path (e.g. ".../?session_id=X/chat/completions").
        if session_id:
            session_id = session_id.split("/")[0].strip()
        session = session_store.get_session(session_id) if session_id else None
        # ElevenLabs may omit stream; default True for voice latency.
        stream = body.get("stream", True)
        if isinstance(stream, str):
            stream = stream.lower() not in ("0", "false", "no")
        else:
            stream = bool(stream)

        created = int(time.time())
        completion_id = "chatcmpl-" + uuid.uuid4().hex[:24]

        global _llm_request_count, _last_llm_preview
        _llm_request_count += 1
        print(
            f"[custom-llm] #{_llm_request_count} stream={stream} msgs={len(messages)} "
            f"langgraph={USE_LANGGRAPH} last={messages[-1].get('role') if messages else '-'}"
        )

        if not stream:
            try:
                if session is not None:
                    gen = lambda: _generate_reply_session(messages, session)
                else:
                    gen = lambda: _generate_reply(messages)
                answer = _safe_answer(_executor.submit(gen).result(timeout=120))
            except Exception as e:
                print(f"[custom-llm] error: {e}")
                answer = "Sorry, could you repeat that?"
            return jsonify(
                {
                    "id": completion_id,
                    "object": "chat.completion",
                    "created": created,
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": answer},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                }
            )

        def _delta_source():
            """Token source for SSE. Both paths stream tokens immediately for low
            latency; the session path also supports tools (price/stock/order)."""
            if session is not None:
                for delta in _stream_session_tokens(messages, session):
                    yield delta
            else:
                for delta in _stream_groq_tokens(messages):
                    yield delta

        def event_stream():
            try:
                # Stream token deltas immediately — sentence buffering delayed first byte
                # and caused VAPI to sit on "listening" until timeout.
                preview_parts = []
                for delta in _delta_source():
                    preview_parts.append(delta)
                    yield _sse_chunk(
                        {
                            "id": completion_id,
                            "object": "chat.completion.chunk",
                            "created": created,
                            "model": model,
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {"content": delta},
                                    "finish_reason": None,
                                }
                            ],
                        }
                    )
                if not preview_parts:
                    fallback = _safe_answer(None)
                    yield _sse_chunk(
                        {
                            "id": completion_id,
                            "object": "chat.completion.chunk",
                            "created": created,
                            "model": model,
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {"content": fallback},
                                    "finish_reason": None,
                                }
                            ],
                        }
                    )
                    preview_parts.append(fallback)
                _last_llm_preview = "".join(preview_parts)[:120]
            except Exception as e:
                print(f"[custom-llm] stream error: {e}")
                yield _sse_chunk(
                    {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {
                                    "content": "Sorry, I lost my train of thought. Could you say that again?"
                                },
                                "finish_reason": None,
                            }
                        ],
                    }
                )

            yield _sse_chunk(
                {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model,
                    "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                }
            )
            yield "data: [DONE]\n\n"

        response = Response(
            stream_with_context(event_stream()),
            mimetype="text/event-stream",
        )
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Connection"] = "keep-alive"
        response.headers["X-Accel-Buffering"] = "no"
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response

    @app.route("/demo/config", methods=["GET", "POST", "OPTIONS"])
    def demo_config_endpoint():
        """Read or update the per-demo agent config (mode + company data)."""
        if request.method == "OPTIONS":
            resp = Response("", status=204)
            resp.headers["Access-Control-Allow-Origin"] = "*"
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
            return resp

        if request.method == "POST":
            body = request.get_json(force=True, silent=True) or {}
            preset = str(body.get("preset") or "").lower()
            if preset in ("techcare", "pretrained", "pre-trained", "default"):
                # Pre-trained demo: use the company/product data already in the repo.
                cfg = demo_config.apply_preset_techcare(body.get("mode") or "sales")
                print(f"[demo-config] preset=techcare mode={cfg.mode}")
            else:
                cfg = demo_config.update(body)
                print(f"[demo-config] updated: mode={cfg.mode} company={cfg.company_name!r} agent={cfg.agent_name!r}")
            _sync_elevenlabs_first_message(cfg)
        else:
            cfg = demo_config.current()

        resp = jsonify(cfg.to_dict())
        resp.headers["Access-Control-Allow-Origin"] = "*"
        return resp

    @app.route("/health/voice", methods=["GET"])
    def health_voice():
        """Quick stack check for the voice demo.

        Pass ?lite=1 during an active call — returns llm stats only and does NOT
        hit ngrok or ElevenLabs (polling /health/voice every second was minting new
        signed URLs and killing the live WebSocket session).
        """
        agent_id = os.getenv("ELEVENLABS_AGENT_ID")
        public_url = resolve_public_url()
        cfg = demo_config.current()
        lite = request.args.get("lite") in ("1", "true", "yes")

        ngrok_ok = bool(public_url) if lite else False
        ngrok_detail = "skipped (lite poll)" if lite else "not tested"
        if not lite and public_url:
            try:
                r = requests.get(
                    f"{public_url}/health/voice?lite=1",
                    headers={"ngrok-skip-browser-warning": "1"},
                    timeout=10,
                )
                ngrok_ok = r.ok
                ngrok_detail = f"HTTP {r.status_code}"
            except Exception as e:
                ngrok_detail = str(e)

        return jsonify(
            {
                "ok": bool(agent_id and os.getenv("eleven_labs_key") and os.getenv("GROQ_API_KEY")),
                "langgraph": USE_LANGGRAPH,
                "voice_mode": "langgraph+fallback" if USE_LANGGRAPH else "groq-fast",
                "tts_mode": "expressive" if EXPRESSIVE_MODE else "fast",
                "demo_mode": cfg.mode,
                "demo_company": cfg.company_name,
                "demo_agent_name": cfg.agent_name,
                "llm_requests": _llm_request_count,
                "last_llm_preview": _last_llm_preview or None,
                "agent_id": agent_id,
                "public_url": public_url or None,
                "ngrok_reachable": ngrok_ok,
                "ngrok_detail": ngrok_detail,
            }
        )

    @app.route("/elevenlabs/session", methods=["GET"])
    def elevenlabs_session():
        """Prefer WebSocket signed URL (more stable in browser than WebRTC)."""
        agent_id = os.getenv("ELEVENLABS_AGENT_ID")
        api_key = os.getenv("eleven_labs_key")

        if not agent_id:
            return (
                jsonify(
                    {
                        "detail": "ELEVENLABS_AGENT_ID is not set. Run setup_elevenlabs_agent.py first."
                    }
                ),
                500,
            )

        headers = {"xi-api-key": api_key}
        try:
            signed_resp = requests.get(
                f"{ELEVENLABS_API_BASE}/convai/conversation/get-signed-url",
                params={"agent_id": agent_id},
                headers=headers,
                timeout=15,
            )
            if signed_resp.ok:
                signed_url = signed_resp.json().get("signed_url")
                if signed_url:
                    return jsonify(
                        {
                            "signed_url": signed_url,
                            "agent_id": agent_id,
                            "connection_type": "websocket",
                        }
                    )

            token_resp = requests.get(
                f"{ELEVENLABS_API_BASE}/convai/conversation/token",
                params={"agent_id": agent_id},
                headers=headers,
                timeout=15,
            )
            if token_resp.ok:
                token = token_resp.json().get("token")
                if token:
                    return jsonify(
                        {
                            "conversation_token": token,
                            "agent_id": agent_id,
                            "connection_type": "webrtc",
                        }
                    )

            return jsonify({"agent_id": agent_id, "detail": "Could not start session"}), 502
        except Exception as e:
            print(f"[elevenlabs] session error: {e}")
            return jsonify({"detail": str(e)}), 500
