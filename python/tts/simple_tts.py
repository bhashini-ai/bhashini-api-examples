import os
import json
import requests

# === CONFIGURATION ===
BASE_URL = "https://tts.bhashini.ai"
API_KEY = os.getenv("BHASHINI_API_KEY", "<YOUR_API_KEY>")
OUTPUT_FILE = "tts_output.mp3"

# Common headers
headers = {
    "Content-Type": "application/json",
    "X-API-KEY": f"{API_KEY}",
}

def synthesize_tts(text: str, language: str, voice_name: str):
    """Send TTS synthesis request to /v1/synthesize endpoint."""
    url = f"{BASE_URL}/v1/synthesize"

    payload = {
        "text": text,
        "language": language,
        "voiceName": voice_name
    }

    resp = requests.post(url, headers=headers, data=json.dumps(payload))
    resp.raise_for_status()

    # The response body is raw audio bytes (not JSON)
    if resp.headers.get("Content-Type", "").startswith("audio"):
        audio_bytes = resp.content
        with open(OUTPUT_FILE, "wb") as f:
            f.write(audio_bytes)
        print(f"Audio written to {OUTPUT_FILE}")
    else:
        print("Non-audio response:", resp.text)

if __name__ == "__main__":
    text = "सौर मंडल में सूर्य और वह खगोलीय पिंड सम्मलित हैं, जो इस मंडल में एक दूसरे से गुरुत्वाकर्षण बल द्वारा बंधे हैं।"
    lang = "Hindi"
    voice = "Male1"
    synthesize_tts(text=text, language=lang, voice_name=voice)
