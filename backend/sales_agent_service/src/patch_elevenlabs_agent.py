"""Raise ElevenLabs agent LLM cascade timeout for slower custom LLM responses."""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()
load_dotenv(Path(__file__).resolve().parent / ".env")

AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")
API_KEY = os.getenv("eleven_labs_key")

payload = {
    "conversation_config": {
        "agent": {
            "prompt": {
                "cascade_timeout_seconds": 15.0,
                "temperature": None,
            }
        }
    }
}

resp = requests.patch(
    f"https://api.elevenlabs.io/v1/convai/agents/{AGENT_ID}",
    headers={"xi-api-key": API_KEY, "Content-Type": "application/json"},
    json=payload,
    timeout=30,
)
print(resp.status_code, resp.text[:500])
