# Soil Report Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An on-device feature in the FasalSaathi RN app where Gemma 3n reads a soil report and explains — in Hindi — what it means, which fertilizer to apply, and which to stop, with RAG-first grounding and a voice answer.

**Architecture:** Pure-TS engine (`app/src/soil/`) does report parsing, lexical RAG over a bundled Hindi-agronomy KB, a router (RAG-confident → grounded prompt, else LLM-only), and prompt composition. A local Expo native module (`app/modules/soil-llm`) wraps MediaPipe `tasks-genai` running Gemma 3n E4B on-device. The engine takes an injected `LlmClient`, so it is tested on a PC against a dev client (Ollama/OpenRouter) and runs on-device via the native client in production. A new "Soil" tab drives capture → engine → Hindi TTS.

**Tech Stack:** TypeScript, React Native 0.85 / Expo SDK 56, jest + ts-jest (engine unit tests), MediaPipe `tasks-genai` (Kotlin), expo-image-picker, expo-speech, expo-file-system, EAS Build (cloud).

**Build model:** All of Phases 1–2 are pure TS — no native build, tested on PC. The native module + EAS build happen once in Phase 3; after that, all JS hot-reloads on the Vivo phone via `expo start --dev-client`.

---

## File Structure

```
app/
  jest.soil.config.js                 # node+ts-jest config scoped to src/soil
  package.json                        # + scripts/devDeps; + runtime deps
  app.json                            # + expo-dev-client, image-picker plugin
  eas.json                            # EAS dev/preview build profiles
  src/soil/
    types.ts                          # SoilReport, SoilSample, KbChunk, Answer, LlmClient, Lang
    sample.ts                         # SAMPLE_REPORT: pre-staged values for the demo PNG
    kb/chunks.ts                      # KB_CHUNKS: Hindi-agronomy KbChunk[]
    retriever.ts                      # retrieve(query, params) -> RetrievalResult
    router.ts                         # route(result) -> 'grounded' | 'llm-only'
    prompt.ts                         # composeExplain / composeAnswer (Hindi prompts)
    parse.ts                          # parseReportText(ocrText) -> SoilReport (best-effort)
    engine.ts                         # explainReport / answerQuestion (injects LlmClient)
    llm/devLlm.ts                     # OpenRouter/Ollama client (PC dev + tests)
    llm/nativeLlm.ts                  # LlmClient backed by the native module (on-device)
    __tests__/                        # retriever/router/parse/prompt/engine tests
  modules/soil-llm/                   # local Expo native module (created via CLI)
    android/.../SoilLlmModule.kt      # MediaPipe tasks-genai wrapper
    src/index.ts                      # JS bindings: init(path) / generate(prompt)
  src/soil/modelManager.ts            # downloads/locates the .task model on device
  src/screens/SoilScreen.tsx          # new tab UI
  App.tsx                             # register the Soil tab
```

---

## Phase 0 — Branch & test harness

### Task 0: Create working branch from the RN app

**Files:** none (git)

- [ ] **Step 1: Branch off `front-end` (which holds the real RN app)**

```bash
git checkout front-end
git checkout -b soil-engine
```

- [ ] **Step 2: Bring the design spec onto this branch**

```bash
git checkout AI-Layer -- docs/superpowers/specs/2026-06-14-soil-report-engine-design.md
git checkout AI-Layer -- docs/superpowers/plans/2026-06-14-soil-report-engine.md
git add docs/ && git commit -m "docs: bring soil engine spec+plan onto soil-engine branch"
```

Expected: `git log --oneline -1` shows the docs commit; `app/App.tsx` exists.

### Task 1: Engine test harness (jest + ts-jest, node)

**Files:**
- Create: `app/jest.soil.config.js`
- Modify: `app/package.json`

- [ ] **Step 1: Install dev deps**

Run (in `app/`):
```bash
npm i -D jest ts-jest @types/jest
```

- [ ] **Step 2: Create `app/jest.soil.config.js`**

```js
/** Engine-only tests: pure TS, node env, isolated from RN/babel. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/soil'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  globals: { 'ts-jest': { isolatedModules: true } },
};
```

- [ ] **Step 3: Add script to `app/package.json`** (inside `"scripts"`)

```json
"test:soil": "jest --config jest.soil.config.js"
```

- [ ] **Step 4: Smoke test the harness**

Create `app/src/soil/__tests__/smoke.test.ts`:
```ts
test('harness works', () => { expect(1 + 1).toBe(2); });
```
Run: `npm run test:soil`
Expected: 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add app/jest.soil.config.js app/package.json app/package-lock.json app/src/soil/__tests__/smoke.test.ts
git commit -m "test: add node/ts-jest harness for soil engine"
```

---

## Phase 1 — Engine core (pure TS, no native build)

### Task 2: Domain types

**Files:**
- Create: `app/src/soil/types.ts`

- [ ] **Step 1: Write `app/src/soil/types.ts`**

```ts
export type Lang = 'hi' | 'en';

export type SoilSample = {
  id: string;                          // e.g. "R1"
  pH?: number;
  cec?: number;                        // meq/100cm3
  baseSatPct?: number;                 // % base saturation (BS%)
  indices?: Record<string, number>;    // P-I, K-I, Mn-I, Zn-I, ...
  recommendations?: {
    limeTonsAcre?: number;
    N?: number; P2O5?: number; K2O?: number;  // lbs/acre
    [k: string]: number | undefined;
  };
};

export type SoilReport = {
  samples: SoilSample[];
  units: 'US' | 'metric';
  source: string;                      // human label of where it came from
};

export type KbChunk = {
  id: string;
  params: string[];                    // canonical params it covers: 'pH','P','K','lime',...
  keywords: string[];                  // free-text triggers (Hindi + English)
  text: string;                        // the advice, plain Hindi
};

export type RetrievalResult = { chunks: KbChunk[]; score: number };

export type Answer = { text: string; grounded: boolean; usedChunks: string[] };

export interface LlmClient {
  init(modelPath?: string): Promise<void>;
  generate(prompt: string, imageUri?: string): Promise<string>;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/soil/types.ts && git commit -m "feat(soil): domain types"
```

### Task 3: Pre-staged sample report (demo safety)

**Files:**
- Create: `app/src/soil/sample.ts`

- [ ] **Step 1: Write the failing test** — `app/src/soil/__tests__/sample.test.ts`

```ts
import { SAMPLE_REPORT } from '../sample';

test('sample report has the three demo samples with pH', () => {
  expect(SAMPLE_REPORT.samples.map((s) => s.id)).toEqual(['R1', 'R2', 'B1']);
  for (const s of SAMPLE_REPORT.samples) expect(typeof s.pH).toBe('number');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:soil -- sample`
Expected: FAIL (cannot find `../sample`).

- [ ] **Step 3: Write `app/src/soil/sample.ts`** (values transcribed from the demo PNG)

```ts
import type { SoilReport } from './types';

/** Pre-staged transcription of the NCDA&CS demo report. Guarantees the live
 *  demo never depends on OCR/vision succeeding. */
export const SAMPLE_REPORT: SoilReport = {
  source: 'NCDA&CS Predictive Soil Report (demo sample)',
  units: 'US',
  samples: [
    {
      id: 'R1', pH: 6.5, cec: 6.5, baseSatPct: 61,
      indices: { P: 120, K: 30, Mn: 245, Zn: 76, Cu: 118 },
      recommendations: { limeTonsAcre: 0, N: 120, P2O5: 0, K2O: 200 },
    },
    {
      id: 'R2', pH: 5.8, cec: 5.3, baseSatPct: 78,
      indices: { P: 31, K: 41, Mn: 302, Zn: 58 },
      recommendations: { limeTonsAcre: 0.3, N: 120, P2O5: 60, K2O: 200 },
    },
    {
      id: 'B1', pH: 6.0, cec: 7.8, baseSatPct: 78,
      indices: { P: 31, K: 41, Mn: 565, Zn: 71 },
      recommendations: { limeTonsAcre: 0, N: 100, P2O5: 0, K2O: 120 },
    },
  ],
};
```

> NOTE: verify each number against `soil report example.png` during execution; the
> table is dense. The structure is what matters — adjust digits to match the print.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:soil -- sample`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/soil/sample.ts app/src/soil/__tests__/sample.test.ts
git commit -m "feat(soil): pre-staged demo report values"
```

### Task 4: Knowledge base chunks

**Files:**
- Create: `app/src/soil/kb/chunks.ts`

- [ ] **Step 1: Write the failing test** — `app/src/soil/__tests__/kb.test.ts`

```ts
import { KB_CHUNKS } from '../kb/chunks';

test('KB covers the demo parameters', () => {
  const params = new Set(KB_CHUNKS.flatMap((c) => c.params));
  for (const p of ['pH', 'lime', 'P', 'K', 'Mn', 'Zn', 'cec', 'baseSat', 'N'])
    expect(params.has(p)).toBe(true);
});

test('every chunk has id, params, keywords, non-empty text', () => {
  for (const c of KB_CHUNKS) {
    expect(c.id).toBeTruthy();
    expect(c.params.length).toBeGreaterThan(0);
    expect(c.keywords.length).toBeGreaterThan(0);
    expect(c.text.trim().length).toBeGreaterThan(20);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:soil -- kb`
Expected: FAIL (cannot find `../kb/chunks`).

- [ ] **Step 3: Write `app/src/soil/kb/chunks.ts`**

```ts
import type { KbChunk } from '../types';

/** Hindi-first agronomy facts. `text` is written for a farmer, not an agronomist.
 *  Keep each chunk to one parameter and one clear "apply / stop" rule. */
export const KB_CHUNKS: KbChunk[] = [
  {
    id: 'ph-acidic',
    params: ['pH', 'lime'],
    keywords: ['ph', 'acidic', 'tezaab', 'खट्टी', 'चूना', 'lime', 'अम्लीय'],
    text: 'मिट्टी का pH 6.0 से कम है तो मिट्टी खट्टी (अम्लीय) है। इससे पौधा खाद पूरी तरह नहीं खींच पाता। चूना (lime) डालें — सिफारिश के टन/एकड़ के हिसाब से। pH 6.0–7.0 अधिकतर फसलों के लिए सही है।',
  },
  {
    id: 'ph-ok',
    params: ['pH'],
    keywords: ['ph', 'normal', 'theek', 'सही', 'संतुलित'],
    text: 'pH 6.0 से 7.0 के बीच है तो मिट्टी संतुलित है — चूना डालने की ज़रूरत नहीं। अनावश्यक चूना डालना बंद करें, इससे ज़िंक और मैंगनीज़ की कमी हो सकती है।',
  },
  {
    id: 'lime-zero',
    params: ['lime'],
    keywords: ['lime', 'चूना', 'tons', 'टन'],
    text: 'रिपोर्ट में Lime की सिफारिश 0 है तो इस खेत में चूना डालना बंद कर दें — pH पहले से ठीक है। पैसा बचेगा।',
  },
  {
    id: 'p-high',
    params: ['P'],
    keywords: ['phosphorus', 'फॉस्फोरस', 'p-i', 'dap', 'डीएपी', 'p2o5'],
    text: 'फॉस्फोरस इंडेक्स (P-I) 50 से ऊपर है तो मिट्टी में फॉस्फोरस भरपूर है। DAP/SSP जैसी फॉस्फोरस खाद डालना बंद करें — रिपोर्ट में P2O5 की सिफारिश भी 0 होगी। ज़्यादा फॉस्फोरस से ज़िंक की कमी होती है।',
  },
  {
    id: 'p-low',
    params: ['P'],
    keywords: ['phosphorus', 'फॉस्फोरस', 'कमी', 'low', 'dap', 'डीएपी'],
    text: 'फॉस्फोरस इंडेक्स कम (लगभग 25–50) है तो जड़ों की बढ़त के लिए फॉस्फोरस ज़रूरी है। रिपोर्ट में बताए गए P2O5 (lbs/एकड़) के हिसाब से DAP या SSP डालें।',
  },
  {
    id: 'k-low',
    params: ['K'],
    keywords: ['potassium', 'पोटाश', 'k-i', 'mop', 'एमओपी', 'k2o'],
    text: 'पोटैशियम इंडेक्स (K-I) कम है तो पोटाश डालें — MOP (म्यूरेट ऑफ पोटाश) रिपोर्ट के K2O के हिसाब से। पोटाश दाने भरने और रोग-सहनशीलता के लिए ज़रूरी है।',
  },
  {
    id: 'n-rec',
    params: ['N'],
    keywords: ['nitrogen', 'नाइट्रोजन', 'urea', 'यूरिया', 'n'],
    text: 'नाइट्रोजन (N) की सिफारिश lbs/एकड़ में है — यूरिया से दें, पर एक साथ नहीं; 2–3 बार में बाँटकर डालें ताकि बह न जाए। ज़्यादा यूरिया से फसल गिरती है और खर्च बढ़ता है।',
  },
  {
    id: 'mn-high',
    params: ['Mn'],
    keywords: ['manganese', 'मैंगनीज', 'mn-i', 'mn'],
    text: 'मैंगनीज़ इंडेक्स बहुत ऊँचा है तो अलग से मैंगनीज़ डालने की ज़रूरत नहीं — डालना बंद करें। बहुत खट्टी मिट्टी में मैंगनीज़ ज़हरीला हो सकता है, इसलिए चूने से pH ठीक रखें।',
  },
  {
    id: 'zn-status',
    params: ['Zn'],
    keywords: ['zinc', 'जिंक', 'ज़िंक', 'zn-i', 'zn'],
    text: 'ज़िंक इंडेक्स ठीक (लगभग 50 से ऊपर) है तो ज़िंक सल्फेट डालने की ज़रूरत नहीं। अगर इंडेक्स कम हो या फॉस्फोरस बहुत ज़्यादा हो, तो ज़िंक सल्फेट 10 किग्रा/एकड़ डालें।',
  },
  {
    id: 'cec-meaning',
    params: ['cec'],
    keywords: ['cec', 'सीईसी', 'capacity', 'धारण', 'खाद रोकने'],
    text: 'CEC मिट्टी की खाद रोकने की ताकत है। CEC कम (10 से नीचे) यानी रेतीली मिट्टी — खाद थोड़ी-थोड़ी, कई बार में दें वरना बह जाएगी।',
  },
  {
    id: 'base-sat',
    params: ['baseSat'],
    keywords: ['base saturation', 'बेस', 'bs%', 'संतृप्ति'],
    text: 'बेस सैचुरेशन (BS%) बताता है कि मिट्टी में कैल्शियम/मैग्नीशियम/पोटाश कितने भरे हैं। 60% से ऊपर अच्छा है। बहुत कम हो तो चूना/जिप्सम से सुधरता है।',
  },
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:soil -- kb`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/soil/kb/chunks.ts app/src/soil/__tests__/kb.test.ts
git commit -m "feat(soil): Hindi agronomy knowledge base"
```

### Task 5: Lexical RAG retriever

**Files:**
- Create: `app/src/soil/retriever.ts`

- [ ] **Step 1: Write the failing test** — `app/src/soil/__tests__/retriever.test.ts`

```ts
import { retrieve } from '../retriever';

test('matches by explicit param', () => {
  const r = retrieve('', ['lime']);
  expect(r.score).toBeGreaterThan(0);
  expect(r.chunks.some((c) => c.params.includes('lime'))).toBe(true);
});

test('matches by Hindi keyword in the query', () => {
  const r = retrieve('मेरी मिट्टी में फॉस्फोरस ज़्यादा है', []);
  expect(r.chunks.some((c) => c.params.includes('P'))).toBe(true);
});

test('no signal -> score 0, empty chunks', () => {
  const r = retrieve('namaste', []);
  expect(r.score).toBe(0);
  expect(r.chunks).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:soil -- retriever`
Expected: FAIL (cannot find `../retriever`).

- [ ] **Step 3: Write `app/src/soil/retriever.ts`**

```ts
import { KB_CHUNKS } from './kb/chunks';
import type { KbChunk, RetrievalResult } from './types';

const TOP_K = 3;

function norm(s: string): string {
  return s.toLowerCase().replace(/[।.,!?]/g, ' ');
}

/** Score = 2*paramMatches + keywordMatches. Params are exact tokens the caller
 *  already knows about the report; keywords are fuzzy hits in the query text. */
export function retrieve(query: string, params: string[]): RetrievalResult {
  const q = norm(query);
  const paramSet = new Set(params);

  const scored = KB_CHUNKS.map((c: KbChunk) => {
    const paramHits = c.params.filter((p) => paramSet.has(p)).length;
    const kwHits = c.keywords.filter((k) => q.includes(norm(k))).length;
    return { chunk: c, score: 2 * paramHits + kwHits };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    chunks: scored.slice(0, TOP_K).map((x) => x.chunk),
    score: scored.length ? scored[0].score : 0,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:soil -- retriever`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/soil/retriever.ts app/src/soil/__tests__/retriever.test.ts
git commit -m "feat(soil): lexical RAG retriever"
```

### Task 6: Router (RAG-first → LLM fallback)

**Files:**
- Create: `app/src/soil/router.ts`

- [ ] **Step 1: Write the failing test** — `app/src/soil/__tests__/router.test.ts`

```ts
import { route } from '../router';

test('confident retrieval -> grounded', () => {
  expect(route({ chunks: [{ id: 'x', params: ['pH'], keywords: ['ph'], text: 'a'.repeat(30) }], score: 2 })).toBe('grounded');
});

test('empty retrieval -> llm-only', () => {
  expect(route({ chunks: [], score: 0 })).toBe('llm-only');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:soil -- router`
Expected: FAIL.

- [ ] **Step 3: Write `app/src/soil/router.ts`**

```ts
import type { RetrievalResult } from './types';

const THRESHOLD = 1; // at least one real signal grounds the answer

export function route(result: RetrievalResult): 'grounded' | 'llm-only' {
  return result.chunks.length > 0 && result.score >= THRESHOLD ? 'grounded' : 'llm-only';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:soil -- router`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/soil/router.ts app/src/soil/__tests__/router.test.ts
git commit -m "feat(soil): RAG-first router"
```

### Task 7: Prompt composer

**Files:**
- Create: `app/src/soil/prompt.ts`

- [ ] **Step 1: Write the failing test** — `app/src/soil/__tests__/prompt.test.ts`

```ts
import { composeExplain, composeAnswer } from '../prompt';
import { SAMPLE_REPORT } from '../sample';

test('explain prompt embeds report JSON and demands Hindi + stop-list', () => {
  const p = composeExplain(SAMPLE_REPORT, 'hi');
  expect(p).toContain('R1');
  expect(p).toContain('हिंदी');
  expect(p.toLowerCase()).toContain('json');
});

test('answer prompt includes the question and grounding chunks', () => {
  const p = composeAnswer('फॉस्फोरस ज़्यादा है क्या करूँ?', SAMPLE_REPORT, ['ज़्यादा फॉस्फोरस से ज़िंक'], 'hi');
  expect(p).toContain('फॉस्फोरस ज़्यादा है क्या करूँ?');
  expect(p).toContain('ज़्यादा फॉस्फोरस से ज़िंक');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:soil -- prompt`
Expected: FAIL.

- [ ] **Step 3: Write `app/src/soil/prompt.ts`**

```ts
import type { SoilReport, Lang } from './types';

const SYSTEM_HI =
  'आप एक अनुभवी कृषि सलाहकार हैं जो किसान से सीधी, आसान हिंदी में बात करते हैं। ' +
  'तकनीकी शब्द कम से कम रखें। जवाब छोटा और साफ़ हो: (1) रिपोर्ट का मतलब, ' +
  '(2) कौन-सी खाद डालें, (3) कौन-सी खाद बंद करें। ज़रूरत न हो तो खाद न सुझाएँ।';

const LANG_LABEL: Record<Lang, string> = { hi: 'हिंदी', en: 'English' };

export function composeExplain(report: SoilReport, lang: Lang): string {
  return [
    SYSTEM_HI,
    `भाषा: सिर्फ़ ${LANG_LABEL[lang]} में जवाब दें।`,
    'नीचे मिट्टी रिपोर्ट JSON में है:',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    'इस रिपोर्ट को किसान को समझाइए: मतलब, कौन-सी खाद डालें, कौन-सी बंद करें।',
  ].join('\n');
}

export function composeAnswer(
  question: string,
  report: SoilReport,
  kbChunks: string[],
  lang: Lang,
): string {
  const grounding = kbChunks.length
    ? ['भरोसेमंद जानकारी (इसी के आधार पर जवाब दें):', ...kbChunks.map((c) => `- ${c}`)].join('\n')
    : 'कोई संग्रहित जानकारी नहीं मिली — अपनी कृषि समझ से जवाब दें।';
  return [
    SYSTEM_HI,
    `भाषा: सिर्फ़ ${LANG_LABEL[lang]} में जवाब दें।`,
    grounding,
    'रिपोर्ट:',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    `किसान का सवाल: ${question}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:soil -- prompt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/soil/prompt.ts app/src/soil/__tests__/prompt.test.ts
git commit -m "feat(soil): Hindi prompt composer"
```

### Task 8: Engine orchestration

**Files:**
- Create: `app/src/soil/engine.ts`

- [ ] **Step 1: Write the failing test** — `app/src/soil/__tests__/engine.test.ts`

```ts
import { explainReport, answerQuestion } from '../engine';
import { SAMPLE_REPORT } from '../sample';
import type { LlmClient } from '../types';

const fakeLlm = (capture: { prompt?: string }): LlmClient => ({
  async init() {},
  async generate(prompt: string) { capture.prompt = prompt; return 'जवाब'; },
});

test('explainReport sends an explain prompt and returns text', async () => {
  const cap: { prompt?: string } = {};
  const ans = await explainReport(SAMPLE_REPORT, { llm: fakeLlm(cap), lang: 'hi' });
  expect(ans.text).toBe('जवाब');
  expect(cap.prompt).toContain('R1');
});

test('answerQuestion grounds when KB matches the question', async () => {
  const cap: { prompt?: string } = {};
  const ans = await answerQuestion('फॉस्फोरस ज़्यादा है क्या करूँ?', SAMPLE_REPORT, { llm: fakeLlm(cap), lang: 'hi' });
  expect(ans.grounded).toBe(true);
  expect(ans.usedChunks.length).toBeGreaterThan(0);
});

test('answerQuestion falls back to llm-only when no KB match', async () => {
  const cap: { prompt?: string } = {};
  const ans = await answerQuestion('आज मौसम कैसा है?', SAMPLE_REPORT, { llm: fakeLlm(cap), lang: 'hi' });
  expect(ans.grounded).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:soil -- engine`
Expected: FAIL.

- [ ] **Step 3: Write `app/src/soil/engine.ts`**

```ts
import type { Answer, LlmClient, Lang, SoilReport } from './types';
import { retrieve } from './retriever';
import { route } from './router';
import { composeExplain, composeAnswer } from './prompt';

export type EngineOpts = { llm: LlmClient; lang: Lang };

/** Canonical params present in a report, used to seed retrieval. */
function reportParams(report: SoilReport): string[] {
  const out = new Set<string>();
  for (const s of report.samples) {
    if (s.pH != null) out.add('pH');
    if (s.cec != null) out.add('cec');
    if (s.baseSatPct != null) out.add('baseSat');
    if (s.recommendations?.limeTonsAcre != null) out.add('lime');
    if (s.recommendations?.N != null) out.add('N');
    for (const k of Object.keys(s.indices ?? {})) out.add(k); // P, K, Mn, Zn...
  }
  return [...out];
}

export async function explainReport(report: SoilReport, opts: EngineOpts): Promise<Answer> {
  const text = await opts.llm.generate(composeExplain(report, opts.lang));
  return { text, grounded: false, usedChunks: [] };
}

export async function answerQuestion(question: string, report: SoilReport, opts: EngineOpts): Promise<Answer> {
  const result = retrieve(question, reportParams(report));
  const mode = route(result);
  const chunks = mode === 'grounded' ? result.chunks.map((c) => c.text) : [];
  const text = await opts.llm.generate(composeAnswer(question, report, chunks, opts.lang));
  return { text, grounded: mode === 'grounded', usedChunks: result.chunks.map((c) => c.id) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:soil -- engine`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/soil/engine.ts app/src/soil/__tests__/engine.test.ts
git commit -m "feat(soil): engine orchestration (RAG -> router -> LLM)"
```

### Task 9: OCR text parser (best-effort, for live extraction stretch)

**Files:**
- Create: `app/src/soil/parse.ts`

- [ ] **Step 1: Write the failing test** — `app/src/soil/__tests__/parse.test.ts`

```ts
import { parseReportText } from '../parse';

test('pulls pH and a sample id out of OCR-like text', () => {
  const ocr = 'Sample ID: R1  pH 6.5  CEC 6.5  Lime 0.0 N 120 P2O5 0 K2O 200';
  const report = parseReportText(ocr);
  expect(report.samples[0].id).toBe('R1');
  expect(report.samples[0].pH).toBe(6.5);
  expect(report.samples[0].recommendations?.N).toBe(120);
});

test('no recognizable fields -> empty samples', () => {
  expect(parseReportText('garbage').samples).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:soil -- parse`
Expected: FAIL.

- [ ] **Step 3: Write `app/src/soil/parse.ts`**

```ts
import type { SoilReport, SoilSample } from './types';

const num = (re: RegExp, s: string): number | undefined => {
  const m = s.match(re);
  return m ? Number(m[1]) : undefined;
};

/** Best-effort single-sample parse from a flat OCR string. Multi-sample tables
 *  are out of scope for the demo; the pre-staged SAMPLE_REPORT covers that. */
export function parseReportText(text: string): SoilReport {
  const id = text.match(/Sample\s*(?:ID)?[:\s]+([A-Z]\d)/i)?.[1];
  const pH = num(/pH\s+([\d.]+)/i, text);
  const cec = num(/CEC\s+([\d.]+)/i, text);
  const N = num(/\bN\s+([\d.]+)/i, text);
  const P2O5 = num(/P2O5\s+([\d.]+)/i, text);
  const K2O = num(/K2O\s+([\d.]+)/i, text);
  const limeTonsAcre = num(/Lime\s+([\d.]+)/i, text);

  if (id == null && pH == null) return { samples: [], units: 'US', source: 'OCR' };
  const sample: SoilSample = {
    id: id ?? 'S1', pH, cec,
    recommendations: { N, P2O5, K2O, limeTonsAcre },
  };
  return { samples: [sample], units: 'US', source: 'OCR' };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:soil -- parse`
Expected: PASS.

- [ ] **Step 5: Commit + run full suite**

```bash
npm run test:soil
git add app/src/soil/parse.ts app/src/soil/__tests__/parse.test.ts
git commit -m "feat(soil): best-effort OCR report parser"
```

Expected: full suite green (sample, kb, retriever, router, prompt, engine, parse).

---

## Phase 2 — Dev LLM client (validate prompt quality on PC, no phone yet)

### Task 10: Dev LLM client (Ollama / OpenRouter)

**Files:**
- Create: `app/src/soil/llm/devLlm.ts`
- Create: `app/scripts/soil-dev.ts`

- [ ] **Step 1: Write `app/src/soil/llm/devLlm.ts`**

```ts
import type { LlmClient } from '../types';

/** PC-only client used to validate prompts/RAG before the native module exists.
 *  Defaults to a local Ollama gemma3n; set OPENROUTER_API_KEY to use OpenRouter. */
export class DevLlm implements LlmClient {
  async init() {}
  async generate(prompt: string): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (key) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemma-3n-e4b-it', messages: [{ role: 'user', content: prompt }] }),
      });
      const j = await res.json();
      return j.choices?.[0]?.message?.content ?? '';
    }
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemma3n:e4b', prompt, stream: false }),
    });
    const j = await res.json();
    return j.response ?? '';
  }
}
```

- [ ] **Step 2: Write `app/scripts/soil-dev.ts`** (manual end-to-end check)

```ts
import { DevLlm } from '../src/soil/llm/devLlm';
import { explainReport, answerQuestion } from '../src/soil/engine';
import { SAMPLE_REPORT } from '../src/soil/sample';

(async () => {
  const llm = new DevLlm();
  console.log('--- EXPLAIN ---');
  console.log((await explainReport(SAMPLE_REPORT, { llm, lang: 'hi' })).text);
  console.log('--- Q: फॉस्फोरस ज़्यादा है क्या करूँ? ---');
  console.log((await answerQuestion('मेरी रिपोर्ट में फॉस्फोरस ज़्यादा है, क्या करूँ?', SAMPLE_REPORT, { llm, lang: 'hi' })).text);
})();
```

- [ ] **Step 3: Run it (requires Ollama running OR OPENROUTER_API_KEY set)**

Run (in `app/`): `npx tsx scripts/soil-dev.ts`
Expected: two Hindi answers; the second explains stopping DAP because P is high. **Read the output and tune `prompt.ts` wording if the advice is wrong**, re-running until the Hindi reads naturally for a farmer.

- [ ] **Step 4: Commit**

```bash
git add app/src/soil/llm/devLlm.ts app/scripts/soil-dev.ts
git commit -m "feat(soil): dev LLM client + manual e2e script"
```

---

## Phase 3 — On-device native module + EAS build (one cloud build)

### Task 11: Scaffold the local Expo native module

**Files:**
- Create: `app/modules/soil-llm/**` (via CLI)

- [ ] **Step 1: Generate the module**

Run (in `app/`):
```bash
npx create-expo-module@latest --local soil-llm
```
When prompted, accept defaults (package `expo.modules.soilllm` is fine).

- [ ] **Step 2: Verify it created `app/modules/soil-llm/android` and `app/modules/soil-llm/src/index.ts`.**

- [ ] **Step 3: Commit the scaffold**

```bash
git add app/modules/soil-llm
git commit -m "chore(soil): scaffold local soil-llm native module"
```

### Task 12: Implement the MediaPipe wrapper (Kotlin)

**Files:**
- Modify: `app/modules/soil-llm/android/build.gradle`
- Replace: `app/modules/soil-llm/android/src/main/java/expo/modules/soilllm/SoilLlmModule.kt`
- Replace: `app/modules/soil-llm/src/index.ts`

- [ ] **Step 1: Add the MediaPipe dependency** — append to `dependencies {}` in `app/modules/soil-llm/android/build.gradle`

```gradle
implementation("com.google.mediapipe:tasks-genai:0.10.24")
```

> If the build later reports Gemma 3n is unsupported, bump this to the newest
> `tasks-genai` release and rebuild (Task 14).

- [ ] **Step 2: Write `SoilLlmModule.kt`**

```kotlin
package expo.modules.soilllm

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInference.LlmInferenceOptions

class SoilLlmModule : Module() {
  private var llm: LlmInference? = null

  override fun definition() = ModuleDefinition {
    Name("SoilLlm")

    AsyncFunction("init") { modelPath: String ->
      val ctx = appContext.reactContext ?: throw Exception("No context")
      val options = LlmInferenceOptions.builder()
        .setModelPath(modelPath)
        .setMaxTokens(1024)
        .build()
      llm = LlmInference.createFromOptions(ctx, options)
      true
    }

    AsyncFunction("generate") { prompt: String ->
      val engine = llm ?: throw Exception("Model not initialized")
      engine.generateResponse(prompt)
    }
  }
}
```

- [ ] **Step 3: Write the JS bindings `app/modules/soil-llm/src/index.ts`**

```ts
import { requireNativeModule } from 'expo-modules-core';

const SoilLlm = requireNativeModule('SoilLlm');

export function init(modelPath: string): Promise<boolean> {
  return SoilLlm.init(modelPath);
}
export function generate(prompt: string): Promise<string> {
  return SoilLlm.generate(prompt);
}
```

- [ ] **Step 4: Commit**

```bash
git add app/modules/soil-llm
git commit -m "feat(soil): MediaPipe tasks-genai wrapper (Gemma 3n)"
```

### Task 13: Native LlmClient + model manager

**Files:**
- Create: `app/src/soil/llm/nativeLlm.ts`
- Create: `app/src/soil/modelManager.ts`

- [ ] **Step 1: Install file-system dep**

Run (in `app/`): `npx expo install expo-file-system`

- [ ] **Step 2: Write `app/src/soil/modelManager.ts`**

```ts
import * as FileSystem from 'expo-file-system';

/** Where the Gemma 3n .task lives on the device. The app downloads it on first
 *  launch (APK can't bundle 3.7 GB). Replace MODEL_URL with your hosted file,
 *  OR side-load once with: adb push gemma-3n-E4B-it.task <printed localPath>. */
const MODEL_URL = 'https://REPLACE_WITH_YOUR_HOSTED_MODEL/gemma-3n-E4B-it.task';
const FILENAME = 'gemma-3n-E4B-it.task';

export function modelPath(): string {
  return FileSystem.documentDirectory + FILENAME;
}

export async function ensureModel(onProgress?: (pct: number) => void): Promise<string> {
  const path = modelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) return path;
  const dl = FileSystem.createDownloadResumable(MODEL_URL, path, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0)
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  await dl.downloadAsync();
  return path;
}
```

- [ ] **Step 3: Write `app/src/soil/llm/nativeLlm.ts`**

```ts
import type { LlmClient } from '../types';
import { init as nativeInit, generate as nativeGenerate } from '../../../modules/soil-llm/src';
import { ensureModel } from '../modelManager';

export class NativeLlm implements LlmClient {
  private ready = false;
  async init(modelPath?: string) {
    const path = modelPath ?? (await ensureModel());
    await nativeInit(path);
    this.ready = true;
  }
  async generate(prompt: string): Promise<string> {
    if (!this.ready) await this.init();
    return nativeGenerate(prompt);
  }
}
```

- [ ] **Step 4: Type-check (no runtime — native module only resolves on device)**

Run (in `app/`): `npx tsc --noEmit`
Expected: no type errors in `src/soil`.

- [ ] **Step 5: Commit**

```bash
git add app/src/soil/llm/nativeLlm.ts app/src/soil/modelManager.ts app/package.json app/package-lock.json
git commit -m "feat(soil): on-device LlmClient + model manager"
```

### Task 14: EAS dev-client config + first cloud build

**Files:**
- Modify: `app/app.json`
- Create: `app/eas.json`
- Modify: `app/package.json`

- [ ] **Step 1: Install dev-client + EAS CLI**

Run (in `app/`):
```bash
npx expo install expo-dev-client expo-image-picker expo-speech
npm i -g eas-cli
```

- [ ] **Step 2: Add plugins to `app/app.json`** (inside `expo`)

```json
"plugins": ["expo-dev-client", "expo-image-picker"]
```

- [ ] **Step 3: Create `app/eas.json`**

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

- [ ] **Step 4: Log in and start the cloud build (long pole — do this early)**

Run (in `app/`):
```bash
eas login
eas build --profile development --platform android
```
Expected: a build URL; on completion an **APK install link/QR**.

- [ ] **Step 5: Install the APK on the Vivo phone via the link, then start the bundler**

Run (in `app/`): `npx expo start --dev-client`
Expected: QR code; scanning on the phone loads the JS bundle in the dev client.

- [ ] **Step 6: Place the model on the device** (one-time, if not hosting MODEL_URL)

```bash
adb push gemma-3n-E4B-it.task /sdcard/Android/data/<app-package>/files/gemma-3n-E4B-it.task
```
(Or host it and let `ensureModel()` download on first launch.)

- [ ] **Step 7: Commit config**

```bash
git add app/app.json app/eas.json app/package.json app/package-lock.json
git commit -m "chore(soil): EAS dev-client build config + native deps"
```

---

## Phase 4 — Soil screen + voice (JS only, hot-reloads on device)

### Task 15: Soil screen wired to the engine

**Files:**
- Create: `app/src/screens/SoilScreen.tsx`

- [ ] **Step 1: Write `app/src/screens/SoilScreen.tsx`**

```tsx
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { Camera } from 'lucide-react-native';
import { Card } from '../ui';
import { Touchable } from '../primitives';
import { colors } from '../theme';
import { MicButton } from '../MicButton';
import { SAMPLE_REPORT } from '../soil/sample';
import { explainReport, answerQuestion } from '../soil/engine';
import { NativeLlm } from '../soil/llm/nativeLlm';

const llm = new NativeLlm();

export default function SoilScreen() {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [listening, setListening] = useState(false);

  const speak = (t: string) => Speech.speak(t, { language: 'hi-IN' });

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setAnswer('');
    try {
      const text = await fn();
      setAnswer(text);
      speak(text);
    } catch (e: any) {
      setAnswer('माफ़ कीजिए, अभी जवाब नहीं बन पाया: ' + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function pickAndExplain() {
    // Image is captured for the demo; extraction uses the pre-staged report.
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    await run(() => explainReport(SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));
  }

  return (
    <View style={{ gap: 18, paddingBottom: 24 }}>
      <View style={{ gap: 4, paddingTop: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>मिट्टी रिपोर्ट</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>रिपोर्ट की फोटो डालें या सवाल पूछें</Text>
      </View>

      <Touchable onPress={pickAndExplain} pressScale={0.97}>
        <View style={{ backgroundColor: colors.accent, borderRadius: 20, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 96 }}>
          <Camera size={28} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>रिपोर्ट की फोटो से समझें</Text>
        </View>
      </Touchable>

      <View style={{ alignItems: 'center' }}>
        <MicButton
          listening={listening}
          onToggle={() => {
            setListening((v) => !v);
            // STT wired in Task 16; demo question for now:
            if (!listening) run(() => answerQuestion('मेरी रिपोर्ट में फॉस्फोरस ज़्यादा है, क्या करूँ?', SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));
          }}
        />
      </View>

      {busy && <ActivityIndicator color={colors.accent} />}
      {!!answer && (
        <Card>
          <Text style={{ fontSize: 16, lineHeight: 24, color: colors.ink }}>{answer}</Text>
        </Card>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify on device** — reload the dev client, open the Soil tab (after Task 17), tap "रिपोर्ट की फोटो से समझें". Expected: spinner, then a Hindi explanation appears and is spoken.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/SoilScreen.tsx
git commit -m "feat(soil): Soil screen (photo -> explain, mic -> answer, Hindi TTS)"
```

### Task 16: Voice input (STT)

**Files:**
- Modify: `app/src/screens/SoilScreen.tsx`
- Modify: `app/package.json`

- [ ] **Step 1: Install STT**

Run (in `app/`): `npx expo install @react-native-voice/voice`

> Requires another EAS dev build (native dep). Batch this with any other native
> change to avoid a second cloud-build wait.

- [ ] **Step 2: Replace the MicButton handler in `SoilScreen.tsx`** with real STT

```tsx
import Voice from '@react-native-voice/voice';
// inside the component:
async function toggleMic() {
  if (listening) {
    await Voice.stop();
    setListening(false);
    return;
  }
  Voice.onSpeechResults = (e) => {
    const q = e.value?.[0];
    if (q) run(() => answerQuestion(q, SAMPLE_REPORT, { llm, lang: 'hi' }).then((a) => a.text));
  };
  setListening(true);
  await Voice.start('hi-IN');
}
```
Wire `onToggle={toggleMic}` on `<MicButton />` and remove the placeholder demo-question handler.

- [ ] **Step 3: Verify on device** — tap mic, say *"फॉस्फोरस ज़्यादा है क्या करूँ"*, expect a spoken Hindi answer about stopping DAP.

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/SoilScreen.tsx app/package.json app/package-lock.json
git commit -m "feat(soil): Hindi voice questions via on-device STT"
```

### Task 17: Register the Soil tab

**Files:**
- Modify: `app/App.tsx`

- [ ] **Step 1: Add the tab.** In `app/App.tsx`: import `SoilScreen` and the `Sprout` icon from `lucide-react-native`; add `{ id: 'soil' as TabKey, label: 'मिट्टी', Icon: Sprout }` to `TABS`; render `{tab === 'soil' && <SoilScreen />}` in the body. Add `'soil'` to the `TabKey` union in `app/src/theme.ts`.

```tsx
import { Sprout } from 'lucide-react-native';
import SoilScreen from './src/screens/SoilScreen';
// TABS: add -> { id: 'soil' as TabKey, label: 'मिट्टी', Icon: Sprout },
// body: add -> {tab === 'soil' && <SoilScreen />}
```

- [ ] **Step 2: Update `TabKey` in `app/src/theme.ts`**

Find the `TabKey` type and add `| 'soil'`.

- [ ] **Step 3: Verify** — reload dev client; a "मिट्टी" tab appears and opens the Soil screen.

- [ ] **Step 4: Commit**

```bash
git add app/App.tsx app/src/theme.ts
git commit -m "feat(soil): add मिट्टी tab"
```

---

## Phase 5 — Demo polish

### Task 18: End-to-end demo rehearsal + guardrails

**Files:**
- Modify: `app/src/screens/SoilScreen.tsx` (only if issues found)

- [ ] **Step 1:** Run the full engine suite: `npm run test:soil` — expect all green.
- [ ] **Step 2:** On the Vivo phone, rehearse the exact demo flow: open मिट्टी tab → photo path → Hindi explanation spoken; mic → spoken question → spoken answer that names a fertilizer to **stop** (DAP) and one to **apply** (urea/MOP per N/K).
- [ ] **Step 3:** Confirm latency is acceptable; if slow, lower `setMaxTokens` (Task 12) and shorten the system prompt, then JS-reload (the maxTokens change needs a rebuild only if you change Kotlin — prompt change is JS).
- [ ] **Step 4:** Verify the fallback: with airplane mode + model already present, the flow still works fully offline (proves on-device).
- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "chore(soil): demo rehearsal fixes"
```

---

## Self-Review

**Spec coverage:**
- On-device LLM only → Tasks 11–14 (MediaPipe Gemma 3n, EAS dev build). ✓
- RAG-first → LLM fallback → Tasks 5,6,8 (retriever/router/engine). ✓
- Inputs: image + voice → Tasks 15 (image), 16 (STT). ✓
- Outputs: Hindi text + TTS → Tasks 7,15 (prompt Hindi, expo-speech). ✓
- Demo safety (pre-staged sample) → Task 3. ✓
- Dev-only PC scaffolding → Task 10. ✓
- Apply / stop fertilizer advice → KB chunks (Task 4) + prompt (Task 7). ✓

**Placeholder scan:** `MODEL_URL` in Task 13 is a deployment config value with a fully-specified `adb push` alternative — not a logic gap. Sample-report digits carry a verify-against-PNG note. No `TODO`/`TBD` logic stubs.

**Type consistency:** `LlmClient.{init,generate}` consistent across `devLlm`, `nativeLlm`, fake in tests, and `engine` (Tasks 2,8,10,13). `SoilReport`/`SoilSample` shape consistent across `sample`, `parse`, `engine`, `prompt`. `retrieve` returns `RetrievalResult` consumed by `route` and `engine`. ✓

**Note on TDD scope:** Pure-TS engine (Phases 1–2) is full TDD. Native module + RN screen (Phases 3–4) use build-once + on-device verification steps, since they can't run under the node test harness.
