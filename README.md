### Python clients for calling Bhashini.ai Speech Recognition (ASR/STT) API
* **ASRClient.python** is synchronous wrapper (blocking version using requests).
* **ASRClientAsync.python** is async-friendly (using httpx + asyncio), so that multiple audio uploads can be processed concurrently.

### Pre-requisites for using ASRClient.python

1) Install ffmpeg on the system:
```bash
sudo apt update && sudo apt install ffmpeg -y
```

2) Install Python libraries
```bash
pip install soundfile librosa ffmpeg-python requests
```

3) Edit and replace YOUR_API_KEY_HERE with your Bhashini.ai API Key

4) Run:
```bash
python ASRClient.python
```


### Pre-requisites for using ASRClientAsync.python:
1) Install ffmpeg on the system:

```bash
sudo apt update && sudo apt install ffmpeg -y
```

2) Install Python libraries
```bash
pip install soundfile librosa ffmpeg-python httpx
```

3) Edit and replace YOUR_API_KEY_HERE with your Bhashini.ai API Key

4) Run:
```bash
python ASRClientAsync.python
```
