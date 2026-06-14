# FasalSaathi — Frontend ⇄ Backend Integration Design

**Date:** 2026-06-14
**Branch:** `main` (FE + BE merged)
**Goal:** A fully working app where only the AI/ML layer (trained price model + F3 LLM + real voice STT) remains to be plugged in later behind existing interfaces.

---

## 1. Starting state

- **Frontend (`app/`)** — Expo / React Native, TypeScript. Polished UI, but 100% mock:
  `App.tsx` gates on a *local* AsyncStorage profile; "login" only compares a phone
  string locally; Home price is hardcoded; the mic is a visual toggle. Screens:
  Login, Onboarding (single page), Home, Prices, SellOrStore, Learn.
- **Backend (`backend/`)** — Hono + TypeScript (`npm run dev` → `:8787`). Real, tested,
  Supabase-auth, fixture-backed deterministic data. Endpoints: `/auth/signup`,
  `/auth/login`, `/me`, `/me/profile`, `/mandis/nearby`, `/prices/history`,
  `/weather`, `/warehouses`, `/decision`, `/health`.
- **AI-Layer (branch)** — Python LightGBM forecaster. Stays separate; integrates
  later behind the backend's `ForecastProvider` interface (no route changes).

## 2. Architecture decisions

- **`main` = `app/` + `backend/`** (merged conflict-free; disjoint paths). AI-Layer
  remains its own branch.
- **Frontend data layer** (`app/src/api/`): a fetch client (base URL via
  `EXPO_PUBLIC_API_URL`, attaches `Bearer <jwt>`, parses the `{error:{code,message}}`
  envelope) + per-domain modules: `auth`, `profile`, `prices`, `mandis`, `decision`,
  `weather`, `ask`.
- **Auth = real Supabase** via the backend's email/password endpoints. Farmer-friendly:
  the app maps **phone + password → a synthetic email** (`<phone>@fasalsaathi.app`).
  JWT + refresh token stored in AsyncStorage. An `AuthContext` + `GET /me` drives the
  "must finish profile" gate (`onboarding_complete`).
- **Reference data** (mandis/prices/warehouses) stays on backend fixtures —
  deterministic, offline, guaranteed-stable demo.
- **i18n**: a tiny `app/src/i18n.ts` (hi/en string maps + `useLang` from context),
  toggle on the Login/Signup screen, persisted.

### External dependencies (required for live auth)
1. `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_…` key) — backend uses it for
   `admin.createUser`, `signInWithPassword`, and `getUser`. **Without it no auth flow works.**
2. The `farmers` table must exist — apply
   `backend/supabase/migrations/20260613000000_init_farmers.sql` to the project.

## 3. Feature wiring (UI keeps the existing "bold field-app" style)

### Auth + onboarding
- Login/Signup with **hi/en toggle**. Signup (phone, name, password) → `/auth/signup`
  → store session. Login (phone, password) → `/auth/login`.
- **2-step onboarding** after first login while `onboarding_complete === false`:
  - **Step 1 — details**: full name + phone (prefilled from signup), Aadhaar (optional).
  - **Step 2 — farm**: location via GPS + **map pin** + village / district / **PIN code**
    (Zomato/Swiggy style), farm size + **unit dropdown** (Acre / Hectare / Bigha / Gaj),
    edit/save. → `POST /me/profile`.
- Gate blocks the 3 features until `onboarding_complete` is true.

### F1 — Mandi price track (Prices)
- Crop select (dropdown works end-to-end; **mic = stub** that shows the
  transcript→confirm flow with a typed/sample transcript).
- `GET /mandis/nearby?lat&lng&limit=10` (from farm GPS) → `GET /prices/history?commodity&mandi_id=<csv>&days=7`.
- Chart: per-day points with values; today/yesterday in large font.
- **Distance / transport / labour calculator** beside the big price: distance from
  `mandis/nearby.distance_km`; transport + labour estimated client-side from national-avg
  agriculture constants (documented in `INTEGRATION-GAPS.md`).

### F2 — Bechu ki Rakhu (SellOrStore)
- Form: crop, harvested? (yes/no), urgent cash need? (+ amount).
- Top-5 nearest mandis (from `/mandis/nearby`). For each mandi call
  `POST /decision` with `mandi_ids:[<one>]` and reshape to the **per-mandi card** in
  `output_format.md`: `decision` (HOLD/SELL), `wait_days`, `per_quintal` (sell_now,
  expected_at_D), `total`, and a **45-day `curve`**. Render a flashcard per mandi with
  the curve chart on top.
- **Backend change**: extend `POST /decision` to optionally return the per-mandi
  `output_format.md` shape incl. the 45-day curve (behind the same `ForecastProvider`;
  trained model swaps in later). Existing aggregate response + tests stay intact.

### F3 — Jaaniye (replaces the Learn tab)
- LLM Q&A + **lab-report photo upload** UI. Calls a new **`POST /ask`** backend
  **stub** (echoes the question + returns a friendly placeholder answer; accepts an
  optional image and returns a placeholder analysis). Real LLM connects later behind
  the same endpoint.

## 4. Gaps between FE and BE (filled in this work)
Tracked in `INTEGRATION-GAPS.md`. Summary:
- `/decision` returns an aggregate, not the per-mandi + 45-day-curve shape → reshape.
- No `/ask` endpoint → add stub.
- Onboarding unit "Gaj" not in backend enum (`acre|hectare|bigha`) → map Gaj→ value
  conversion / send nearest supported unit + keep display unit client-side.
- No PIN code / map pin in onboarding → add.
- Transport/labour calc has no backend → client-side national-avg constants.
- Login was phone-only & local → phone+password against Supabase (synthetic email).
- Voice STT not built → mic stub with transcript-confirm UX.

## 5. Testing
- Backend: `npm test` (vitest) + `npm run typecheck` stay green; add tests for the new
  `/decision` per-mandi shape and `/ask` stub.
- Frontend: `tsc --noEmit` clean; manual web-preview smoke of auth → onboarding → F1/F2/F3
  against a running backend.

## 6. Out of scope (later)
- Trained LightGBM model integration (AI-Layer) behind `ForecastProvider`.
- Real F3 LLM + lab-report vision.
- Real voice STT (e.g. Sarvam) behind the mic.
- Google OAuth sign-in (email/password path is built).
