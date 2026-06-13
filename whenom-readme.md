# FasalSaathi — Project Status README

> Voice-first mobile app that helps a small Indian farmer answer one post-harvest question:
> **"What is my crop worth today, and should I sell now or store it?"**
> iQOO hackathon · 30h · team of 3 (Frontend / Backend / ML).

---

## TL;DR — current status

A **polished, working React Native (Expo) UI prototype**. The app looks and navigates like a finished product, with onboarding and four screens. **Everything behind the UI is still mock** — there is no backend, no real data, no voice recognition, and no AI yet. It's the frontend shell, ready to be wired up.

- **Builds & runs:** ✅ (typechecks clean, web bundle compiles)
- **Real functionality:** ❌ (all data hardcoded; mic and camera are visual-only)
- **Language:** English for now (Hindi/vernacular intentionally deferred to the end)

---

## Tech stack

- **React Native + Expo** (SDK 56, RN 0.85), **TypeScript**
- **lucide-react-native** + react-native-svg (icons), React Native **Animated** (mic pulse, count-up)
- **@react-native-async-storage/async-storage** (saves the farmer profile on-device)
- Package manager: **npm**

## How to run

```bash
cd app
npm install
npx expo start          # press "w" for web preview, or scan the QR with Expo Go
```

- **Web preview** always works (`npx expo start --web` → http://localhost:8081).
- **Expo Go on a phone** requires the latest Expo Go (must support SDK 56), same Wi-Fi; use `--tunnel` if the connection drops.
- **No real-device build yet** (no APK / EAS / emulator set up).

## Repo structure

```
FasalSaathi/
├── app/                      # THE app — React Native (Expo). Main frontend.
│   ├── App.tsx               # profile gate + bottom tab navigation
│   └── src/
│       ├── theme.ts          # colors + inr() money formatter
│       ├── primitives.tsx    # Touchable (press-scale) + shadow tokens
│       ├── ui.tsx            # Card, StatPill, BreakdownRow, NavCard, RiskCallout, SchemeRow, Field, Select, PrimaryButton
│       ├── MicButton.tsx     # animated mic (pulse + waveform) + useCountUp
│       └── screens/          # Onboarding, Home, Prices, SellOrStore, Learn
├── docs/superpowers/plans/2026-06-13-fasalsaathi.md   # technical PRD (product/data/AI strategy)
├── AGRI-BRAINSTORM.md        # research-backed product thesis
├── Frontenlovable/           # Lovable web app — DESIGN SOURCE only (redundant; has nested git)
└── whenom-readme.md          # this file
```
Branches: `main` (docs/PRD/research), `front-end` (the app), `workplan`, `AI-Layer` (empty placeholder).

---

## ✅ What's built

**Onboarding (farmer details)**
- Collects: full name, mobile (10-digit), Aadhaar (12-digit), village, district, **state (dropdown)**, main crop (optional).
- Inline validation; privacy note on Aadhaar.
- Saved on-device via AsyncStorage → returning users skip it. A "Profile" chip on Home lets you edit/reset.

**Four screens + bottom tab navigation**
- **Home** — voice-first: a big animated mic (pulse + waveform), personalized "Namaste, {name}" greeting, today's-price hero card, and nav cards to the other screens.
- **Prices (Price compass)** — price card (modal/low/high/trends), **net-in-hand** breakdown (mandi price − transport − commission), nearby mandis list, and a negotiation-help card.
- **Sell or Store?** — input chips, an advice card, the **sell-vs-store math** (shown line by line), a pledge-loan card, and a rain-risk callout.
- **Learn** — "photograph your Soil Health Card" CTA, an example N/P/K reading, and government-scheme cards (MSP, eNWR, SHC).

**Visual identity**
- "Bold & friendly field app" style: off-white background, soft + bold orange accents, concrete farm icons (coin / warehouse / sprout), big high-contrast type, chunky tap targets.

---

## ❌ What's NOT built yet

**Data & backend**
- No backend / API server. Every price, mandi, trend, weather note, loan figure and scheme is **hardcoded**.
- No integration with Agmarknet (prices), Open-Meteo/IMD (weather), or WDRA/PACS (warehouses).

**The actual intelligence (the product's core)**
- **No voice** — the mic only toggles an animation; there's no speech-to-text or text-to-speech (no Sarvam/Bhashini/Vosk).
- **No AI / on-device LLM** — no Gemma/llama.rn, no agent. The sell-or-store "math" is static text, not computed from inputs.
- **No Soil Health Card vision** — the camera CTA does nothing (no OCR/vision).
- **No scheme Q&A / RAG** — scheme cards are static.

**Other gaps**
- **No Hindi / vernacular** — English only (deferred by design).
- **No OfficeKit dashboard** (the laptop operator dashboard from the PRD).
- **No real Aadhaar handling** — stored locally only; no verification, no proper consent/compliance.
- **No production/device build** — no APK, EAS build, or emulator; Expo Go blocked on the loaner iQOO by an SDK-version mismatch.
- **No custom fonts** (uses system font), **no tests**.
- Backend (Dev C) and AI/ML (Dev B) workstreams **not started** — only the frontend exists.

---

## Suggested next steps

1. Stand up a small backend or in-app data layer (start with a cached Agmarknet price snapshot + Open-Meteo weather).
2. Make the sell-or-store math real (compute from the profile's crop/qty/cash-need).
3. Add real voice (Sarvam for live, Vosk for offline) and wire the mic.
4. Decide on the on-device LLM (the scored rubric lever) — `llama.rn` + Gemma, via a dev build.
5. Switch the UI to Hindi/vernacular.
6. Set up an Android emulator or EAS dev build to run on a real device.
