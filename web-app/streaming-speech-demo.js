import { StreamingSpeechClient } from "./streaming-speech-client.js";

const apiKeyInput = document.getElementById("apiKeyInput");
const languageSelect = document.getElementById("languageSelect");
const transcriptTextArea = document.getElementById("transcriptTextArea");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const clearButton = document.getElementById("clearButton");
const toggleButton = document.getElementById("toggleButton");
const toggleButtonIcon = document.getElementById("toggleButtonIcon");
const statusText = document.getElementById("statusText");
const interimText = document.getElementById("interimText");
const errorText = document.getElementById("errorText");

let interimRange = null;

const client = new StreamingSpeechClient({
  apiKey: apiKeyInput.value,
  language: languageSelect.value,
  workletUrl: "./pcm-capture.worklet.js",
  onInterimTranscript: (transcript) => {
    interimText.textContent = transcript || "Listening";
    applyInterimTranscript(transcript);
  },
  onFinalTranscript: (transcript) => {
    interimText.textContent = "Waiting";
    applyFinalTranscript(transcript);
  },
  onStatusChange: (status) => {
    statusText.textContent = status;
    syncButtons();
  },
  onError: (error) => {
    showError(error?.message || "Streaming speech input failed.");
    syncButtons();
  },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function currentSelectionRange() {
  const text = transcriptTextArea.value || "";
  const rawStart = Number(transcriptTextArea.selectionStart);
  const rawEnd = Number(transcriptTextArea.selectionEnd);
  const fallbackPosition = text.length;
  const start = Number.isFinite(rawStart) ? clamp(rawStart, 0, text.length) : fallbackPosition;
  const end = Number.isFinite(rawEnd) ? clamp(rawEnd, start, text.length) : start;
  return { start, end };
}

function normalizeTranscriptInsertion(transcript, baseText, start) {
  if (!transcript) return "";
  const previousChar = start > 0 ? baseText.slice(start - 1, start) : "";
  if (!previousChar) {
    return transcript;
  }
  if (/^\s/.test(transcript) || /\s/.test(previousChar)) {
    return transcript;
  }
  return ` ${transcript}`;
}

function applyValue(nextValue, nextCaretPosition = null) {
  transcriptTextArea.value = typeof nextValue === "string" ? nextValue : "";
  if (!Number.isFinite(nextCaretPosition)) {
    return;
  }
  transcriptTextArea.focus();
  transcriptTextArea.setSelectionRange(nextCaretPosition, nextCaretPosition);
}

function applyInterimTranscript(transcript) {
  const interim = typeof transcript === "string" ? transcript : "";
  const baseText = transcriptTextArea.value || "";
  let start = 0;
  let end = 0;
  if (interimRange) {
    start = clamp(Number(interimRange.start) || 0, 0, baseText.length);
    end = clamp(Number(interimRange.end) || start, start, baseText.length);
  } else {
    const selection = currentSelectionRange();
    start = selection.start;
    end = selection.end;
  }
  const insertionText = normalizeTranscriptInsertion(interim, baseText, start);
  const nextText = `${baseText.slice(0, start)}${insertionText}${baseText.slice(end)}`;
  const nextEnd = start + insertionText.length;
  interimRange = { start, end: nextEnd };
  applyValue(nextText, nextEnd);
}

function applyFinalTranscript(transcript) {
  const finalTranscript = typeof transcript === "string" ? transcript : "";
  const baseText = transcriptTextArea.value || "";
  let start = 0;
  let end = 0;
  if (interimRange) {
    start = clamp(Number(interimRange.start) || 0, 0, baseText.length);
    end = clamp(Number(interimRange.end) || start, start, baseText.length);
  } else {
    const selection = currentSelectionRange();
    start = selection.start;
    end = selection.end;
  }
  const insertionText = normalizeTranscriptInsertion(finalTranscript, baseText, start);
  const nextText = `${baseText.slice(0, start)}${insertionText}${baseText.slice(end)}`;
  const nextEnd = start + insertionText.length;
  interimRange = null;
  applyValue(nextText, nextEnd);
}

function clearInterimTranscript() {
  if (!interimRange) {
    return;
  }
  applyFinalTranscript("");
}

function updateClientConfig() {
  client.updateConfig({
    apiKey: apiKeyInput.value,
    language: languageSelect.value,
  });
}

function showError(message) {
  errorText.hidden = !message;
  errorText.textContent = message || "";
}

function clearError() {
  showError("");
}

function syncButtons() {
  const isBusy = client.isStarting;
  const isStreaming = client.isStreaming;
  startButton.disabled = isBusy || isStreaming;
  stopButton.disabled = isBusy || !isStreaming;
  toggleButton.disabled = isBusy;
  toggleButton.dataset.streaming = isStreaming ? "true" : "false";
  toggleButton.setAttribute("aria-label", isStreaming ? "Stop voice input" : "Start voice input");
  toggleButton.title = isStreaming ? "Stop voice input" : "Start voice input";
  toggleButtonIcon.textContent = isStreaming ? "⏹️" : "🎙️";
}

async function startStreaming() {
  updateClientConfig();
  clearError();
  interimText.textContent = "Waiting";
  try {
    await client.start();
    syncButtons();
  } catch {
    syncButtons();
  }
}

async function stopStreaming() {
  clearInterimTranscript();
  await client.stop();
  interimText.textContent = "Waiting";
  syncButtons();
}

startButton.addEventListener("click", () => {
  startStreaming();
});

stopButton.addEventListener("click", () => {
  stopStreaming();
});

toggleButton.addEventListener("click", async () => {
  if (client.isStreaming) {
    await stopStreaming();
    return;
  }
  await startStreaming();
});

clearButton.addEventListener("click", () => {
  transcriptTextArea.value = "";
  interimRange = null;
  interimText.textContent = "Waiting";
  clearError();
});

apiKeyInput.addEventListener("input", updateClientConfig);
languageSelect.addEventListener("change", updateClientConfig);

window.addEventListener("beforeunload", () => {
  client.destroy();
});

syncButtons();
