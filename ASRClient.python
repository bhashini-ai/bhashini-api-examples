import io
import subprocess
import soundfile as sf
import librosa
import requests

class ASRClient:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key

    def prepare_audio(self, input_path: str, target_sr: int = 16000) -> io.BytesIO:
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

        # 4. Run ffmpeg in-memory to encode to Ogg Opus
        opus_buf = io.BytesIO()
        process = subprocess.Popen(
            [
                "ffmpeg", "-y", "-i", "pipe:0",
                "-c:a", "libopus", "-b:a", "16k",
                "-f", "ogg", "pipe:1"
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        opus_data, err = process.communicate(input=wav_buf.read())
        if process.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {err.decode()}")

        opus_buf.write(opus_data)
        opus_buf.seek(0)

        return opus_buf

    def transcribe(self, input_path: str, language: str):
        opus_buf = self.prepare_audio(input_path)

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
        resp = requests.post(url, headers=headers, files=files, data=data)
        resp.raise_for_status()
        return resp.json()


# -------------------
# Example usage
# -------------------
if __name__ == "__main__":
    client = ASRClient(api_url="https://tts.bhashini.ai", api_key="YOUR_API_KEY_HERE")
    result = client.transcribe("kn_sample.wav", language="Kannada")
    print("Transcription:", result)

