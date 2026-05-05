const STREAMING_STT_URL = "wss://tts.bhashini.ai/stt/stream";
const PCM_TARGET_SAMPLE_RATE = 16000;
const PCM_TARGET_BITS_PER_SAMPLE = 16;
const PCM_TARGET_NUM_CHANNELS = 1;
const PCM_CAPTURE_WORKLET_NAME = "pcm-capture-worklet";
const PCM_CAPTURE_CHUNK_SIZE = 1024;
const API_KEY_PATTERN = /^[A-Za-z0-9]{32}$/;

export class StreamingSpeechClient {
  constructor({
    apiKey,
    language,
    workletUrl = "./pcm-capture.worklet.js",
    interimIntervalMs = 200,
    onInterimTranscript = () => {},
    onFinalTranscript = () => {},
    onStatusChange = () => {},
    onError = () => {},
  } = {}) {
    this.apiKey = `${apiKey || ""}`.trim();
    this.language = `${language || ""}`.trim();
    this.workletUrl = workletUrl;
    this.interimIntervalMs = Number.isFinite(Number(interimIntervalMs)) ? Number(interimIntervalMs) : 200;
    this.onInterimTranscript = onInterimTranscript;
    this.onFinalTranscript = onFinalTranscript;
    this.onStatusChange = onStatusChange;
    this.onError = onError;

    this.isStreaming = false;
    this.isStarting = false;
    this.stopping = false;

    this.mediaStream = null;
    this.webSocket = null;
    this.audioContext = null;
    this.mediaSourceNode = null;
    this.audioWorkletNode = null;
    this.silenceGainNode = null;
    this.workletFlushResolver = null;
  }

  updateConfig({ apiKey, language, interimIntervalMs } = {}) {
    if (typeof apiKey === "string") {
      this.apiKey = apiKey.trim();
    }
    if (typeof language === "string") {
      this.language = language.trim();
    }
    if (Number.isFinite(Number(interimIntervalMs))) {
      this.interimIntervalMs = Number(interimIntervalMs);
    }
  }

  async start() {
    if (this.isStarting || this.isStreaming || this.stopping) return;
    if (!this.language) {
      throw new Error("Language is required for voice input.");
    }
    if (!this.apiKey) {
      throw new Error("API key is required for voice input.");
    }
    if (!API_KEY_PATTERN.test(this.apiKey)) {
      throw new Error("Enter a valid 32-character Bhashini API key. Do not paste a URL or endpoint here.");
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass || !window.AudioWorkletNode) {
      throw new Error("Browser does not support low-latency PCM microphone streaming.");
    }

    this.isStarting = true;
    this.onStatusChange("Requesting microphone access...");

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = this.createPreferredAudioContext(AudioContextClass);
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      await this.audioContext.audioWorklet.addModule(this.workletUrl);

      this.mediaSourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, PCM_CAPTURE_WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: {
          chunkSize: PCM_CAPTURE_CHUNK_SIZE,
        },
      });
      this.audioWorkletNode.port.onmessage = (event) => this.handleAudioWorkletMessage(event);

      this.silenceGainNode = this.audioContext.createGain();
      this.silenceGainNode.gain.value = 0;
      this.mediaSourceNode.connect(this.audioWorkletNode);
      this.audioWorkletNode.connect(this.silenceGainNode);
      this.silenceGainNode.connect(this.audioContext.destination);

      this.webSocket = new WebSocket(STREAMING_STT_URL, [`apikey.${this.apiKey}`]);
      this.webSocket.binaryType = "arraybuffer";
      this.webSocket.onopen = () => {
        this.isStreaming = true;
        this.onStatusChange("Streaming");
        this.sendStartMessage();
      };
      this.webSocket.onmessage = (event) => this.handleIncomingMessage(event.data);
      this.webSocket.onerror = () => {
        this.onError(new Error("Streaming connection error."));
      };
      this.webSocket.onclose = () => {
        this.isStreaming = false;
        this.onStatusChange("Idle");
        this.resetStreamResources();
      };
    } catch (error) {
      this.resetStreamResources();
      this.onStatusChange("Idle");
      this.onError(error instanceof Error ? error : new Error("Unable to start voice input."));
      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  async stop({ silent = false } = {}) {
    if (this.stopping) return;
    this.stopping = true;
    try {
      await this.flushAudioWorklet();
      this.clearAudioGraph();
      await this.closeAudioContext();
      this.closeSocketAfterStopSignal();
      this.isStreaming = false;
      if (silent) {
        this.resetStreamResources();
      }
      this.onStatusChange("Idle");
    } finally {
      this.stopping = false;
    }
  }

  async toggle() {
    if (this.isStreaming) {
      await this.stop();
      return;
    }
    await this.start();
  }

  async destroy() {
    await this.stop({ silent: true });
  }

  createPreferredAudioContext(AudioContextClass) {
    try {
      return new AudioContextClass({ sampleRate: PCM_TARGET_SAMPLE_RATE });
    } catch {
      return new AudioContextClass();
    }
  }

  sendStartMessage() {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return;
    this.webSocket.send(JSON.stringify({
      event: "start",
      language: this.language,
      useVad: true,
      inputEncoding: {
        encoding: "linear16",
        samplingRate: PCM_TARGET_SAMPLE_RATE,
        bitsPerSample: PCM_TARGET_BITS_PER_SAMPLE,
        numChannels: PCM_TARGET_NUM_CHANNELS,
        isSigned: true,
        isBigEndian: false,
      },
      interimIntervalMs: this.interimIntervalMs,
    }));
  }

  handleIncomingMessage(rawMessage) {
    try {
      const payload = JSON.parse(rawMessage);
      if (!payload || typeof payload.transcript !== "string") return;
      if (payload.isFinal === true) {
        this.onFinalTranscript(payload.transcript);
      } else {
        this.onInterimTranscript(payload.transcript);
      }
    } catch {
      // Ignore non-JSON events.
    }
  }

  handleAudioWorkletMessage(event) {
    const data = event?.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "pcm-chunk") {
      const chunk = data.chunk instanceof Float32Array
        ? data.chunk
        : data.chunk instanceof ArrayBuffer
          ? new Float32Array(data.chunk)
          : null;
      this.sendFloatPcmChunkToSocket(chunk);
      return;
    }
    if (data.type === "flush-complete") {
      this.resolveWorkletFlushIfPending();
    }
  }

  sendFloatPcmChunkToSocket(floatChunk) {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return;
    if (!(floatChunk instanceof Float32Array) || floatChunk.length === 0) return;
    const downsampled = this.downsampleFloat32To16kMono(floatChunk, this.audioContext?.sampleRate || PCM_TARGET_SAMPLE_RATE);
    const pcmChunk = this.encodeFloat32ToPcm16Le(downsampled);
    if (pcmChunk && pcmChunk.byteLength > 0) {
      this.webSocket.send(pcmChunk);
    }
  }

  downsampleFloat32To16kMono(input, inputSampleRate) {
    if (!(input instanceof Float32Array) || input.length === 0) {
      return new Float32Array(0);
    }
    if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
      return new Float32Array(0);
    }
    if (inputSampleRate === PCM_TARGET_SAMPLE_RATE) {
      return input;
    }
    const sampleRateRatio = inputSampleRate / PCM_TARGET_SAMPLE_RATE;
    const outputLength = Math.max(1, Math.round(input.length / sampleRateRatio));
    const result = new Float32Array(outputLength);
    let offsetResult = 0;
    let offsetInput = 0;
    while (offsetResult < outputLength) {
      const nextOffsetInput = Math.min(input.length, Math.round((offsetResult + 1) * sampleRateRatio));
      let sum = 0;
      let count = 0;
      for (let i = offsetInput; i < nextOffsetInput; i += 1) {
        sum += input[i];
        count += 1;
      }
      result[offsetResult] = count > 0 ? sum / count : 0;
      offsetResult += 1;
      offsetInput = nextOffsetInput;
    }
    return result;
  }

  encodeFloat32ToPcm16Le(input) {
    if (!(input instanceof Float32Array) || input.length === 0) {
      return null;
    }
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(i * 2, int16, true);
    }
    return buffer;
  }

  async flushAudioWorklet() {
    if (!this.audioWorkletNode?.port) return;
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (this.workletFlushResolver === finish) {
          this.workletFlushResolver = null;
        }
        resolve();
      };
      this.workletFlushResolver = finish;
      try {
        this.audioWorkletNode.port.postMessage({ type: "flush" });
      } catch {
        finish();
        return;
      }
      window.setTimeout(finish, 120);
    });
  }

  resolveWorkletFlushIfPending() {
    if (typeof this.workletFlushResolver !== "function") return;
    const resolve = this.workletFlushResolver;
    this.workletFlushResolver = null;
    resolve();
  }

  disconnectAudioNode(node) {
    if (!node) return;
    try {
      node.disconnect();
    } catch {
      // Best-effort cleanup.
    }
  }

  clearAudioGraph() {
    this.resolveWorkletFlushIfPending();
    if (this.audioWorkletNode?.port) {
      this.audioWorkletNode.port.onmessage = null;
    }
    this.disconnectAudioNode(this.audioWorkletNode);
    this.disconnectAudioNode(this.mediaSourceNode);
    this.disconnectAudioNode(this.silenceGainNode);
    this.audioWorkletNode = null;
    this.mediaSourceNode = null;
    this.silenceGainNode = null;
  }

  async closeAudioContext() {
    if (!this.audioContext) return;
    const context = this.audioContext;
    this.audioContext = null;
    try {
      await context.close();
    } catch {
      // Best-effort cleanup.
    }
  }

  stopMediaTracks() {
    if (!this.mediaStream) return;
    this.mediaStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Best-effort cleanup.
      }
    });
    this.mediaStream = null;
  }

  closeSocketAfterStopSignal() {
    if (!this.webSocket) return;
    try {
      if (this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({ event: "stop" }));
      }
    } catch {
      // Ignore close-signal errors.
    }
    const socket = this.webSocket;
    window.setTimeout(() => {
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch {
        // Ignore close errors.
      }
    }, 80);
  }

  resetStreamResources() {
    this.clearAudioGraph();
    this.closeAudioContext();
    this.webSocket = null;
    this.stopMediaTracks();
  }
}
