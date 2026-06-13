---
name: project-offline-llm-pwa
description: FasalSaathi is exploring fully-offline on-device LLM inference in an Android Chrome PWA; distilled research facts.
metadata:
  type: project
---

FasalSaathi (see [[project-fasalsaathi]] — 30hr hackathon, voice-first vernacular AI assistant for Indian farmers, zero-Android team) is researching how to run an LLM fully offline (airplane mode) in an **Android Chrome PWA** (WebLLM/transformers.js + WebGPU) after caching weights once. This is the browser/PWA alternative to the primary Flutter + flutter_gemma native path.

**Why:** Wants on-device inference with no network dependency after first download. The PWA route avoids the team's lack of Android experience but introduces large-weight caching/eviction risk on mobile.

**How to apply:** When this project asks LLM-in-browser questions, recall these verified facts (June 2026):
- WebLLM default cache backend = **Cache API** (not IndexedDB); switch via `appConfig.cacheBackend = "indexeddb" | "cross-origin"`.
- transformers.js default browser cache = **Cache API** via `useBrowserCache`; uses ONNX (not GGUF). `useWasmCache` enables offline.
- Chrome quota = up to **60% of total disk per origin**; eviction is LRU and **skips origins that called `navigator.storage.persist()`**.
- Persistence is **granted heuristically by Chrome** (site engagement, installed/bookmarked, notification permission) — cannot be forced; verify with `navigator.storage.persisted()`. On Android, PWA shares storage with Chrome.
- q4 sizes (GGUF, estimate for ONNX/MLC): Llama 3.2 1B Q4_K_M ~0.81GB; Qwen2.5 1.5B ~1.12GB; Gemma 2 2B ~1.71GB; Phi-3.5 mini ~2.39GB.
- Do NOT precache multi-hundred-MB weights in SW install — use runtime caching. App shell must be separately precached for true offline.
- Open question: no official offline WebLLM *PWA* reference app found; OPFS not a documented default backend. See [[reference-browser-storage-llm-sources]].
