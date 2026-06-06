"""
VAPI voice pipeline — primary voice stack for the live demo.

Uses VAPI's own STT + TTS stack while the LLM brain remains our existing
/v1/chat/completions endpoint (Groq + LangGraph + demo_config prompts). The
SAME system prompts power both sales and customer-support modes (see
_build_system_prompt in elevenlabs_bridge), so VAPI behaves identically to the
old ElevenLabs path — just with a better-sounding voice.

Env (optional):
  VAPI_PUBLIC_KEY          — public key from dashboard.vapi.ai (safe to expose to frontend)
  VAPI_VOICE_PROVIDER      — vapi | 11labs | cartesia (default: vapi — works on free VAPI accounts)
  VAPI_VOICE_ID            — provider-specific voice id (default: Elliot for vapi provider)
  VAPI_TRANSCRIBER_PROVIDER — deepgram (default) | talkscriber
  VAPI_BACKGROUND_SOUND    — office | static | off | <url> (default: office — adds realistic ambience)
  PUBLIC_URL               — ngrok https URL (required so VAPI cloud can reach our LLM)
"""
import os

from flask import jsonify, request, Response
from calling_agent import demo_config
from calling_agent.public_url import resolve_public_url


def _background_sound() -> str:
    """Background ambience to make the call feel real. 'office' = subtle room/keyboard
    noise; 'static' = faint phone-line hiss; 'off' = silent; or a custom audio URL."""
    raw = (os.getenv("VAPI_BACKGROUND_SOUND") or "office").strip()
    return raw or "office"


def build_vapi_assistant() -> dict:
    """Inline VAPI assistant config using current demo_config + our custom LLM.

    The system prompt and opening line come from the SAME builders the ElevenLabs
    path used, so sales vs. customer-support behaviour is identical across both.
    """
    from calling_agent.elevenlabs_bridge import _build_system_prompt, _opening_hook

    cfg = demo_config.current()
    public_url = resolve_public_url()
    if not public_url:
        raise ValueError(
            "PUBLIC_URL is not set. On Render set PUBLIC_URL=https://fyp-sales.onrender.com "
            "(local dev: use your ngrok https URL on port 8000)."
        )

    voice_provider = (os.getenv("VAPI_VOICE_PROVIDER") or "vapi").lower()
    voice_id = os.getenv("VAPI_VOICE_ID") or ("Elliot" if voice_provider == "vapi" else "79a125e8-cd45-4c13-8a67-188112f4dc46")
    transcriber = (os.getenv("VAPI_TRANSCRIBER_PROVIDER") or "deepgram").lower()

    # VAPI expects the full chat/completions URL (unlike ElevenLabs which uses /v1 base).
    llm_url = f"{public_url}/v1/chat/completions"

    mode_label = "support" if cfg.mode == "support" else "sales"
    assistant = {
        "name": f"{cfg.company_name} — {mode_label}",
        "firstMessage": _opening_hook(cfg),
        "firstMessageMode": "assistant-speaks-first",
        # Realistic ambience so the call doesn't sound sterile.
        "backgroundSound": _background_sound(),
        "model": {
            "provider": "custom-llm",
            "url": llm_url,
            "model": "sales-agent",
            "temperature": 0.6,
            "messages": [
                {"role": "system", "content": _build_system_prompt()},
            ],
        },
        "voice": {
            "provider": voice_provider,
            "voiceId": voice_id,
        },
        "transcriber": {
            "provider": transcriber,
            "model": "nova-2",
            "language": "en",
        },
        # Web calls default to 15s — too short once the browser mic prompt + WebRTC
        # handshake run. 60s prevents assistant-did-not-receive-customer-audio drops.
        "customerJoinTimeoutSeconds": 60,
        # Don't hang up while the user is thinking.
        "silenceTimeoutSeconds": 45,
        # Turn-taking: commit user speech faster; don't wait forever on partials.
        "startSpeakingPlan": {
            "waitSeconds": 0.35,
            "smartEndpointingEnabled": True,
            "transcriptionEndpointingPlan": {
                "onPunctuationSeconds": 0.25,
                "onNoPunctuationSeconds": 0.9,
                "onNumberSeconds": 0.4,
            },
        },
        "stopSpeakingPlan": {
            "numWords": 1,
            "voiceSeconds": 0.25,
            "backoffSeconds": 0.6,
        },
    }

    # playht / 11labs may need extra fields; keep minimal for vapi + deepgram.
    if voice_provider == "11labs":
        assistant["voice"]["model"] = "eleven_turbo_v2_5"

    return assistant


def register_vapi_routes(app):
    @app.route("/vapi/assistant", methods=["GET", "OPTIONS"])
    def vapi_assistant():
        if request.method == "OPTIONS":
            resp = Response("", status=204)
            resp.headers["Access-Control-Allow-Origin"] = "*"
            resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            return resp

        public_key = (os.getenv("VAPI_PUBLIC_KEY") or "").strip()
        cfg = demo_config.current()

        try:
            assistant = build_vapi_assistant()
        except ValueError as e:
            resp = jsonify({"ready": False, "error": str(e), "demo_mode": cfg.mode})
            resp.headers["Access-Control-Allow-Origin"] = "*"
            return resp, 503

        if not public_key:
            resp = jsonify(
                {
                    "ready": False,
                    "error": (
                        "VAPI_PUBLIC_KEY is not set. Add it in Render → fyp-sales → Environment "
                        "(get your public key from https://dashboard.vapi.ai)."
                    ),
                    "assistant_preview": assistant,
                }
            )
            resp.headers["Access-Control-Allow-Origin"] = "*"
            return resp, 503

        resp = jsonify(
            {
                "ready": True,
                "public_key": public_key,
                "assistant": assistant,
                "demo_mode": cfg.mode,
                "demo_company": cfg.company_name,
                "stack_note": (
                    "VAPI handles STT/TTS; your Groq sales brain is unchanged at /v1/chat/completions."
                ),
            }
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        return resp
