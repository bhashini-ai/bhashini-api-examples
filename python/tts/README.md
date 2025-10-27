## Bhashini.ai Text-to-Speech (TTS) — Python Example

This example demonstrates how to synthesize speech from text using the Bhashini.ai TTS REST API from Python.
It uses the ```/v1/synthesize``` endpoint.

### Requirements

* Python 3.7+
* requests

Install dependencies:
```bash
pip install requests
```

### Set up your API Key

Before running the script, export your Bhashini API key as an environment variable:
```bash
export BHASHINI_API_KEY=<your API key>
```

On Windows PowerShell, use:
```bash
setx BHASHINI_API_KEY "<your API key>"
```

### Configure ```simple_tts.py```

Open ```simple_tts.py``` in a text editor and update the following variables:

```bash

OUTPUT_FILE = "output.mp3"          # Path of file where TTS output will be saved
text = "सौर मंडल में सूर्य और वह खगोलीय पिंड सम्मलित हैं, जो इस मंडल में एक दूसरे से गुरुत्वाकर्षण बल द्वारा बंधे हैं।"  # Input text for synthesis
lang = "Hindi"                      # Language of the input text
voice = "Male1"                  # TTS voice name
```

You can fetch a list of available voices from:
```
https://tts.bhashini.ai/tessdata_fast/tts_voices.json
```

### Run the Program
Execute the script:
```bash
python simple_tts.py
```

If successful, the output audio file will be saved at the path specified in ```OUTPUT_FILE```.

### Output

* File: ```output.mp3``` (or whatever you name it)
* Format: MP3 (or as returned by the TTS service)
* Content: Synthesized speech of the input text

### Notes

* Make sure your API key has access to the TTS service.
* Use proper language names (e.g., Hindi, Kannada, Konkani).
* Some voices may only support specific languages.

### License

This example is licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0). You’re free to use, modify, and include this code in your own projects — even commercial ones.
