"""Sync ElevenLabs agent custom LLM URL + ngrok bypass header."""
import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

for p in (
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parents[2] / ".env",
):
    if p.exists():
        load_dotenv(p, override=True)

AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")
API_KEY = os.getenv("eleven_labs_key")
PUBLIC_URL = (os.getenv("PUBLIC_URL") or "").rstrip("/")

# Two voice profiles you can switch between by setting VOICE_TTS_MODE in .env:
#   fast       -> turbo_v2_5 with the winning "warm style" settings from voice_lab.py
#                 (low latency, natural cadence, but no real [laughs]/[sighs] sounds)
#   expressive -> eleven_v3_conversational (performs [laughs]/[sighs]/[chuckles]
#                 as real audio, but adds ~1-2s of latency per reply)
VOICE_MODE = (os.getenv("VOICE_TTS_MODE") or "fast").lower()

BRAND_VOICE_ID = "IKne3meq5aSn9XLyUdCD"

if VOICE_MODE == "expressive":
    tts_settings = {
        "model_id": "eleven_v3_conversational",
        "voice_id": BRAND_VOICE_ID,
        "optimize_streaming_latency": 4,
        # v3 reads bracket tags ([laughs], [sighs]) as real sounds. Slightly higher
        # stability so the expressive bursts don't drift the voice character.
        "stability": 0.45,
        "similarity_boost": 0.85,
        "style": 0.35,
    }
else:
    tts_settings = {
        # Winning A/B config: brand_turbo25_warm_style
        # (style adds warmth, low stability adds variation, speed<1 = more human cadence)
        "model_id": "eleven_turbo_v2",
        "voice_id": BRAND_VOICE_ID,
        "optimize_streaming_latency": 4,
        "stability": 0.35,
        "similarity_boost": 0.90,
        "style": 0.35,
        "speed": 0.98,
    }

payload = {
    "conversation_config": {
        "agent": {
            "prompt": {
                "llm": "custom-llm",
                "custom_llm": {
                    # ElevenLabs treats this as an OpenAI BASE url and appends
                    # "/chat/completions" itself. Must end at /v1, NOT /v1/chat/completions,
                    # otherwise the path doubles -> /v1/chat/completions/chat/completions -> 404.
                    "url": f"{PUBLIC_URL}/v1",
                    "model_id": "sales-agent",
                    "api_type": "chat_completions",
                    "request_headers": {
                        "ngrok-skip-browser-warning": "1",
                    },
                },
                "cascade_timeout_seconds": 15.0,
                "backup_llm_config": {"preference": "disabled"},
                "built_in_tools": {},
            },
            # Opening line — overridden per demo via /demo/config sync.
            "first_message": (
                "Hey — it's Alex from TechCare AI. Quick one: is your team still drowning "
                "in support tickets every day? We help fix that with ServiceFlow AI... got thirty seconds?"
            ),
        },
        "turn": {
            # "normal" + longer timeout: "eager" was cutting callers off mid-thought ("uh... yeah").
            "turn_eagerness": "normal",
            "turn_timeout": 12.0,
        },
        "tts": tts_settings,
    }
}

print(f"Applying VOICE_TTS_MODE='{VOICE_MODE}' -> model={tts_settings['model_id']}")

resp = requests.patch(
    f"https://api.elevenlabs.io/v1/convai/agents/{AGENT_ID}",
    headers={"xi-api-key": API_KEY, "Content-Type": "application/json"},
    json=payload,
    timeout=30,
)
print(resp.status_code)
if resp.ok:
    d = resp.json()
    cc = d.get("conversation_config", {})
    cl = cc.get("agent", {}).get("prompt", {}).get("custom_llm", {})
    tts = cc.get("tts", {})
    print("custom_llm url:", cl.get("url"))
    print("tts model:", tts.get("model_id"), "| latency:", tts.get("optimize_streaming_latency"),
          "| stability:", tts.get("stability"), "| speed:", tts.get("speed"))
    print("turn:", cc.get("turn", {}).get("turn_eagerness"), cc.get("turn", {}).get("turn_timeout"))
else:
    print(resp.text[:800])
