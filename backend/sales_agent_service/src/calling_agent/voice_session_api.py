"""
Dashboard voice-call lifecycle API.

Flow:
  POST /voice/session            -> create a per-call session bound to a business
                                    + lead, return VAPI assistant config
  POST /voice/session/<id>/turn  -> browser forwards each final transcript; we
                                    score sentiment (user turns) and push events
  GET  /voice/session/<id>/events-> SSE stream of sentiment/escalation/order
  POST /voice/session/<id>/handoff-> human takes over (agent goes quiet)
  POST /voice/session/<id>/end   -> persist call record, tear down session
"""
import json
import os
import queue

from flask import Response, jsonify, request, stream_with_context

from calling_agent import business_data, demo_config, sentiment, session_store

# Escalate to a human when the rolling sentiment EMA drops below this (0..100).
ESCALATION_THRESHOLD = float(os.getenv("SENTIMENT_ESCALATION_THRESHOLD", "30"))


def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return resp


def register_voice_session_routes(app):
    @app.route("/voice/session", methods=["POST", "OPTIONS"])
    def create_voice_session():
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))

        body = request.get_json(force=True, silent=True) or {}
        user_id = str(body.get("user_id") or "").strip()
        if not user_id:
            return _cors(jsonify({"error": "user_id is required"})), 400

        lead_id = body.get("lead_id")
        profile = business_data.get_company_profile(user_id) or {}
        mode = (body.get("mode") or profile.get("mode") or "sales").lower()
        mode = "support" if mode in ("support", "service", "cs", "customer_service") else "sales"

        products = business_data.list_products(user_id)
        customer = business_data.get_lead(user_id, lead_id) if lead_id is not None else {}

        company_name = profile.get("company_name") or "your company"
        agent_name = profile.get("agent_name") or "Alex"

        session = session_store.create_session(
            user_id=user_id,
            lead_id=str(lead_id) if lead_id is not None else None,
            mode=mode,
            company_profile=profile,
            products=products,
            customer=customer,
            agent_name=agent_name,
            company_name=company_name,
        )

        # Build the VAPI assistant bound to THIS session (so the custom-LLM call
        # carries ?session_id=... and loads the right business + lead context).
        from calling_agent.vapi_config import build_vapi_assistant

        public_key = (os.getenv("VAPI_PUBLIC_KEY") or "").strip()
        try:
            assistant = build_vapi_assistant(session=session)
        except ValueError as e:
            return _cors(jsonify({"ready": False, "error": str(e), "session_id": session.session_id})), 503

        if not public_key:
            return _cors(jsonify({
                "ready": False,
                "error": "VAPI_PUBLIC_KEY is not set. Add it in the sales service environment.",
                "session_id": session.session_id,
                "assistant_preview": assistant,
            })), 503

        return _cors(jsonify({
            "ready": True,
            "session_id": session.session_id,
            "public_key": public_key,
            "assistant": assistant,
            "mode": mode,
            "company_name": company_name,
            "agent_name": agent_name,
            "customer": customer,
            "product_count": len(products),
        }))

    @app.route("/voice/session/<session_id>/turn", methods=["POST", "OPTIONS"])
    def voice_turn(session_id):
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))

        session = session_store.get_session(session_id)
        if not session:
            return _cors(jsonify({"error": "session not found"})), 404

        body = request.get_json(force=True, silent=True) or {}
        role = body.get("role", "user")
        text = (body.get("text") or "").strip()
        if not text:
            return _cors(jsonify({"ok": True, "ignored": "empty"}))

        if role == "user":
            result = sentiment.score_turn(
                text, [t for t in session.transcript if t.get("role") == "user"]
            )
            ema = session.apply_sentiment(result["score"], result["emotion"])
            session.add_turn("user", text, sentiment=ema, emotion=result["emotion"])
            session.publish({
                "type": "sentiment",
                "score": ema,
                "raw": result["score"],
                "emotion": result["emotion"],
                "intensity": result.get("intensity"),
                "text": text,
            })
            # Sustained negativity -> bring in a human (once).
            if ema < ESCALATION_THRESHOLD and not session.escalated:
                session.escalated = True
                session.publish({
                    "type": "escalation",
                    "reason": f"Customer sentiment dropped to {ema:.0f}% (threshold {ESCALATION_THRESHOLD:.0f}%).",
                    "score": ema,
                    "source": "auto",
                })
            return _cors(jsonify({"ok": True, "score": ema, "emotion": result["emotion"],
                                  "escalated": session.escalated}))
        else:
            session.add_turn("assistant", text)
            session.publish({"type": "agent_transcript", "text": text})
            return _cors(jsonify({"ok": True}))

    @app.route("/voice/session/<session_id>/events", methods=["GET"])
    def voice_events(session_id):
        session = session_store.get_session(session_id)
        if not session:
            return _cors(jsonify({"error": "session not found"})), 404

        def event_stream():
            q = session.subscribe()
            # Initial snapshot so a late-joining panel is in sync.
            snapshot = {
                "type": "snapshot",
                "score": session.sentiment_score,
                "emotion": session.last_emotion,
                "escalated": session.escalated,
                "human_present": session.human_present,
                "orders": session.orders,
            }
            yield f"data: {json.dumps(snapshot)}\n\n"
            try:
                while True:
                    try:
                        event = q.get(timeout=20)
                        yield f"data: {json.dumps(event)}\n\n"
                    except queue.Empty:
                        # Heartbeat keeps the connection alive through proxies.
                        yield ": ping\n\n"
            except GeneratorExit:
                pass
            finally:
                session.unsubscribe(q)

        resp = Response(stream_with_context(event_stream()), mimetype="text/event-stream")
        resp.headers["Cache-Control"] = "no-cache"
        resp.headers["X-Accel-Buffering"] = "no"
        resp.headers["Connection"] = "keep-alive"
        resp.headers["Access-Control-Allow-Origin"] = "*"
        return resp

    @app.route("/voice/session/<session_id>/handoff", methods=["POST", "OPTIONS"])
    def voice_handoff(session_id):
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))
        session = session_store.get_session(session_id)
        if not session:
            return _cors(jsonify({"error": "session not found"})), 404
        session.human_present = True
        session.escalated = True
        session.publish({"type": "handoff", "human_present": True})
        return _cors(jsonify({"ok": True, "human_present": True}))

    @app.route("/voice/session/<session_id>/end", methods=["POST", "OPTIONS"])
    def voice_end(session_id):
        if request.method == "OPTIONS":
            return _cors(Response("", status=204))
        session = session_store.get_session(session_id)
        if not session:
            return _cors(jsonify({"ok": True, "already_gone": True}))
        try:
            business_data.record_call(session)
        finally:
            session.publish({"type": "ended"})
            session_store.remove_session(session_id)
        return _cors(jsonify({
            "ok": True,
            "final_sentiment": session.sentiment_score,
            "min_sentiment": session.min_sentiment,
            "orders": session.orders,
        }))
