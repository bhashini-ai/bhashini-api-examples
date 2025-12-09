import asyncio
import argparse
import json
import websockets
import os

# Install dependency: pip install websockets

async def tts_client(text, language, voice_name, voice_style, api_key):
    uri = "wss://tts.bhashini.ai/stream/tts"
    
    # Auth header format used by Bhashini: "apikey.<your-api-key>"
    auth_header = f"apikey.{api_key}"
    
    print(f"Connecting to {uri}...")
    
    # The Bhashini API expects the auth token in the Sec-WebSocket-Protocol header (subprotocols)
    async with websockets.connect(uri, subprotocols=[auth_header]) as websocket:
        print("Connected.")
        
        # Construct the payload
        payload = {
            "event": "Synthesize",
            "ttsInput": {
                "text": text,
                "language": language,
                "voiceName": voice_name,
                "voiceStyle": voice_style
            }
        }
        
        print(f"Sending payload: {json.dumps(payload, indent=2)}")
        await websocket.send(json.dumps(payload))
        
        chunk_index = 0
        
        try:
            async for message in websocket:
                if isinstance(message, str):
                    # Text message (events like sentence_start, sentence_end, done)
                    event_data = json.loads(message)
                    print(f"Received Event: {event_data}")
                    
                    if event_data.get("event") == "done":
                        print("Synthesis complete.")
                        break
                        
                elif isinstance(message, bytes):
                    # Binary message (Audio Chunk)
                    filename = f"chunk_{chunk_index}.mp3"
                    print(f"Received audio chunk {chunk_index}: {len(message)} bytes -> saving to {filename}")
                    
                    with open(filename, "wb") as f:
                        f.write(message)
                        
                    chunk_index += 1
                    
        except websockets.exceptions.ConnectionClosed as e:
            print(f"Connection closed: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bhashini.ai TTS WebSocket Client Sample")
    
    parser.add_argument("--text", type=str, required=True, help="Text to synthesize")
    parser.add_argument("--lang", type=str, required=True, help="Language (e.g., Hindi, Kannada)")
    parser.add_argument("--voice", type=str, required=True, help="Voice Name (e.g., hi-f1, kn-f1)")
    parser.add_argument("--style", type=str, default="Neutral", help="Voice Style (e.g., Neutral, Happy, Sad)")
    parser.add_argument("--api-key", type=str, required=True, help="Bhashini.ai API Key")
    
    args = parser.parse_args()
    
    asyncio.run(tts_client(args.text, args.lang, args.voice, args.style, args.api_key))

