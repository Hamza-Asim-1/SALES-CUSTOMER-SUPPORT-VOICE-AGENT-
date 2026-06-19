"""
Realtime per-turn sentiment + emotion scoring (Groq JSON classifier).

Returns a 0..100 score (100 = delighted, 0 = furious) and a coarse emotion
label the prompt uses to adapt tone. Kept fast (8b model, tiny max_tokens) so
it doesn't add noticeable latency to the live call.
"""
import json
import os
import re
from typing import Dict, List

from groq import Groq

_client: Groq | None = None

_SYSTEM = """You score the EMOTIONAL STATE of a customer on a sales/support call from their latest message.
Return ONLY compact JSON, no prose:
{"score": 0-100, "emotion": "angry|sad|confused|frustrated|neutral|positive", "intensity": "low|medium|high"}
Scoring guide:
- 0-25  : angry, shouting, hostile, crying, very upset
- 26-45 : frustrated, annoyed, confused, impatient
- 46-65 : neutral, just asking questions
- 66-85 : interested, agreeable, warm
- 86-100: enthusiastic, ready to buy, delighted
Judge tone and word choice, not just topic."""

_JSON_RX = re.compile(r"\{.*\}", re.DOTALL)


def _groq() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        _client = Groq(api_key=api_key)
    return _client


def score_turn(text: str, history: List[Dict] | None = None) -> Dict:
    """Score one user utterance. Falls back to neutral on any error."""
    text = (text or "").strip()
    if not text:
        return {"score": 60.0, "emotion": "neutral", "intensity": "low"}

    model = os.getenv("SENTIMENT_LLM_MODEL", os.getenv("VOICE_LLM_MODEL", "llama-3.1-8b-instant"))
    ctx = ""
    if history:
        recent = [h for h in history if h.get("role") == "user"][-2:]
        if recent:
            ctx = "Prior customer lines: " + " | ".join(h.get("text", "")[:120] for h in recent) + "\n"
    try:
        resp = _groq().chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"{ctx}Latest customer message: {text}"},
            ],
            temperature=0.0,
            max_tokens=60,
        )
        raw = (resp.choices[0].message.content or "").strip()
        m = _JSON_RX.search(raw)
        data = json.loads(m.group()) if m else {}
        score = float(data.get("score", 60))
        score = max(0.0, min(100.0, score))
        emotion = str(data.get("emotion", "neutral")).lower()
        intensity = str(data.get("intensity", "medium")).lower()
        return {"score": score, "emotion": emotion, "intensity": intensity}
    except Exception as e:
        print(f"[sentiment] scoring failed: {e}")
        return {"score": 60.0, "emotion": "neutral", "intensity": "low"}
