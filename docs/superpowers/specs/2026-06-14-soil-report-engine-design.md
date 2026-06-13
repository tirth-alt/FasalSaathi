# Soil Report Engine — Design

**Date:** 2026-06-14
**Branch target:** `AI-Layer` (engine) integrating into the `front-end` RN app
**Status:** Design — pending user review

## 1. Goal

A farmer points the app at a soil report (or asks a spoken question) and gets a
plain, native-language explanation of **what the report means**, **which
fertilizer to apply**, and **which to stop using** — running **fully on-device**.

Demo input is a fixed sample: an NCDA&CS *Predictive Soil Report* (Mehlich-3),
samples R1/R2/B1, with pH, CEC, base-saturation %, nutrient indices (P-I, K-I,
Mn-I…) and a Recommendations block (lime tons/acre, N, P₂O₅, K₂O lbs/acre).

## 2. Hard constraints (locked with user)

- **On-device LLM only.** Gemma 3n E4B-it runs *on the phone* via Google AI Edge /
  MediaPipe `tasks-genai`. No PC/cloud server. Phone is **not** a thin client.
- **Not** a self-installed (Termux/llama.cpp) model — use the managed AI Edge runtime.
- **RAG-first → LLM fallback:** answer from a local knowledge base when it has the
  info; fall back to the on-device LLM's own knowledge when retrieval is thin.
- **Inputs:** soil-report image **and** voice question in native language.
- **Outputs:** native-language explanation (Hindi for demo), spoken (TTS) + text.
- PC-side Ollama/OpenRouter is **dev-only** scaffolding to test prompts/RAG; never ships.

## 3. Host app reality

- `front-end` branch: **Expo managed**, SDK ~56, RN 0.85, React 19.2, TS. Tabs:
  Home / Prices / Sell-Store / Learn. `MicButton` exists (animation only, no STT).
- **Consequence:** MediaPipe is native → must `expo prebuild` + custom dev client
  (`expo run:android`). **Prerequisite: Android Studio + SDK/NDK on the build machine.**
  This is the top feasibility risk for the 7-hour window.

## 4. Architecture

```
 Report photo ──▶ Extraction ──▶ SoilReport (structured)
                                      │
 Voice ─▶ STT ─▶ question ───────────▶├─▶ RAG retrieve(question + params)
                                      │        │
                                      │   score ≥ τ ?  ──yes──▶ grounded prompt (KB context)
                                      │        └────no────────▶ LLM-only prompt
                                      ▼                              │
                              Prompt Composer ◀──────────────────────┘
                                      │
                          on-device Gemma 3n (native module)
                                      │
                          native-language answer ─▶ TTS + on-screen text
```

## 5. Components & interfaces

All engine logic is **pure TypeScript** in `app/src/soil/` (unit-testable, model-agnostic);
only the LLM client is native.

1. **Knowledge Base** — `app/src/soil/kb/*` : curated Indian-agronomy chunks (pH bands,
   N/P/K/S/Zn/B/Mn meaning, CEC, base saturation, lime guidance, apply-vs-**stop** rules).
   Each chunk tagged `{ params: string[], keywords: string[], text }`.
2. **Report Extraction** — `extractReport(input) → SoilReport`.
   - Primary: Gemma 3n vision (native `generate(prompt, imageUri)` → JSON).
   - Fallback: ML Kit on-device OCR → `parseReportText`.
   - Demo safety: **pre-staged `SoilReport` JSON for the exact sample PNG.**
3. **RAG Retriever** — `retrieve(query, params) → { chunks, score }`. Lexical scoring
   (token overlap + parameter match). No embedding model (avoids native packaging risk).
4. **Router** — `score ≥ τ` → build grounded prompt with KB chunks; else LLM-only prompt.
5. **LLM Client (native module)** — `NativeSoilLLM`: `init(modelPath)`,
   `generate(prompt, imageUri?) → string`. Wraps MediaPipe `tasks-genai` LlmInference +
   Gemma 3n E4B; exposed to JS via an Expo native module.
6. **Prompt Composer** — `composeExplain(report, lang)` and
   `composeAnswer(question, report, kbChunks, lang)`. Native-language system prompt.
7. **Voice I/O** — STT (`@react-native-voice/voice` or `expo-speech-recognition`) →
   query; TTS (`expo-speech`) speaks the answer. Hindi.
8. **Soil screen (RN)** — new tab/screen: capture/pick photo, reuse `MicButton`, render
   explanation, speak it, support follow-up questions (chat-style).

### Core types

```ts
type SoilSample = {
  id: string; pH?: number; cec?: number; baseSatPct?: number;
  indices?: Record<string, number>;            // P-I, K-I, Mn-I, ...
  recommendations?: { limeTonsAcre?: number; N?: number; P2O5?: number; K2O?: number; [k: string]: number | undefined };
};
type SoilReport = { samples: SoilSample[]; units: 'US' | 'metric'; source: string };
type KbChunk = { id: string; params: string[]; keywords: string[]; text: string };
type Answer = { text: string; grounded: boolean; usedChunks: string[] };
interface LlmClient { init(modelPath: string): Promise<void>; generate(prompt: string, imageUri?: string): Promise<string>; }
```

## 6. Error handling / degradation

| Failure | Degradation |
|---|---|
| Model not loaded / OOM | Friendly message; offer text-only retry / smaller model |
| Vision extraction fails | ML Kit OCR → parser |
| OCR fails | Pre-staged demo values / manual entry |
| RAG empty | LLM-only prompt |
| STT unavailable | Text input box |
| TTS unavailable | Text answer only |

## 7. Testing

- Pure-TS modules (`retrieve`, `parseReportText`, prompt composers, router threshold)
  unit-tested with the sample report as a fixture (jest).
- Dev loop: run RAG + prompts in Node against Ollama `gemma3n:e4b` / OpenRouter
  `google/gemma-3n-e4b-it` (same model family) **before** the native module is ready,
  so prompt quality is validated independently of the Android build.

## 8. Scope

**Demo-critical path (must work):**
1. Soil screen with photo input + sample-report flow.
2. Pre-staged `SoilReport` for the sample PNG (guaranteed extraction).
3. RAG + router + prompt composer (pure TS).
4. Native MediaPipe Gemma 3n module → Hindi explanation **on-device**.
5. TTS speaks the answer; text shown.

**Stretch (only if time):** live Gemma-vision extraction, ML Kit OCR, voice (STT)
questions, multi-sample reasoning, additional languages.

## 9. Risks

1. **Expo prebuild + dev client build** (Android Studio/NDK) — top risk; gates the whole
   on-device path. Verify the build machine early.
2. **Gemma 3n `.litertlm` ↔ `tasks-genai` version** compatibility.
3. **On-device inference latency** (E4B) — keep answers short; stream if supported.
4. **On-device image input** — if it fights us, fall back to OCR; demo uses pre-staged values.

## 10. Open prerequisite

Confirm the build machine has **Android Studio + Android SDK/NDK** and a device/emulator
for `expo run:android`. Without it, the on-device path cannot be demonstrated.
