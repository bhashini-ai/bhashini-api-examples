import asyncio
import json
import time
import websockets
import pyaudio

WS_URL = "wss://tts.bhashini.ai/stt/stream"
API_KEY = "<put-your-api-key-here>"

# Audio parameters (must match server expectations)
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # bytes (16-bit PCM)
FRAME_DURATION_MS = 128
FRAMES_PER_BUFFER = int(SAMPLE_RATE * FRAME_DURATION_MS / 1000)

p = pyaudio.PyAudio()
protocol_header = f"apikey.{API_KEY}"

async def stream_microphone(ws):
    stream = p.open(
        format=pyaudio.paInt16,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=FRAMES_PER_BUFFER,
    )

    print("🎤 Microphone streaming started (Ctrl+C to stop)")

    try:
        while True:
            data = stream.read(FRAMES_PER_BUFFER, exception_on_overflow=False)
            await ws.send(data)
            await asyncio.sleep(FRAME_DURATION_MS / 1000.0)
    except asyncio.CancelledError:
        pass
    finally:
        stream.stop_stream()
        stream.close()
        print("🎤 Microphone stopped")


async def receive_messages(ws):
    async for msg in ws:
        try:
            payload = json.loads(msg)
            print("⬅️ ", payload)
        except Exception:
            print("⬅️ Raw:", msg)


async def main():
    async with websockets.connect(WS_URL, max_size=None, subprotocols=[protocol_header]) as ws:
        # ---- START control message ----
        start_msg = {
            "event": "start",
            "language": "Kannada",
            "useVad": True,
            "inputEncoding": {
                "encoding": "linear16",
                "samplingRate": 16000,
                "bitsPerSample": 16,
                "numChannels": 1,
                "isSigned": True,
                "isBigEndian": False
            },
            "vadConfig": {
                "pStart": 0.6,
                "pauseMs": 400,
                "endMs": 1200
            },
            "interimIntervalMs": 200
        }

        await ws.send(json.dumps(start_msg))
        print("➡️ Sent START")

        mic_task = asyncio.create_task(stream_microphone(ws))
        recv_task = asyncio.create_task(receive_messages(ws))

        try:
            await asyncio.gather(mic_task, recv_task)
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
        finally:
            mic_task.cancel()
            await ws.send(json.dumps({"event": "finalize"}))
            print("➡️ Sent FINALIZE")
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
