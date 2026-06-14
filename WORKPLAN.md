# FasalSaathi — 30h Hackathon Work Plan (3 people, React Native app)

**Decisions locked**
- **Platform:** **React Native phone app** (Expo + dev client, or bare RN). Voice-first, Hindi. Demo on an **Android device (on-brand for iQOO)**.
- **AI:** **Cloud Claude API for the MVP agent** (fast to build). **On-device Gemma 3 1B (int4) is the headline stretch** — it unlocks the airplane-mode offline demo the brainstorm pitched.
- **Team:** 3 people — **A = Frontend (React Native)**, **B = Backend/Data**, **C = AI/ML (agent)**.
- **Timeline:** 30h total. **MVP must run end-to-end within the first 10h, today.**
- **Demo scenario (lock it, build the whole vertical slice around it):** **Soybean · Dewas mandi, Madhya Pradesh · Hindi.** Nearby mandis: Indore, Ujjain, Sehore, Khargone. Reliable Agmarknet reporting (per the risk register).

---

## Architecture

```
[ React Native app ]  ── FE (A) ──────────────────────────┐
  Voice mic UI · M1/M2/M3 screens · cached SQLite (offline)│
  ASR: @react-native-voice/voice   TTS: react-native-tts   │
        │  POST /agent, GET /prices ... (JSON over HTTPS)   │
        ▼                                                   │
[ FastAPI server ]  ── one app, two owners ────────────────┘
  data.py + calc.py  (B)        agent.py + prompts.py  (C)
  /prices /net-price            /agent  (Claude tool-calling)
  /weather /warehouses          tools call B's endpoints
  /calc/storage /calc/loan      /data-bundle (offline cache export)
        │
        ▼
  Agmarknet (data.gov.in) · Open-Meteo (weather) · seeded warehouse JSON

STRETCH (offline): bundled SQLite price/weather cache + on-device Gemma 3 1B
(via llama.rn) answers over it with NO network → airplane-mode demo.
```

**Core design rule (from the brainstorm's risk mitigation): arithmetic is deterministic, the LLM only orchestrates and explains.** All money math (transport-adjusted net price, storage economics, pledge-loan) lives in backend functions the agent calls as tools. The LLM never does arithmetic itself — it frames "calculation, not prediction," and always shows numbers + ranges + data-age labels.

**Suggested stack (optimized for 10h):**
- FE: **React Native (Expo dev client)** + a component lib (Tamagui/RN Paper). Voice via **`@react-native-voice/voice`** (Android Google ASR supports hi-IN) + **`react-native-tts`** (Android TTS has Hindi). Local cache via **`expo-sqlite`** / `op-sqlite`.
- BE + ML: one **FastAPI** app, separate files per owner to avoid merge conflicts. Python `anthropic` SDK for the agent.
- Repo: monorepo — `/app` (A, React Native) and `/server` (B + C).
- Agent model: `claude-sonnet-4-6` for the agent loop (fast, strong tool use); `claude-fable-5` for the hardest Module-2 reasoning if needed; Claude vision for the Module-3 Soil Health Card photo. On-device stretch: **Gemma 3 1B int4 GGUF via `llama.rn`** (llama.cpp bindings). Run `/claude-api` for current Claude IDs/pricing before wiring keys.

---

## The one rule that prevents blocking

**Agree the JSON contract in the first 30 min. B publishes MOCK endpoints with the right shape immediately**, then swaps in real data. A and C build against the mock from minute 30 — nobody waits on real Agmarknet data. Integrate continuously, not at the end.

### API contract (v0 — adjust together, but freeze it early)
```jsonc
// GET /prices?commodity=soybean&mandi=dewas
{ "commodity":"Soybean", "mandi":"Dewas", "state":"MP",
  "modal":4650, "min":4400, "max":4800, "unit":"₹/quintal",
  "date":"2026-06-13", "data_age_days":0,
  "nearby":[{"mandi":"Indore","modal":4710,"distance_km":42}, ...],
  "trend_7d_pct":+3.2, "trend_30d_pct":+8.1 }

// GET /net-price?commodity=soybean&mandi=dewas&from_village=...&qty_q=20
{ "modal":4650, "transport_cost_per_q":120, "commission_pct":2.0,
  "net_in_hand_per_q":4437, "total_net":88740 }

// GET /weather?district=dewas  → { "rain_next_7d":true, "risk":"medium", "summary":"..." }

// GET /warehouses?near=dewas
[ { "name":"Khargone PACS","distance_km":6,"cost_per_q_month":9,"type":"WDRA" }, ... ]

// POST /calc/storage   { qty_q, modal, storage_cost_per_q_month, months, expected_price_change_pct }
//   → { storage_cost, projected_gross_gain, net_gain, breakeven_price }
// POST /calc/loan      { qty_q, modal }  → eNWR pledge: { ltv_pct:70, loan_amount, interest_pct, ... }

// POST /agent  { message, lang:"hi", session:{ crop, qty_q, cash_need, ... } }
//   → { reply_text, structured:{ decision, numbers:[...], data_age_days } }

// GET /data-bundle?district=dewas  → full cache (prices+weather+warehouses) for offline SQLite import
```

---

## Person A — Frontend, React Native ("The Face")

**MVP (0–10h):**
- RN app skeleton (Expo dev client), Hindi UI, big mic button, chat transcript.
- Voice loop: mic → `@react-native-voice/voice` (hi-IN) → `POST /agent` → render reply → `react-native-tts` speaks it.
- **Module 1 (Bhav Check) screen:** ask price → modal / net-in-hand / 7d & 30d trend cards with **data-age label**; negotiation input ("vyapari 4,200 bol raha hai") → counter line.
- **Module 2 (Bech ya Rakh) screen:** collect crop / quantity / cash-need → decision card with full **arithmetic breakdown** + ranges.
- Build against B's mock from minute 30; lock the soybean/Dewas demo to look great on the iQOO/Android device.

**Stretch (10–30h):**
- **Offline mode (the rubric winner):** import B's `/data-bundle` into `expo-sqlite`; integrate **on-device Gemma 3 1B via `llama.rn`** so M1 + M2 answer with **network off** → the airplane-mode demo.
- **OfficeKit operator dashboard** (25% of rubric) — lightweight **React web** app (separate, reuses your React skills): district price-trend charts, member-wise storage positions, "generate weekly vernacular brief" button (calls `/agent`).
- Module 3 Soil Health Card photo-capture (camera) + result screen.
- Polish + demo video.

## Person B — Backend / Data ("The Rails")

**MVP (0–10h):**
- FastAPI app + **mock endpoints in first 30 min** (this unblocks A and C).
- Real **Agmarknet** integration via data.gov.in API: soybean at Dewas + 4 nearby mandis; modal/min/max + date + `data_age_days`.
- 7d / 30d **trend** (store a small history or fetch a range; simple % change).
- **Net-in-hand** calc: distance table × ₹/q/km transport + commission% → net price.
- **Weather** via **Open-Meteo** (free, no key) for Dewas lat/long → 7-day rain-risk flag (cleaner than IMD in 10h; label as rain risk).
- **Warehouses:** seed JSON of 2–3 WDRA/PACS near Dewas/Khargone with ₹/q/month.
- **Deterministic calculators:** `/calc/storage` and `/calc/loan` (eNWR pledge ≈ 70% LTV, interest, net gain, breakeven).

**Stretch (10–30h):** `/data-bundle` export for the offline app; real WDRA warehouse scrape/cache; more commodities + districts (onion–Maharashtra, wheat–MP/UP); nightly refresh cron + SQLite/Postgres; deploy (Render/Railway/Fly).

## Person C — AI / ML ("The Brain")

**MVP (0–10h):**
- Claude agent with **tool-calling**; tools = `get_prices`, `get_net_price`, `get_weather`, `get_warehouses`, `calc_storage`, `calc_loan` → all hit B's endpoints.
- **System prompt:** vernacular Hindi, farmer persona, "always show the math + ranges, never a bare command, calculation not prediction."
- **Module 1 negotiation logic:** trader's offer → compare to modal, compute % gap, produce a Hindi counter line (the J-PAL "info at the moment of negotiation" mechanic).
- **Module 2 sell-or-store synthesis:** compose price + trend + weather + storage + pledge-loan + cash-need into one reasoned recommendation with arithmetic (numbers from B's calculators, not the LLM).
- Expose `POST /agent`. Voice stays on-device (RN libs) for MVP — you return clean text + structured fields.
- Build against B's mock from minute 30.

**Stretch (10–30h):** **On-device Gemma 3 1B** prompt port (smaller context, offline Q&A over cached bundle) — pair with A on `llama.rn` integration; Bhashini ASR/TTS for more languages + dialects; **Module 3 Samjhao** — Soil Health Card photo → Claude vision → dialect explanation + concrete shopping list; MSP / scheme-awareness Q&A; optional Module 4 FasalLens grain-grading.

---

## 10-hour MVP timeline (T0 = now)

| Time | A (RN) | B (BE) | C (ML) |
|---|---|---|---|
| T0–T1 | **All:** kickoff, lock scenario + API contract, repo skeleton. B ships mock endpoints. |
| T1–T4 | RN voice UI + M1 screen vs mock | Real Agmarknet `/prices`, `/net-price`, `/weather` | Agent + M1 negotiation vs mock→real |
| T4–T7 | **Integrate M1 end-to-end** (voice→agent→price→TTS) | `/warehouses`, `/calc/storage`, `/calc/loan` | M2 sell-or-store synthesis |
| T7–T9 | M2 screen + **integrate M2 end-to-end** | harden data, edge cases | tune prompts, decision quality |
| T9–T10 | **MVP freeze:** run full soybean/Dewas demo on the Android device; **record a backup video.** |

After T10: on-device Gemma offline mode, OfficeKit web dashboard, Module 3, Bhashini voice, pitch deck (open with the 6%-MSP / 0.5%-comprehension stats).

## Rubric coverage check
- **Phone-first (25%):** native RN app, voice-first, **on-device LLM + offline airplane-mode demo** → A + C. (Strong now — this is why native beats web.)
- **OfficeKit (25%):** operator web dashboard → A (stretch, with B's data).
- **AI-native (20%):** multi-source tool-calling agent (cloud) + on-device hybrid → C.
- **Problem fit (20%):** pitch with the brainstorm's stats → shared, DRI = whoever pitches.
