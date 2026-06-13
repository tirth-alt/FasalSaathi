---
name: reference-browser-llm-mobile
description: Authoritative sources and verified facts on in-browser LLM inference (WebLLM, transformers.js) via WebGPU, with emphasis on mobile/Android constraints
metadata:
  type: reference
---

Research topic for FasalSaathi: running small LLMs in the browser on mobile via WebGPU.

## Canonical sources
- WebLLM model list (exact model_id, vram_required_MB, low_resource_required): https://github.com/mlc-ai/web-llm/blob/main/src/config.ts (raw: raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts)
- WebLLM npm version: https://www.npmjs.com/package/@mlc-ai/web-llm (note: npmjs.com returns 403 to WebFetch; use GitHub releases instead: https://github.com/mlc-ai/web-llm/releases)
- transformers.js v3 launch blog: https://huggingface.co/blog/transformersjs-v3
- transformers.js WebGPU guide: https://huggingface.co/docs/transformers.js/guides/webgpu

## Key mobile-constraint issues (WebLLM)
- #209 maxStorageBufferBindingSize too small on Android (Pixel 7): https://github.com/mlc-ai/web-llm/issues/209
- #524 Gemma 2 2B crashes Chrome on Pixel 6a (6GB RAM): https://github.com/mlc-ai/web-llm/issues/524
- transformers.js Android WebGPU crashes: issues #1205, #1469, #943, #1518 on github.com/huggingface/transformers.js

## Verified facts (as of 2026-06)
- WebGPU shipped by default on Android Chrome 121 (Jan 2024), Android 12+, Qualcomm/ARM GPUs.
- Adreno mobile WebGPU: maxStorageBufferBindingSize / maxBufferSize commonly capped at 128 MiB (spec default minimum), vs much higher on desktop.
- Chrome reportedly caps ~4GB VRAM per tab on desktop — 7-8B q4 sits at that edge.
- Safest mobile in-browser bets (small, low_resource_required=true, fits 128MiB buffer + low VRAM): Qwen2.5-0.5B-q4f16 (~945MB), Llama-3.2-1B-q4f16 (~879MB), SmolLM2-360M-q4f16 (~376MB), SmolLM2-1.7B-q4f16 (~1774MB).
- Gemma-2-2b and Phi-3.5-mini full-context variants are low_resource_required=false (riskier on mobile); 1k-context variants exist and are flagged low_resource.

## Caveat
- No official WebLLM tokens/sec benchmark table for mobile exists; mobile numbers in the wild are mostly native llama.cpp/MLC, not browser WebGPU. Treat browser-mobile throughput as largely unbenchmarked/anecdotal.
