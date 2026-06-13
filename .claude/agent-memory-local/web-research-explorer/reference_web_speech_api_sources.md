---
name: web-speech-api-sources
description: Authoritative sources + key facts on Web Speech API ASR/TTS for Indian languages (Hindi) on Android Chrome, as of 2025-2026
metadata:
  type: reference
---

Research done 2026-06-13 on Web Speech API for Hindi/Indian languages on Android Chrome (FasalSaathi context — likely a farmer-facing app needing Hindi voice).

**On-device vs cloud (the critical question):**
- Default SpeechRecognition is CLOUD (Google servers), needs internet. MDN "Using the Web Speech API": "your audio is sent to a web service for recognition processing, so it won't work offline."
- Chrome 139 (Aug 2025) added OPTIONAL on-device mode via `processLocally` (default false), `SpeechRecognition.available({langs, processLocally})`, `SpeechRecognition.install({langs, processLocally})`.
- Official explainer lists 17 on-device languages and **Hindi (India) IS included**: https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md
- BUT on-device platform support is "user-agent dependent" — confirmed working on macOS; ChromeOS was disabled (incomplete). Android NOT confirmed for on-device as of research date — flag as uncertain.

**Best authoritative sources:**
- MDN processLocally / available_static / install_static — definitive API semantics
- WebAudio/web-speech-api explainer — the 17-language on-device list
- developer.chrome.com/blog/new-in-chrome-139 + /release-notes/139 — ship announcement
- chromium.org chrome-ai-dev-preview-discuss thread — real platform caveats (ChromeOS disabled, macOS works)
- readium/speech json/hi.json — actual Hindi TTS voice inventory (Google Android voices exist)
- caniuse.com/speech-recognition — Chrome Android partial support

**TTS:** Android Chrome returns unfiltered language list; if voice pack not installed, falls back to English. Hindi Google voices exist on Android. getVoices() async/needs voiceschanged event.

**Offline alt:** Transformers.js / whisper-web (xenova) runs Whisper fully in-browser via WASM/WebGPU; Whisper is multilingual incl. Hindi but base accuracy on Hindi is mediocre (fine-tunes better).
