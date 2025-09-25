import io
import subprocess
import asyncio
import soundfile as sf
import librosa
import httpx

class ASRClientAsync:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=60.0)

    async def prepare_audio(self, input_path: str, target_sr: int = 16000) -> io.BytesIO:
        # 1. Load audio
        audio, sr = sf.read(input_path, dtype="int16", always_2d=False)

        # Stereo → mono
        if audio.ndim > 1:
            audio = audio.mean(axis=1).astype("int16")

        # 2. Resample
        if sr != target_sr:
            audio = librosa.resample(audio.astype(float), orig_sr=sr, target_sr=target_sr)
            audio = audio.astype("int16")

        # 3. Write WAV to memory buffer
        wav_buf = io.BytesIO()
        sf.write(wav_buf, audio, target_sr, format="WAV", subtype="PCM_16")
        wav_buf.seek(0)

        # 4. Run ffmpeg in-memory to encode to Opus (via subprocess)
        process = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", "pipe:0",
            "-c:a", "libopus", "-b:a", "16k",
            "-f", "ogg", "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        opus_data, err = await process.communicate(input=wav_buf.read())
        if process.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {err.decode()}")

        opus_buf = io.BytesIO(opus_data)
        opus_buf.seek(0)
        return opus_buf

    async def transcribe(self, input_path: str, language: str):
        opus_buf = await self.prepare_audio(input_path)

        files = {
            "file": ("audio.opus", opus_buf, "audio/ogg"),
        }
        data = {
            "language": language,
        }
        headers = {
            "X-API-KEY": self.api_key,
        }

        url = f"{self.api_url}/v1/asr"
        resp = await self.client.post(url, headers=headers, files=files, data=data)
        resp.raise_for_status()
        return resp.json()

    async def aclose(self):
        await self.client.aclose()


# -------------------
# Example usage
# -------------------
async def main():
    client = ASRClientAsync(api_url="https://tts.bhashini.ai", api_key="YOUR_API_KEY_HERE")

    # Run multiple transcriptions concurrently
    results = await asyncio.gather(
        client.transcribe("te_sample.wav", language="Telugu"),
        client.transcribe("hi_sample.wav", language="Hindi"),
        client.transcribe("kn_sample.wav", language="Kannada"),
    )

    for i, r in enumerate(results, start=1):
        print(f"Result {i}:", r)

    await client.aclose()


if __name__ == "__main__":
    asyncio.run(main())

