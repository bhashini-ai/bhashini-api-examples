# Python Clients for Bhashini.ai Speech Recognition (ASR/STT) API

This repository provides two Python clients to interact with the **Bhashini.ai Speech Recognition (ASR/STT) API**:

- **`ASRClient.py`** — A synchronous client (blocking), implemented with `requests`.
- **`ASRClientAsync.py`** — An asynchronous client, implemented with `httpx` + `asyncio`, allowing concurrent audio uploads.

---

## Prerequisites

Both clients require **FFmpeg** and specific Python libraries.

### 1. Install FFmpeg
```bash
sudo apt update && sudo apt install ffmpeg
```

### 2. Install Python dependencies
* For **synchronous client** (`ASRClient.py`):
    ```bash
    pip install soundfile librosa ffmpeg-python requests
    ```

* For **asynchronous client** (`ASRClientAsync.py`):
    ```bash
    pip install soundfile librosa ffmpeg-python httpx
    ```

## Usage
1. Open the desired client file (`ASRClient.py` or `ASRClientAsync.py`).
2. Replace `YOUR_API_KEY_HERE` with your **Bhashini.ai API Key**.
3. Specify the path(s) of your audio files.
4. Run the client:
    * **Synchronous**:
        ```bash
        python ASRClient.py
        ```

    * **Asynchronous**:
        ```bash
        python ASRClientAsync.py
        ```
