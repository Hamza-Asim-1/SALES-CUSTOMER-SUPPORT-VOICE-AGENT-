"""
SignalWire telephony via the Compatibility (LaML/cXML) REST API.

SignalWire's Compatibility API mirrors Twilio's REST + TwiML 1:1, so we place
calls with a plain HTTPS POST (via `requests`) and build cXML responses as
strings. We deliberately do NOT use the `signalwire` PyPI SDK: it pins ancient
PyJWT==1.7.1 / aiohttp==3.9.5 / twilio==6.54.0, which break this project's
Supabase (gotrue/realtime) stack.

Required env (set in .env):
  SIGNALWIRE_PROJECT_ID   - Project ID (basic-auth username / "account SID")
  SIGNALWIRE_API_TOKEN    - API token (basic-auth password)
  SIGNALWIRE_SPACE_URL    - your space host, e.g. example.signalwire.com (no scheme)
  SIGNALWIRE_NUMBER       - purchased/verified SignalWire number in E.164 (e.g. +1...)
"""
import os
from xml.sax.saxutils import escape, quoteattr

import requests


class SignalWireConfigError(RuntimeError):
    """Raised when SignalWire credentials/number are missing."""


def _space_url() -> str:
    space = (os.getenv("SIGNALWIRE_SPACE_URL") or "").strip()
    return space.replace("https://", "").replace("http://", "").rstrip("/")


def signalwire_number() -> str:
    """Return the configured SignalWire number, or '' if it's missing/placeholder.

    A valid number must look like E.164 (starts with '+', digits after).
    This guards against `.env` placeholder strings like 'REPLACE_WITH_...'."""
    raw = (os.getenv("SIGNALWIRE_NUMBER") or "").strip()
    if not raw.startswith("+"):
        return ""
    digits = raw.replace(" ", "").replace("-", "")[1:]
    if not digits.isdigit() or len(digits) < 7:
        return ""
    return raw


def _credentials() -> tuple[str, str]:
    project = (os.getenv("SIGNALWIRE_PROJECT_ID") or "").strip()
    token = (os.getenv("SIGNALWIRE_API_TOKEN") or "").strip()
    # Reject obvious .env placeholders so callers don't make doomed API calls.
    if project.upper().startswith("REPLACE_"):
        project = ""
    if token.upper().startswith("REPLACE_"):
        token = ""
    return project, token


def is_configured() -> bool:
    project, token = _credentials()
    return bool(project and token and _space_url() and signalwire_number())


def create_call(
    to: str,
    url: str,
    status_callback: str | None = None,
    status_callback_events: list[str] | None = None,
    status_callback_method: str = "POST",
    timeout: int = 30,
) -> dict:
    """Place an outbound call through SignalWire's Compatibility API.

    Returns the parsed JSON response (contains 'sid', 'status', etc.).
    """
    project, token = _credentials()
    space = _space_url()
    from_number = signalwire_number()
    if not (project and token and space):
        raise SignalWireConfigError(
            "SignalWire not configured: set SIGNALWIRE_PROJECT_ID, "
            "SIGNALWIRE_API_TOKEN and SIGNALWIRE_SPACE_URL in .env"
        )
    if not from_number:
        raise SignalWireConfigError("SIGNALWIRE_NUMBER is not set in .env")

    endpoint = f"https://{space}/api/laml/2010-04-01/Accounts/{project}/Calls.json"
    # List of tuples so StatusCallbackEvent can repeat (one per event).
    data: list[tuple[str, str]] = [("To", to), ("From", from_number), ("Url", url)]
    if status_callback:
        data.append(("StatusCallback", status_callback))
        data.append(("StatusCallbackMethod", status_callback_method))
        for ev in status_callback_events or []:
            data.append(("StatusCallbackEvent", ev))

    resp = requests.post(endpoint, data=data, auth=(project, token), timeout=timeout)
    resp.raise_for_status()
    return resp.json()


# --- cXML builders (identical to Twilio's TwiML; pure strings, no network) -----

def cxml_play_and_gather(
    audio_url: str,
    action_url: str,
    *,
    timeout: str = "auto",
    speech_timeout: str = "auto",
    language: str = "en-US",
) -> str:
    """<Response><Play>..</Play><Gather input="speech" .../></Response>"""
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Play>{escape(audio_url)}</Play>"
        f"<Gather input=\"speech\" action={quoteattr(action_url)} "
        f"timeout={quoteattr(str(timeout))} speechTimeout={quoteattr(str(speech_timeout))} "
        f"language={quoteattr(language)}/>"
        "</Response>"
    )


def cxml_say_hangup(text: str) -> str:
    """<Response><Say>..</Say><Hangup/></Response>"""
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Say>{escape(text)}</Say><Hangup/></Response>"
    )
