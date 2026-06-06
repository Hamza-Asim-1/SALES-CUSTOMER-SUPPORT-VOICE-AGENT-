"""Resolve the public HTTPS URL voice providers (VAPI, ElevenLabs) use for our LLM."""
import os


def resolve_public_url() -> str:
    """Return base URL for /v1/chat/completions.

    Local dev: set PUBLIC_URL to your ngrok https URL.
    Render: set PUBLIC_URL=https://fyp-sales.onrender.com — or rely on
    RENDER_EXTERNAL_URL when PUBLIC_URL still points at a stale ngrok tunnel.
    """
    explicit = (os.getenv("PUBLIC_URL") or "").rstrip("/")
    render = (os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")
    if render and (not explicit or "ngrok" in explicit.lower()):
        return render
    return explicit
