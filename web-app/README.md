# Bhashini.ai Streaming Speech Web Demo

This example shows how to use Bhashini AI's streaming speech-to-text WebSocket API from plain HTML and JavaScript.

## Files

- `index.html`: runnable demo UI
- `styles.css`: simple styling for the demo
- `streaming-speech-client.js`: framework-agnostic microphone streaming client
- `streaming-speech-demo.js`: small page wiring for the demo UI
- `pcm-capture.worklet.js`: AudioWorklet that emits microphone PCM chunks

## Run locally

Serve this directory over HTTP so microphone access and AudioWorklet loading work correctly.

Examples:

```bash
cd web-app
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Reuse in your own web app

You can copy `streaming-speech-client.js` and `pcm-capture.worklet.js` into any web application.
The client does not depend on any framework.

Typical usage:

```js
import { StreamingSpeechClient } from "./streaming-speech-client.js";

const client = new StreamingSpeechClient({
  apiKey: "YOUR_API_KEY",
  language: "English",
  workletUrl: "./pcm-capture.worklet.js",
  onInterimTranscript: (text) => console.log("interim", text),
  onFinalTranscript: (text) => console.log("final", text),
  onStatusChange: (status) => console.log("status", status),
  onError: (error) => console.error(error),
});

await client.start();
// ...
await client.stop();
```
