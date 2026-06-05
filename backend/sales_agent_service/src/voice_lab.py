"""
Voice A/B lab — generate the SAME sales script across a matrix of ElevenLabs
voices / models / settings so you can listen and pick the most human-sounding one.

Run from backend/sales_agent_service/src with the venv python:
    ..\\.venv\\Scripts\\python.exe voice_lab.py

Output:
    voice_tests/<label>.mp3   — one clip per config
    voice_tests/index.html    — open in a browser to A/B every clip with its settings

Pick the winner, then copy its model_id / voice_id / stability / similarity_boost /
style / speed into sync_elevenlabs_agent.py so the live ConvAI agent uses it.

This consumes ElevenLabs credits (one short TTS render per config).
"""
import os
import sys
import html
from pathlib import Path

from dotenv import load_dotenv
from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs

SRC = Path(__file__).resolve().parent
for p in (SRC / ".env", SRC.parent.parent / ".env"):
    if p.exists():
        load_dotenv(p, override=True)

API_KEY = os.getenv("eleven_labs_key")
if not API_KEY:
    print("ERROR: eleven_labs_key missing in .env")
    sys.exit(1)

client = ElevenLabs(api_key=API_KEY)

OUT_DIR = SRC / "voice_tests"
OUT_DIR.mkdir(exist_ok=True)



# Higher quality than the live call (mp3_22050_32) so you judge the voice itself,
# not the phone-grade compression.
OUTPUT_FORMAT = "mp3_44100_128"

# A natural, conversational sales line with a pause + a question — the kind of
# sentence that exposes robotic vs human delivery.
SCRIPT = (
    "Hey, this is Alex from TechCare AI. "
    "I noticed your team is still handling support tickets by hand... "
    "I'd love to show you how we automate all of that. "
    "Do you have a quick minute to chat?"
)

# Same script with ElevenLabs audio tags — only performed as real sounds by the
# expressive `eleven_v3_conversational` model. With turbo, the tags would be
# read out literally, so we use this script ONLY for the expressive config.
SCRIPT_EXPRESSIVE = (
    "Hey, this is Alex from TechCare AI. [chuckles] "
    "I noticed your team is still handling support tickets by hand... [sighs] "
    "I'd love to show you how we automate all of that. "
    "Do you have a quick minute to chat?"
)

# Brand voice used everywhere else in the project.
BRAND_VOICE = "IKne3meq5aSn9XLyUdCD"
# A few ElevenLabs premade voices (available on all accounts) to compare TONE.
ALT_VOICES = {
    "Brand": BRAND_VOICE,
    "Rachel": "21m00Tcm4TlvDq8ikWAM",
    "Adam": "pNInz6obpgDQGcFmaJgB",
    "Josh": "TxGEqnHWrfWFTfGW9XjX",
}

# Each config = (label, model_id, voice_id, stability, similarity_boost, style, speed)
# Curated (not a full cross-product) to keep credit use modest while still covering:
#   - the 3 realtime-friendly models (turbo_v2_5, flash_v2_5) + quality model (multilingual_v2)
#   - low vs balanced stability (expressiveness)
#   - style 0 vs a touch of style (warmth, costs a little latency)
#   - alternate voices/tones at a balanced setting
CONFIGS = [
    # label,                         model,                    voice,        stab, sim,  style, speed
    ("brand_turbo25_balanced",       "eleven_turbo_v2_5",      BRAND_VOICE,  0.45, 0.85, 0.00, 1.00),
    ("brand_turbo25_expressive",     "eleven_turbo_v2_5",      BRAND_VOICE,  0.30, 0.85, 0.20, 1.00),
    ("brand_turbo25_warm_style",     "eleven_turbo_v2_5",      BRAND_VOICE,  0.35, 0.90, 0.35, 0.98),
    ("brand_flash25_fast",           "eleven_flash_v2_5",      BRAND_VOICE,  0.40, 0.85, 0.00, 1.00),
    ("brand_multilingual_natural",   "eleven_multilingual_v2", BRAND_VOICE,  0.40, 0.85, 0.25, 1.00),
    ("brand_turbo25_slower_calm",    "eleven_turbo_v2_5",      BRAND_VOICE,  0.50, 0.85, 0.10, 0.92),
    # Expressive model — uses SCRIPT_EXPRESSIVE so [chuckles]/[sighs] are PERFORMED
    # as real sounds. Same voice, but adds ~1-2s of latency in live calls.
    ("brand_v3_expressive_TAGS",     "eleven_v3_conversational", BRAND_VOICE, 0.45, 0.85, 0.35, 1.00),
    # Alternate tones (balanced setting) so you can compare the voice itself.
    ("rachel_turbo25_balanced",      "eleven_turbo_v2_5",      ALT_VOICES["Rachel"], 0.40, 0.85, 0.15, 1.00),
    ("adam_turbo25_balanced",        "eleven_turbo_v2_5",      ALT_VOICES["Adam"],   0.40, 0.85, 0.15, 1.00),
    ("josh_turbo25_balanced",        "eleven_turbo_v2_5",      ALT_VOICES["Josh"],   0.40, 0.85, 0.15, 1.00),
]


def make_settings(stability, similarity, style, speed) -> VoiceSettings:
    """Build VoiceSettings, tolerating SDKs that don't support `speed`."""
    kwargs = dict(
        stability=stability,
        similarity_boost=similarity,
        style=style,
        use_speaker_boost=True,
    )
    try:
        return VoiceSettings(speed=speed, **kwargs)
    except TypeError:
        return VoiceSettings(**kwargs)


def render(label, model, voice, stab, sim, style, speed) -> bool:
    out_path = OUT_DIR / f"{label}.mp3"
    # Use the tagged script ONLY with the expressive v3 model — other models
    # would read "[chuckles]" out loud as text.
    script = SCRIPT_EXPRESSIVE if model == "eleven_v3_conversational" else SCRIPT
    try:
        audio = client.text_to_speech.convert(
            voice_id=voice,
            output_format=OUTPUT_FORMAT,
            text=script,
            model_id=model,
            voice_settings=make_settings(stab, sim, style, speed),
        )
        with open(out_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        print(f"  OK   {label:32s} -> {out_path.name}")
        return True
    except Exception as e:
        print(f"  FAIL {label:32s} -> {e}")
        return False


def build_index(results):
    rows = []
    for r in results:
        if not r["ok"]:
            status = f'<span class="fail">failed: {html.escape(r["error"])}</span>'
            player = ""
        else:
            status = '<span class="ok">ready</span>'
            player = f'<audio controls preload="none" src="{r["label"]}.mp3"></audio>'
        rows.append(
            f"""<tr>
  <td><b>{html.escape(r['label'])}</b></td>
  <td>{html.escape(r['model'])}</td>
  <td>{html.escape(r['voice_name'])}</td>
  <td>{r['stab']}</td><td>{r['sim']}</td><td>{r['style']}</td><td>{r['speed']}</td>
  <td>{player}</td>
  <td>{status}</td>
</tr>"""
        )
    table = "\n".join(rows)
    doc = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Voice A/B Lab</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 1100px; margin: 32px auto; padding: 0 16px; }}
  h1 {{ margin-bottom: 4px; }}
  .script {{ background:#f3f4f6; padding:12px 16px; border-radius:8px; color:#111; }}
  table {{ border-collapse: collapse; width: 100%; margin-top: 20px; }}
  th, td {{ border-bottom: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 14px; vertical-align: middle; }}
  th {{ background:#111827; color:#fff; }}
  audio {{ height: 32px; }}
  .ok {{ color:#059669; font-weight:600; }}
  .fail {{ color:#dc2626; }}
  .tip {{ color:#374151; margin-top:18px; }}
</style></head>
<body>
  <h1>Voice A/B Lab</h1>
  <p>Listen to every clip and pick the one that sounds most human. Then tell the agent
     which <b>label</b> won, and it will set those values on the live ConvAI agent.</p>
  <p class="script"><b>Script:</b> {html.escape(SCRIPT)}</p>
  <table>
    <tr><th>Label</th><th>Model</th><th>Voice</th><th>Stab</th><th>Sim</th><th>Style</th><th>Speed</th><th>Listen</th><th>Status</th></tr>
    {table}
  </table>
  <p class="tip">Tip: lower <b>stability</b> + a little <b>style</b> = more lively/human, but too low can sound unstable.
     <b>flash_v2_5</b> is the lowest latency; <b>multilingual_v2</b> is the most natural but adds latency in live calls.</p>
</body></html>"""
    (OUT_DIR / "index.html").write_text(doc, encoding="utf-8")


def main():
    voice_id_to_name = {v: k for k, v in ALT_VOICES.items()}
    print(f"Rendering {len(CONFIGS)} voice samples to {OUT_DIR} ...\n")
    results = []
    for (label, model, voice, stab, sim, style, speed) in CONFIGS:
        ok = render(label, model, voice, stab, sim, style, speed)
        results.append({
            "label": label, "model": model, "voice": voice,
            "voice_name": voice_id_to_name.get(voice, voice[:8]),
            "stab": stab, "sim": sim, "style": style, "speed": speed,
            "ok": ok, "error": "" if ok else "render failed (see console)",
        })

    build_index(results)
    ok_count = sum(1 for r in results if r["ok"])
    print(f"\nDone: {ok_count}/{len(results)} rendered.")
    print(f"Open this in your browser to compare:\n  {OUT_DIR / 'index.html'}")


if __name__ == "__main__":
    main()
