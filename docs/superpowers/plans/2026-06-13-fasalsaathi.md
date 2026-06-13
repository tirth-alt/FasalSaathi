# FasalSaathi — Technical PRD & 30-Hour Execution Plan

> **For agentic workers:** This is a hackathon technical PRD, not a TDD task-by-task plan. It fixes the stack, architecture, AI design, data strategy, hour-by-hour schedule, and demo. Execute phase-by-phase; write tests where they protect the demo (decision-engine math, data parsing), not everywhere.

**Goal:** Ship a voice-first, vernacular, on-device AI agent for the Indian farmer's post-harvest "sell-or-store" decision, demoable offline on the loaner iQOO phone in 30 hours, with a companion OfficeKit operator dashboard on the laptop.

**Architecture:** A Flutter Android app running **Gemma 3 1B int4 on-device** (via `flutter_gemma`/MediaPipe) as the reasoning core, orchestrating a multi-agent pipeline (Price + Weather + Storage + Credit → Strategy synthesis) over a cached/RAG knowledge base, with a multimodal Soil-Health-Card photo flow and structured JSON outputs. Voice is Sarvam AI (cloud, live) with Vosk + Android TTS as the fully-offline fallback. A React/Next web dashboard for FPO/PACS operators runs on the laptop (drives the OfficeKit score).

**Tech Stack:** Flutter (Dart) + `flutter_gemma` 0.16.x (Gemma 3 1B int4 `.task`) · Vosk Hindi (offline ASR) + Android `TextToSpeech` (offline TTS) · Sarvam AI (live ASR/TTS/translate) · OpenRouter (cheap cloud vision for SHC OCR) · Open-Meteo (live weather) · cached Agmarknet snapshot + CEDA trends · Next.js + Tailwind dashboard.

---

## 0. Hackathon scoring map (why every choice below exists)

| Rubric lever | How FasalSaathi earns it |
|---|---|
| **Phone-first / native feel** | Flutter native app, Material 3, voice-first UI, runs on the iQOO |
| **On-device intelligence + on-device LLM (scored)** | Gemma 3 1B int4 runs on the phone GPU/CPU; answers cached price/scheme questions in **airplane mode** |
| **AI-native (single LLM call doesn't count)** | Multi-agent orchestration (price/weather/storage/credit → strategy), RAG over gov-scheme docs, multimodal SHC photo flow, structured JSON outputs |
| **Problem fit (real Indian farmer/SMB)** | Attacks distress-selling (#1 exploitation mechanism); rides existing gov rails; vernacular voice |
| **HackTracker (GPU usage, 25% split)** | On-device Gemma inference loop keeps the Adreno GPU busy |
| **OfficeKit (laptop remote usage, 25% split)** | Build + run the operator dashboard through the remotely-controlled laptop; do all dev via the remote link |

**Model-burn discipline (usage is tracked):** the *bulk* of inference is on-device Gemma (free, and it scores the on-device lever). Cloud is used only for (a) the SHC vision OCR step and (b) live voice via Sarvam. Cloud LLM calls route through OpenRouter using **cheap** models (Gemini 2.0 Flash / Llama 3.3 / DeepSeek tier), with per-call token caps and cached audio for scripted demo lines. Never wire an expensive frontier model into a per-utterance path.

---

## 1. Scope: what we build in 30 hours

**Recommended scope — Modules 1 + 2 core, plus Module 3's photo flow as the multimodal element.** This is the minimum that hits *every* AI-native checkbox. Module 4 (FasalLens grain grading) is an explicit stretch — do not start it until the demo of 1+2+SHC is rehearsed and solid.

### Module 1 — Bhav Check (daily-use hook)
- Voice: *"Soyabean ka bhav kya hai?"* → modal prices at the 5 nearest mandis (cached Agmarknet snapshot), **transport-adjusted to a net-in-hand ₹/quintal**.
- Negotiation mode: *"Vyapari 4,200 bol raha hai"* → *"Aaj Dewas mandi ₹4,650. Ye 10% kam hai…"* (the J-PAL info-at-negotiation mechanism).
- 7/30-day trend from CEDA history.

### Module 2 — Bech ya Rakh? (the differentiator: sell-or-store decision engine)
- Inputs (voice): crop, quantity, cash need ("Kitna paisa abhi chahiye?").
- Composes: current price + trend (Price Agent), rain/quality risk (Weather Agent, Open-Meteo live), nearest warehouse + cost (Storage Agent, curated dataset), eNWR pledge-loan math (Credit Agent, constants).
- Output: dialect explanation **with the arithmetic shown** + risk framing. This is the multi-source reasoning the rubric rewards.

### Module 3 — Samjhao, photo element (multimodal)
- Photograph a Soil Health Card → cloud vision (OpenRouter) extracts N/P/K/pH + recommendations as **structured JSON** → on-device Gemma explains in dialect with a concrete shopping list.
- Plus scheme Q&A ("MSP kya hai?") via **RAG** over a small curated scheme knowledge base.

### Stretch (only if ahead) — Module 4 FasalLens
- Photo of grain sample → vision model estimates grade features → shareable "evidence card." High wow, real accuracy risk. Guarded behind a feature flag.

---

## 2. File / project structure

Two codebases, one repo.

```
FasalSaathi/
├── app/                          # Flutter Android app (the demo surface)
│   ├── lib/
│   │   ├── main.dart
│   │   ├── core/
│   │   │   ├── llm_service.dart           # flutter_gemma wrapper, backend select, streaming
│   │   │   ├── voice_service.dart         # Sarvam (live) + Vosk/TTS (offline) behind one interface
│   │   │   ├── connectivity.dart          # online/offline switch for voice + data
│   │   │   └── structured.dart            # JSON-schema parse/validate for tool outputs
│   │   ├── agents/
│   │   │   ├── orchestrator.dart          # intent+entity extraction → routing (structured output)
│   │   │   ├── price_agent.dart           # cached Agmarknet + transport adjust
│   │   │   ├── weather_agent.dart         # Open-Meteo live → quality/rain risk
│   │   │   ├── storage_agent.dart         # curated warehouse dataset lookup
│   │   │   ├── credit_agent.dart          # eNWR pledge-loan math (constants)
│   │   │   └── strategy_agent.dart        # synthesis → decision object + dialect narration
│   │   ├── rag/
│   │   │   ├── kb_loader.dart             # load scheme docs + price snapshot
│   │   │   └── retriever.dart             # embeddings (flutter_gemma) or cosine over precomputed vectors
│   │   ├── features/
│   │   │   ├── bhav_check/                # Module 1 UI
│   │   │   ├── sell_or_store/             # Module 2 UI (decision card with arithmetic)
│   │   │   └── samjhao/                   # Module 3 UI (camera → SHC explain, scheme Q&A)
│   │   └── ui/                            # shared widgets, theme, mic button, animations
│   ├── assets/
│   │   ├── models/gemma3-1b-it-int4.task  # on-device LLM (≈500MB) — side-loaded, see §6
│   │   ├── data/prices_snapshot.json      # cached Agmarknet for demo commodities/districts
│   │   ├── data/warehouses.json           # hand-curated WDRA/PACS list for demo region
│   │   ├── data/districts_latlong.json    # district → centroid for Open-Meteo
│   │   ├── kb/schemes/*.md                # MSP/eNWR/SHC explainer docs for RAG
│   │   └── kb/embeddings.json             # precomputed vectors (if not embedding on-device)
│   └── android/                           # manifest (OpenGL libs, mic, camera), Gradle (arm64-v8a)
├── dashboard/                    # Next.js OfficeKit operator dashboard (laptop surface)
│   ├── app/                               # district price trends, member storage positions
│   ├── components/
│   └── lib/brief.ts                       # weekly vernacular brief generation (OpenRouter)
├── tools/                        # data prep scripts (run once, pre-event)
│   ├── pull_prices.mjs                    # snapshot Agmarknet → prices_snapshot.json
│   ├── build_kb.mjs                       # chunk + embed scheme docs → embeddings.json
│   └── curate_warehouses.mjs              # assemble warehouses.json
└── docs/superpowers/plans/2026-06-13-fasalsaathi.md
```

**Responsibilities:** `agents/` is pure logic (testable without UI). `core/` isolates the three flaky boundaries (LLM, voice, network) behind interfaces so you can swap online↔offline and stub for tests. `features/` is thin UI over agents.

---

## 3. AI architecture (the core — this is what wins AI-native points)

**Pipeline for a sell-or-store query:**

```
Voice (Sarvam ASR / Vosk offline)  →  text
        │
        ▼
Orchestrator (on-device Gemma, STRUCTURED OUTPUT)
   → {intent, crop, quantity_q, district, cash_need_inr}   ← JSON schema, validated
        │  routes to needed agents (parallel where possible)
        ├── Price Agent     → RAG over prices_snapshot + CEDA trend → {modal, net_after_transport, trend_pct}
        ├── Weather Agent    → Open-Meteo live → {rain_3d_mm, quality_risk}
        ├── Storage Agent    → warehouses.json → {name, dist_km, cost_per_q_month}
        └── Credit Agent     → constants → {ltv, rate, loan_available_inr}
        │
        ▼
Strategy Agent (on-device Gemma)
   → decision object {recommendation, sell_now_inr, store_gain_inr, breakeven_weeks, risks[]}
   → dialect narration WITH arithmetic shown
        │
        ▼
TTS (Sarvam / Android TTS offline)  →  spoken answer + on-screen decision card
```

**Why this is "agents," not a single call:** the orchestrator does structured intent+entity extraction; four independent tools fetch/compute from four real sources; a synthesis step reasons over their combined output. Each step is inspectable and individually demoable — show the JSON tool outputs in a debug drawer to prove it to judges.

**RAG:** chunk the scheme/SHC explainer docs (`assets/kb/schemes/*.md`), embed them (on-device via `flutter_gemma` embeddings on arm64, or precompute with `tools/build_kb.mjs` and ship `embeddings.json`), retrieve top-k by cosine for scheme Q&A and SHC explanation grounding. Keep the KB small and curated — accuracy over breadth.

**Multimodal (SHC photo):** `image → OpenRouter vision model (cheap: gemini-2.0-flash / qwen-2.5-vl) → structured JSON {N,P,K,pH,recommendations[]}` → on-device Gemma turns JSON into a dialect explanation + shopping list. Multimodal + structured output + on-device narration in one flow.

**Structured outputs everywhere:** intent extraction, SHC extraction, and the decision object are all JSON-schema-validated (`core/structured.dart`). On parse failure, one re-ask with the schema appended, then a deterministic fallback. Never free-text-parse a number you're going to do arithmetic on.

**On-device vs cloud split (burn control):**
- **On-device Gemma (free, scores the on-device lever):** intent routing, all dialect generation, strategy narration, SHC explanation, offline scheme Q&A. This is the majority of calls.
- **Cloud, sparingly:** SHC vision OCR (OpenRouter cheap model), live voice (Sarvam). Cache TTS audio for scripted demo lines.
- **Offline demo moment:** airplane mode → Vosk ASR → on-device Gemma over cached price/scheme data → Android TTS. Fully local, no network. This is the showpiece.

---

## 4. Data strategy (verified 2026-06-13 — do not skip)

| Source | Use | Verdict |
|---|---|---|
| **Open-Meteo** | Live weather/rain forecast (Weather Agent) | ✅ **Live** — no key, CORS, tested 200 OK. Map district→lat/long via `districts_latlong.json`. |
| **Sarvam AI** | Live vernacular ASR/TTS/translate | ✅ **Live** — `https://api.sarvam.ai`, header `api-subscription-key`, ₹1,000 free credits. Primary voice. |
| **Agmarknet (data.gov.in)** | Today's mandi modal prices | ❌ **Cache** — platform returned 502 across the board during testing; coverage patchy. Pre-pull a JSON **snapshot** for demo commodities/states; optional live refresh with a fast timeout that silently falls back to snapshot. |
| **CEDA Ashoka mirror** | Price trend charts / backfill | ⚠️ **Live, monthly cadence** — real API at `https://api.ceda.ashoka.edu.in/` (Swagger at `/documentation/`). Good for trends, not "today." |
| **WDRA / PACS warehouses** | Storage Agent | ❌ **Mock/curate** — no clean API. Hand-curate 10–20 realistic warehouses for the demo region. |
| **IMD agromet** | Advisory content | ❌ **Cache** — IP-whitelisted, too heavy. Screenshot/cache one district bulletin. |
| **eNWR loan economics** | Credit Agent math | ✅ **Constants** — LTV ~70% (SBI 75%), interest 7% (small/marginal) to 9–11% (general), storage ₹15–30/q/month (use ₹20 midpoint), tenure ≤12 months. |

**Agmarknet snapshot endpoint (for `tools/pull_prices.mjs`, run pre-event):**
```
https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
  ?api-key=YOUR_KEY&format=json&limit=100
  &filters[state]=Madhya%20Pradesh&filters[commodity]=Soybean
```
Records carry `state, district, market, commodity, variety, arrival_date, min_price, max_price, modal_price` (₹/quintal). Public sample key exists; register on data.gov.in for your own. **Demo commodities/districts with reliable reporting:** soybean–MP, onion–Maharashtra, wheat–MP/UP. Always handle empty `records[]`.

**Decision-engine formula (Credit + Strategy agents):**
```
store_gain = (expected_future_modal − today_modal) × quintals
           − storage_cost_per_q_month × months × quintals
           − interest_rate × (LTV × today_value) × months/12
```
Always render the terms, never a bare verdict. Frame as "calculation, not prediction" with ranges.

---

## 5. Tooling: Android Studio vs VS Code (your question, answered)

**Use both, for different jobs:**
- **Install Android Studio** — you need it for the Android SDK, `platform-tools`/`adb`, device drivers, and the AVD/emulator. Run the setup wizard once; let it install SDK + command-line tools.
- **Write code in VS Code** with the Flutter + Dart extensions — lighter, faster, and where Claude Code is most effective. Point VS Code at the SDK Android Studio installed.
- **Deploy to the physical iQOO, not an emulator.** On-device LLM perf (GPU/NPU) and MediaPipe behavior only matter on real hardware; the emulator won't represent the demo. Enable Developer Options → USB debugging on the iQOO, `flutter devices` to confirm, `flutter run --release` to it.

**One-time setup commands:**
```bash
# After installing Flutter SDK + Android Studio:
flutter doctor                       # resolve every ✗ before hour 0
flutter config --android-sdk <path>  # if VS Code can't find the SDK
flutter create app && cd app
flutter pub add flutter_gemma
flutter devices                      # confirm the iQOO shows up over USB
flutter run --release                # deploy hello-world to the phone
```

---

## 6. On-device LLM setup (the critical-path risk — de-risk first)

- **Package:** `flutter_gemma` 0.16.x (confirm latest on pub.dev at build time; pin the version you start with).
- **Model:** **Gemma 3 1B int4 `.task`** (~500MB) from HuggingFace `litert-community/Gemma3-1B-IT` (needs an HF token; the model is gated). Lighter fallback for snappier demo: **Gemma 3 270M**.
- **Get the model onto the phone reliably:** download once, **side-load as a Flutter asset** (or `adb push` to app storage) so the demo never depends on a live download. Files >500MB auto-use an Android foreground service.
- **Android manifest:** add the OpenGL `<uses-native-library>` entries for GPU; add `RECORD_AUDIO` and `CAMERA` permissions. **Gradle:** restrict to `arm64-v8a` (required for embeddings/`.litertlm`).
- **Backend:** test **both** `PreferredBackend.gpu` and `.cpu` on the actual iQOO and hardcode the faster one. **GPU is NOT always faster for decode** — on some flagships GPU decode is slower than CPU (driver-dependent). flutter_gemma 0.16.3+ also exposes `.npu` (Qualcomm) — try it. Expect **~10–20 tok/s decode**; stream tokens so it feels live, and cap `maxTokens`.
- **First on-device token by hour 6, or escalate.** This is the single biggest schedule risk. If `flutter_gemma` fights you past hour 6, fall back to Gemma 3 270M (smaller, fewer memory issues) before considering any other runtime.

**Voice setup:**
- **Live (primary):** Sarvam `POST /speech-to-text` (`model=saaras:v3`, `language_code=hi-IN`) and `POST /text-to-speech` (`model=bulbul`). Header `api-subscription-key`.
- **Offline (fallback + airplane-mode showpiece):** Vosk `vosk-model-small-hi-0.22` (42MB, bundled) for ASR; Android `TextToSpeech` `hi-IN` for TTS (ensure the Hindi voice pack is installed on the phone — it silently falls back to English otherwise).
- Wrap both behind `voice_service.dart` so a connectivity flag swaps them transparently.

---

## 7. 30-hour execution plan (team of 3)

**Roles** (everyone routes dev through the remote laptop for OfficeKit, and keeps the on-device Gemma loop running for HackTracker):
- **Dev A — Mobile lead:** Flutter shell, `flutter_gemma` integration, voice services, UI/native feel.
- **Dev B — AI lead:** orchestrator + 4 agents, RAG KB, prompts, structured outputs, SHC vision flow.
- **Dev C — Data + OfficeKit + demo:** data snapshot scripts, warehouse curation, Next.js dashboard, demo script, pitch deck.

### Phase 0 — Pre-event prep (do BEFORE the clock starts; ~2h)
- [ ] `flutter doctor` clean; Android Studio SDK + adb; VS Code Flutter ext; deploy hello-world to the iQOO.
- [ ] Get keys: data.gov.in, Sarvam, OpenRouter, HuggingFace token. Store in `.env` (gitignored).
- [ ] Download Gemma 3 1B int4 `.task`; confirm it loads and prints one token on the iQOO.
- [ ] Run `tools/pull_prices.mjs` → `prices_snapshot.json`; curate `warehouses.json`; build `districts_latlong.json`.
- [ ] Confirm the **iQOO's Hindi TTS voice pack** is installed (Settings → TTS).

### Phase 1 — Vertical slice (hours 0–8)
- [ ] App shell + Material 3 theme + mic button + chat surface (Dev A).
- [ ] On-device Gemma answering a hardcoded Hindi prompt, streamed to UI; GPU vs CPU benchmarked, winner hardcoded (Dev A).
- [ ] `voice_service` text-input path first, then Sarvam ASR/TTS wired (Dev A).
- [ ] Orchestrator returns validated intent JSON from a typed query; Price Agent reads the snapshot (Dev B).
- [ ] Next.js dashboard scaffold + load `prices_snapshot.json` into a district trend chart (Dev C).
- [ ] **Checkpoint:** typed "soybean ka bhav?" → on-device Gemma replies with a real cached price. Commit.

### Phase 2 — Modules 1 + 2 (hours 8–18)
- [ ] Module 1 complete: voice → price at 5 nearest mandis, transport-adjusted net price, trend, negotiation mode (Dev A+B).
- [ ] Weather/Storage/Credit agents return validated objects; Strategy agent composes the decision object with arithmetic (Dev B).
- [ ] Module 2 UI: decision card showing sell-now vs store math, ranges, risks; spoken narration (Dev A).
- [ ] RAG KB loaded; scheme Q&A returns grounded answers (Dev B).
- [ ] Dashboard: member-wise storage positions + price trends (Dev C).
- [ ] **Checkpoint:** full voice sell-or-store flow works online. Commit + tag.

### Phase 3 — Multimodal + offline hardening (hours 18–24)
- [ ] SHC photo → OpenRouter vision → structured JSON → on-device dialect explanation + shopping list (Dev B).
- [ ] Offline mode: airplane-mode path (Vosk → Gemma over cache → Android TTS) verified end-to-end (Dev A).
- [ ] Dashboard: weekly vernacular brief generation via OpenRouter cheap model (Dev C).
- [ ] **Checkpoint:** airplane-mode demo works; SHC photo works. Commit + tag.

### Phase 4 — Polish + rehearse (hours 24–28)
- [ ] Native-feel pass: animations, mic states, loading shimmers, Hindi copy review, empty/error states (Dev A).
- [ ] Wire all fallbacks (Sarvam→Vosk, live price→snapshot, cloud→on-device); fast timeouts everywhere (Dev A+B).
- [ ] Performance: cap tokens, prewarm model load on app start, confirm decode feels live (Dev A).
- [ ] Demo script written + rehearsed on the iQOO; pitch deck with the 6%-MSP / 0.5%-comprehension hooks (Dev C).

### Phase 5 — Freeze + buffer (hours 28–30)
- [ ] Code freeze. Rehearse the full demo twice on the iQOO. Charge phone, pre-warm model, pre-cache TTS lines.
- [ ] Backup: screen-recording of the working demo in case of live failure.

---

## 8. Demo script (≈3 min, on the iQOO)

1. **Hook (spoken, Hindi):** "Soyabean ka bhav kya hai?" → 5 mandis, net-in-hand price. (Module 1)
2. **Negotiation:** "Vyapari 4,200 bol raha hai" → "10% kam hai, itna bolo." (the J-PAL moment)
3. **The differentiator:** "5 quintal soybean hai, ₹30,000 abhi chahiye — bechu ya rakhu?" → decision card with full arithmetic, rain risk, pledge-loan path. (Module 2)
4. **Multimodal:** photograph a Soil Health Card → dialect explanation + fertilizer shopping list. (Module 3)
5. **The showpiece — airplane mode ON:** repeat a price + scheme question → on-device Gemma answers fully offline. "This runs on the phone, for a farmer with no signal."
6. **OfficeKit:** switch to the laptop dashboard (via remote control) → district trends, member storage positions, auto-generated weekly vernacular brief.

Open the pitch with: *6% of farmers benefit from MSP; 76.5% don't know it exists; SHC comprehension was 0.5%. The data exists — comprehension, integration, and timing are broken. That's what an LLM fixes.*

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `flutter_gemma` / on-device LLM won't run in time | Med | **Critical** | De-risk in Phase 0; first token by hour 6 or drop to Gemma 3 270M |
| GPU decode slower than CPU on the iQOO | Med | Med | Benchmark both backends early, hardcode winner; try `.npu` |
| Model download fails at demo | Med | High | Side-load `.task` as asset pre-event; never download live |
| Voice glue (mic perms, audio format) eats hours | High | High | Start voice by hour 4; keep text-input fallback in UI |
| Hindi ASR accuracy rough (Vosk WER ~21–25) | Med | Med | Sarvam live primary; constrain demo phrasing; Vosk only for offline moment |
| Agmarknet live API down (it was, 502) | High | Med | Cached snapshot is the source of truth; live refresh is best-effort only |
| Sell-or-store advice wrong → trust hit | Med | Med | Always show arithmetic + ranges; "calculation, not prediction" |
| Cloud credit burn flagged | Low | Med | On-device for the bulk; cheap OpenRouter models; cap tokens; cache TTS |
| Android TTS falls back to English | Med | Low | Pre-install Hindi voice pack on the iQOO in Phase 0 |

---

## 10. Pre-event checklist (print this)

- [ ] Flutter + Android Studio + VS Code installed; `flutter doctor` clean
- [ ] iQOO: USB debugging on, Hindi TTS voice pack installed, shows in `flutter devices`
- [ ] Hello-world deployed to iQOO in `--release`
- [ ] Gemma 3 1B int4 `.task` downloaded + prints a token on-device
- [ ] Keys in `.env`: data.gov.in, Sarvam, OpenRouter, HuggingFace
- [ ] `prices_snapshot.json`, `warehouses.json`, `districts_latlong.json`, scheme KB docs prepared
- [ ] Vosk Hindi model (42MB) + Gemma `.task` bundled as assets
- [ ] Repo created, dashboard scaffolded, roles assigned
- [ ] Remote-laptop (OfficeKit) access tested from the phone; on-device Gemma idle-loop script ready (HackTracker)
