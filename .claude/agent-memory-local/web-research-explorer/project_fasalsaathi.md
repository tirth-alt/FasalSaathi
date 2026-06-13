---
name: project-fasalsaathi
description: FasalSaathi — 30hr hackathon, voice-first vernacular AI assistant for Indian farmers, on-device LLM on flagship Android (iQOO Snapdragon 8-series)
metadata:
  type: project
---

FasalSaathi is a 30-hour hackathon project: a voice-first vernacular (Hindi/Indian language) AI assistant for Indian farmers, demoed on a flagship Android phone (iQOO, Snapdragon 8-series, Adreno GPU / Hexagon NPU). Must run an on-device LLM.

**Why:** Hackathon constraints — limited time, must demo on-device (offline) inference visibly in the UI. Team has ZERO Android development experience and relies heavily on AI coding assistants.

**How to apply:** Recommendations must favor the fastest reliable path for a no-Android-experience team, not the theoretically optimal architecture. Flutter + flutter_gemma is the de-facto recommended path (wraps MediaPipe, single Dart API). Default to Gemma 3 1B int4 (.task, ~500MB) as the on-device model. For voice, Vosk (Hindi small model 42MB, offline) + Android TextToSpeech (hi-IN) is the pragmatic offline stack; Bhashini is cloud/online. Flag GPU-vs-CPU decode as device-dependent (GPU sometimes slower).

**Data sources (researched 2026-06-13, see [[reference-indian-agri-data-apis]]):** App also needs real mandi prices, district weather, WDRA warehouse directory, and eNWR pledge-loan "sell-or-store" math. Demo-reliability verdict: Open-Meteo (weather) and Sarvam AI (cloud vernacular voice) are demo-SAFE live. data.gov.in Agmarknet was returning 502 Bad Gateway on 2026-06-13 (whole platform down) — MUST cache/snapshot mandi prices, do not call live. CEDA mirror has a real API but only monthly cadence. WDRA has no API (scrape PDF). Bhashini works but flaky/poorly documented vs Sarvam.
