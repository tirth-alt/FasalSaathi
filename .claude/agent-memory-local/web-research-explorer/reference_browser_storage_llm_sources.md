---
name: reference-browser-storage-llm-sources
description: Canonical authoritative URLs for browser storage quotas/persistence and in-browser LLM (WebLLM, transformers.js) caching + GGUF model sizes.
metadata:
  type: reference
---

Vetted authoritative sources for browser-storage + on-device-LLM research (verified June 2026):

- WebLLM cache backends / offline: https://webllm.mlc.ai/docs/user/advanced_usage.html (states Cache API is default)
- WebLLM docs home: https://webllm.mlc.ai/docs/ ; examples dir: https://github.com/mlc-ai/web-llm/tree/main/examples
- transformers.js env/caching (authoritative for useBrowserCache/useWasmCache/cacheKey): https://huggingface.co/docs/transformers.js/en/api/env
- MDN storage quotas & eviction (60%/disk, LRU, persist() skips eviction): https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- web.dev storage-for-the-web (Chrome 80% browser / 60% origin, incognito ~5%): https://web.dev/articles/storage-for-the-web
- web.dev persistent-storage (grant heuristics: engagement, installed/bookmarked, notifications): https://web.dev/articles/persistent-storage
- Workbox precaching dos-and-donts (don't precache huge assets; use runtime caching): https://developer.chrome.com/docs/workbox/precaching-dos-and-donts
- GGUF q4 sizes: bartowski cards on huggingface.co (Llama-3.2-1B-Instruct-GGUF, gemma-2-2b-it-GGUF, Phi-3.5-mini-instruct-GGUF) and Qwen/Qwen2.5-1.5B-Instruct-GGUF.

Note: GGUF (llama.cpp) sizes are estimates for WebLLM (MLC) and transformers.js (ONNX) — not byte-identical. Verify exact payload against the runtime's own model repo. Related: [[project-offline-llm-pwa]].
