---
name: reference-ondevice-llm-sources
description: Canonical 2025-2026 sources for on-device mobile LLM (flutter_gemma, MediaPipe LLM Inference, Gemma 3 mobile benchmarks) and Hindi voice (Vosk)
metadata:
  type: reference
---

Authoritative sources for on-device mobile LLM + Indian-language voice research:

- flutter_gemma package: https://pub.dev/packages/flutter_gemma (changelog at /changelog) — actively maintained by Sasha Denisov (DenisovAV). As of 2026-06 at v0.16.5. Repo: https://github.com/DenisovAV/flutter_gemma
- MediaPipe LLM Inference (Android): https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/android — Gradle dep com.google.mediapipe:tasks-genai (was 0.10.27).
- Gemma 3 mobile blog (prefill 2585 tok/sec on S24 Ultra, model 529MB int4, 2048 ctx): https://developers.googleblog.com/en/gemma-3-on-mobile-and-web-with-google-ai-edge/
- Gemma 3n decode benchmarks + GPU-slower-than-CPU bug: https://github.com/google-ai-edge/gallery/issues/35
- LiteRT-LM blog: https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/
- Qualcomm NPU + LiteRT: https://developers.google.com/edge/litert/android/npu/qualcomm
- Gemma 3 1B int4 model: https://huggingface.co/litert-community/Gemma3-1B-IT
- Vosk models (Hindi small 42MB: vosk-model-small-hi-0.22): https://alphacephei.com/vosk/models ; Flutter plugin vosk_flutter
- whisper.cpp Flutter: whisper_ggml / whisper_ggml_plus on pub.dev (synced to whisper.cpp v1.8.3)

**Key finding (frozen 2026-06):** GPU vs CPU decode for ~1-2B int4 on mobile is device-dependent — GPU prefill reliably faster, but GPU decode sometimes SLOWER than CPU (Vivo X200 Pro: CPU 6.5 tok/s vs GPU 1 tok/s on Gemma 3n E2B). Always test both backends on the actual device.
