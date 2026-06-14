# FasalSaathi Backend — API Contract

Base URL (local): `http://localhost:8787`

All responses are JSON. Errors share one envelope:

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

`details` is present only for validation errors (Zod field errors).

## Authentication

The reference-data endpoints — `GET /mandis/nearby`, `GET /prices/history`, and
`GET /warehouses` — are **PUBLIC** (no auth): they expose only non-sensitive market
reference data with no farmer data involved, and the client needs them at
onboarding (before a session is fully established) to compute the stable
nearest-mandi set. Every other endpoint except `GET /health`, `POST /auth/signup`,
and `POST /auth/login` requires a Supabase Auth JWT:

```
Authorization: Bearer <supabase_jwt>
```

There are two ways to obtain that JWT:

1. **Google OAuth (primary):** the client signs in through **Supabase Auth with the
   Google provider** (handled client-side / by Supabase). Signup is **implicit** —
   on the first authenticated request the backend auto-creates the farmer row
   (load-or-create) with `onboarding_complete = false`.
2. **Email/password:** call `POST /auth/signup` then `POST /auth/login` (below).
   These return a Supabase session whose `access_token` is used as the Bearer JWT
   for all other endpoints.

The backend VERIFIES the JWT via `supabase.auth.getUser(token)` and resolves the
farmer row keyed by the auth user id.

Auth failures return `401 { "error": { "code": "unauthorized", ... } }`. The token,
the password, and any Aadhaar data are never echoed back.

---

## POST /auth/signup

Public. Creates an email/password account and returns a session. Intended for
clients that don't use Google sign-in.

This calls the Supabase **admin** `createUser` API with `email_confirm: true`, so
**no confirmation email is sent** — the account is usable immediately. This is a
deliberate DEMO choice; a production build would require email verification.
After creating the auth user it inserts the matching `farmers` row
(`id` = the new auth user id, `onboarding_complete = false`) and then signs in to
return a session.

**Headers:** `Content-Type: application/json`

**Request body:**
```json
{
  "email": "ramesh@example.in",
  "password": "correct-horse-1",
  "full_name": "Ramesh Kumar",
  "phone": "+919812345670"
}
```

Field rules:
- `email` — required; valid email.
- `password` — required; **min 8 characters**. Never logged or returned.
- `full_name` — optional; non-empty string. Stored on the farmer row if present.
- `phone` — optional; Indian format `(+91|0)?[6-9]\d{9}`.

**201** — account created:
```json
{
  "user": {
    "id": "uuid",
    "created_at": "2026-06-13T10:00:00.000Z",
    "updated_at": "2026-06-13T10:00:00.000Z",
    "full_name": "Ramesh Kumar",
    "phone": "+919812345670",
    "preferred_language": "hi",
    "aadhaar_last4": null,
    "farm_lat": null,
    "farm_lng": null,
    "farm_district": null,
    "farm_state": null,
    "farm_village": null,
    "farm_area_value": null,
    "farm_area_unit": null,
    "primary_crops": null,
    "land_record_id": null,
    "onboarding_complete": false
  },
  "session": {
    "access_token": "<supabase_jwt>",
    "refresh_token": "<refresh_token>",
    "expires_at": 1760000000
  }
}
```

`user` is the **safe farmer shape** (same projection as `GET /me`; `aadhaar_enc` and
any plaintext are never present).

**400** — validation error (`code: "validation_error"`), or invalid JSON
(`code: "invalid_json"`).

**409** — email already registered:
```json
{ "error": { "code": "email_taken", "message": "An account with this email already exists" } }
```

---

## POST /auth/login

Public. Verifies email/password via Supabase `signInWithPassword` and returns a
session + the safe farmer. If the farmer row is missing (e.g. a Google-first user
logging in by password), it is created (load-or-create).

**Headers:** `Content-Type: application/json`

**Request body:**
```json
{ "email": "ramesh@example.in", "password": "correct-horse-1" }
```

**200** — same `{ user, session }` shape as `POST /auth/signup`.

**400** — validation error or invalid JSON.

**401** — bad credentials (does not reveal whether the email exists):
```json
{ "error": { "code": "invalid_credentials", "message": "Invalid email or password" } }
```

---

## GET /health

Public. No auth.

**200**
```json
{ "status": "ok", "service": "fasalsaathi-backend", "time": "2026-06-13T10:01:03.300Z" }
```

---

## GET /me

Returns the authenticated farmer's profile in the **safe shape**: Aadhaar is
represented ONLY by `aadhaar_last4`. The encrypted value (`aadhaar_enc`) and any
plaintext are never returned.

**Headers:** `Authorization: Bearer <supabase_jwt>`

**200**
```json
{
  "farmer": {
    "id": "uuid",
    "created_at": "2026-06-13T10:00:00.000Z",
    "updated_at": "2026-06-13T10:00:00.000Z",
    "full_name": "Ramesh Kumar",
    "phone": "+919812345670",
    "preferred_language": "hi",
    "aadhaar_last4": "9012",
    "farm_lat": 19.9975,
    "farm_lng": 73.7898,
    "farm_district": "Nashik",
    "farm_state": "Maharashtra",
    "farm_village": "Pimpalgaon",
    "farm_area_value": 2.5,
    "farm_area_unit": "acre",
    "primary_crops": ["onion", "grapes"],
    "land_record_id": "MH-NSK-DEMO-001",
    "onboarding_complete": true
  }
}
```

**401** — missing/invalid token.

---

## POST /me/profile

Create / complete the authenticated farmer's own profile. Upserts the caller's
own row (always scoped to the verified `auth.uid()`).

If `aadhaar` (12 digits) is supplied it is encrypted at rest (AES-256-GCM) into
`aadhaar_enc` and `aadhaar_last4` is derived. `onboarding_complete` is set to
`true` automatically when all required onboarding fields are present
(`full_name`, `farm_district`, `farm_state`, `farm_area_value`, `farm_area_unit`,
`primary_crops`).

**Headers:** `Authorization: Bearer <supabase_jwt>`, `Content-Type: application/json`

**Request body** (all fields except `full_name` optional):
```json
{
  "full_name": "Ramesh Kumar",
  "phone": "+919812345670",
  "preferred_language": "hi",
  "aadhaar": "123456789012",
  "farm_lat": 19.9975,
  "farm_lng": 73.7898,
  "farm_district": "Nashik",
  "farm_state": "Maharashtra",
  "farm_village": "Pimpalgaon",
  "farm_area_value": 2.5,
  "farm_area_unit": "acre",
  "primary_crops": ["onion", "grapes"],
  "land_record_id": "MH-NSK-DEMO-001"
}
```

Field rules:
- `full_name` — non-empty string (required).
- `phone` — optional; Indian format `(+91|0)?[6-9]\d{9}`.
- `preferred_language` — defaults to `"hi"`.
- `aadhaar` — optional; exactly 12 digits. Never logged or returned.
- `farm_area_unit` — one of `acre`, `hectare`, `bigha`.
- `farm_area_value` — positive number.
- `primary_crops` — array of non-empty strings.

**200** — returns the safe farmer shape (same as `GET /me`).

**400** — validation error:
```json
{ "error": { "code": "validation_error", "message": "Invalid profile payload", "details": { "fieldErrors": { "farm_area_unit": ["Invalid enum value..."] } } } }
```

**401** — missing/invalid token.

---

## PUT /me/profile

Partial update of the authenticated farmer's own profile. Same field rules as
POST, but **every field is optional**. At least one field must be provided.
`onboarding_complete` is recomputed against the merged row.

**Headers:** `Authorization: Bearer <supabase_jwt>`, `Content-Type: application/json`

**Request body** (example):
```json
{ "preferred_language": "mr", "primary_crops": ["soybean"] }
```

**200** — returns the safe farmer shape.

**400** — validation error, or `"No fields to update"` if the body is empty.

**401** — missing/invalid token.

---

## Data source (price/mandi/warehouse endpoints)

The mandi, daily-price, and warehouse data below is served from **in-app fixtures**
behind repository interfaces (`src/lib/repositories.ts`). Docker was unavailable in
the build environment (no local Postgres) and the live Agmarknet API is down, so a
**committed synthetic dataset** is the guaranteed-demo data source.

Daily prices are a **saved snapshot** at `src/data/prices.generated.json` — the
source of truth ("this is what the gov API returned"). It is produced by
`scripts/gen-prices.ts` (`npx tsx scripts/gen-prices.ts`) using a seeded PRNG, so
re-running yields byte-identical output and the app **never regenerates at runtime**.
`src/data/prices.ts` is the typed accessor; `FixturePriceRepository` loads it.

Dataset facts:
- Region: Nashik district, Maharashtra (demo farm = Pimpalgaon Baswant), plus the
  retained MP cluster (Indore/Dewas/Ujjain).
- Commodities: `onion, tomato, soybean, maize, wheat, bajra, gram, pomegranate`.
- Window: 30 calendar days ending **2026-06-13** (Saturday), inclusive — for every
  mandi × every commodity.
- **Sundays are absent** (APMC mandis are closed on Sunday → the series has gaps).
  2026-06-14 is a Sunday and is not included; the latest entry is 2026-06-13.

A Supabase schema (`supabase/migrations/*_price_reference.sql`) + seed exist as the
**documented future-swap path**: a DB-backed (or live-Agmarknet) repository
implements the same interface with no route changes.

---

## GET /mandis/nearby

**PUBLIC** (no auth). Returns the nearest mandis to a point, sorted nearest-first,
each with `distance_km` (great-circle, 1 decimal). Used at onboarding to compute the
farmer's stable "8–10 nearest mandis" set (feeds F1 + F2).

**Query params:**
- `lat` — required; `-90..90`.
- `lng` — required; `-180..180`.
- `limit` — optional; positive integer, max 50, **default 10**.

**Example:** `GET /mandis/nearby?lat=22.7196&lng=75.8577&limit=3`

**200**
```json
{
  "mandis": [
    { "mandi_id": "IND-001", "name": "Indore (Chhawni)", "district": "Indore", "state": "Madhya Pradesh", "lat": 22.7196, "lng": 75.8577, "distance_km": 0 },
    { "mandi_id": "IND-002", "name": "Indore (Laxmibai Nagar)", "district": "Indore", "state": "Madhya Pradesh", "lat": 22.7533, "lng": 75.8723, "distance_km": 4 },
    { "mandi_id": "IND-003", "name": "Mhow", "district": "Indore", "state": "Madhya Pradesh", "lat": 22.556, "lng": 75.761, "distance_km": 20.7 }
  ]
}
```

**400** — validation error (missing/out-of-range `lat`/`lng`, non-positive `limit`),
`code: "validation_error"`.

---

## GET /prices/history

**PUBLIC** (no auth). Recent daily **modal** price (₹/quintal) per mandi for a
commodity. Feeds F1's animated 5-day-per-mandi trend chart.

**Query params:**
- `commodity` — required; non-empty. One of `onion, tomato, soybean, maize, wheat,
  bajra, gram, pomegranate`.
- `mandi_id` — required; a single id **or** comma-separated list (e.g.
  `NSK-PIM,NSK-LAS,NSK-NIP`). F1 typically passes the 8–10 nearby mandis.
- `days` — optional; positive integer, max 30, **default 5**. Counts the most recent
  **trading** days (Sundays are already absent), newest last.

**Unknown-mandi handling:** if **all** requested `mandi_id`s are unknown → `400`
(`code: "unknown_mandi"`). If **some** are unknown, the known ones are returned and
the unknown ids are reported in `unknown_mandi_ids`.

**Example:** `GET /prices/history?commodity=onion&mandi_id=NSK-PIM,NSK-LAS&days=3`

**200**
```json
{
  "source": "Agmarknet (data.gov.in)",
  "series": [
    {
      "mandi_id": "NSK-PIM",
      "commodity": "onion",
      "series": [
        { "date": "2026-06-11", "modal_price": 1676, "min_price": 1615, "max_price": 1729 },
        { "date": "2026-06-12", "modal_price": 1662, "min_price": 1610, "max_price": 1726 },
        { "date": "2026-06-13", "modal_price": 1685, "min_price": 1633, "max_price": 1746 }
      ]
    }
  ]
}
```

- `source` — provenance label for the dataset (additive field). The series omit
  Sundays (APMC closed); the latest date is **2026-06-13**.

When some ids are unknown, the body also carries `"unknown_mandi_ids": ["NOPE-999"]`.

**400** — `validation_error` (missing `commodity`/`mandi_id`) or `unknown_mandi`
(all ids unknown).

---

## GET /weather

**PUBLIC** (no auth). Proxies **Open-Meteo** (live, keyless) for a lat/lng and
returns the 7-day daily forecast plus a derived `quality_risk` band (spec §3 B5).
Also the source of the live weather modifier in `POST /decision`.

`quality_risk` is derived from `rain_3d_mm` (total precipitation over the next 3
days — the open-storage horizon): `< 25mm → low`, `25–60mm → med`, `≥ 60mm → high`.

**Query params:**
- `lat` — required; `-90..90`.
- `lng` — required; `-180..180`.

**Example:** `GET /weather?lat=22.7196&lng=75.8577`

**200**
```json
{
  "lat": 22.7196,
  "lng": 75.8577,
  "quality_risk": "low",
  "rain_3d_mm": 2.1,
  "daily": [
    { "date": "2026-06-13", "precipitation_mm": 0, "temp_max": 38.2 },
    { "date": "2026-06-14", "precipitation_mm": 2.1, "temp_max": 36.4 },
    { "date": "2026-06-15", "precipitation_mm": 0, "temp_max": 36.3 }
  ]
}
```
(`daily` carries all 7 days; trimmed here. The example values are real Open-Meteo
output for Indore on 2026-06-13.)

**400** — `validation_error` (missing/out-of-range `lat`/`lng`).

**503** — `weather_unavailable` (Open-Meteo unreachable/timed out). The client
should fall back gracefully.

---

## POST /decision

**AUTH-PROTECTED** (`Authorization: Bearer <jwt>`, same as `/me`). The hold-or-sell
engine (F2 v0). Computes today's price across the chosen mandis, runs the explainable
**seasonal+trend ForecastProvider** (v0; a trained model v1 swaps in behind the same
interface), and runs the store-vs-sell arithmetic.

**Live weather modifier (spec §2 signal 3):** if the farmer has a pinned farm
location, the decision fetches the **live Open-Meteo** forecast for that point and
derives a `quality_risk` band (see `GET /weather`). Per spec, weather **widens the
forecast range** (adds a quality-risk driver + decision risk) but **does NOT move the
centre** — heavy rain is uncertainty, not a directional price call. This replaces the
old seasonal-month monsoon stand-in with the actual rain forecast. Weather is
**best-effort**: if Open-Meteo is unavailable or no farm location is set, the decision
is still produced and `weather_quality_risk` is `null` (offline-first).

**`today_price` aggregation:** the **average** of the latest modal price across the
chosen mandis (smooths single-mandi noise; reflects the multi-mandi price compass).
Mandis with no data for the commodity are skipped.

**Headers:** `Authorization: Bearer <supabase_jwt>`, `Content-Type: application/json`

**Request body:**
```json
{
  "commodity": "soybean",
  "quantity_quintal": 100,
  "mandi_ids": ["IND-001", "DEW-001"],
  "cash_need_inr": 100000,
  "horizon_weeks": 8
}
```

Field rules:
- `commodity` — required; non-empty.
- `quantity_quintal` — required; positive number.
- `mandi_ids` — optional. If absent, derived from the farmer's `farm_lat`/`farm_lng`
  (8 nearest mandis). If absent **and** the farmer has no farm location → `400`
  (`code: "location_required"`).
- `cash_need_inr` — optional; non-negative. If it exceeds the pledge-loan
  availability (`LTV 0.70 × today_value`), the decision is forced to **SELL**.
- `horizon_weeks` — optional; positive integer, max 52, **default 4**.
- `per_mandi` — optional boolean, **default false**. When `true`, the response is
  the **per-mandi card** shape below instead of the aggregate shape. See
  "Per-mandi mode".

**200** — STORE example (post-harvest, positive forecast):
```json
{
  "recommendation": "STORE",
  "commodity": "soybean",
  "quantity_quintal": 100,
  "mandi_ids": ["IND-001", "DEW-001"],
  "today_price": 4974,
  "sell_now_inr": 497400,
  "expected_future_price": 5541,
  "forecast": {
    "horizon_weeks": 8,
    "expected_change_pct": 11.4,
    "low_pct": 1.2,
    "high_pct": 21.6,
    "drivers": ["seasonal post-harvest rise", "upward 30-day price trend"],
    "confidence": "low"
  },
  "store_gain_inr": 47679,
  "breakeven_weeks": 1,
  "risks": ["wide forecast range — high price uncertainty", "low forecast confidence"],
  "weather_quality_risk": "low"
}
```

**200** — SELL example (cash need forces immediate sale):
```json
{
  "recommendation": "SELL",
  "commodity": "soybean",
  "quantity_quintal": 100,
  "mandi_ids": ["IND-001", "IND-002", "DEW-001"],
  "today_price": 4739,
  "sell_now_inr": 473900,
  "expected_future_price": 4692,
  "forecast": {
    "horizon_weeks": 4,
    "expected_change_pct": -1,
    "low_pct": -10,
    "high_pct": 8,
    "drivers": ["seasonal pre-harvest / new-crop pressure", "stable recent prices", "heavy rain forecast — high quality risk for open storage"],
    "confidence": "medium"
  },
  "store_gain_inr": -9125,
  "breakeven_weeks": null,
  "risks": [
    "forecast range crosses zero — price could fall while stored",
    "immediate cash need (₹600000) exceeds pledge-loan availability (₹331730) — must sell now",
    "heavy rain forecast — high quality risk for open storage"
  ],
  "weather_quality_risk": "high"
}
```

The forecast is always presented as a **range + drivers**, never a bare number
(*anumaan, not bhavishyavani* — spec §2). eNWR constants used by the math:
`LTV 0.70`, interest `0.10/yr`, storage `₹20/quintal/month`. `weather_quality_risk`
is `low | med | high | null` (null = weather unavailable / no farm location).

**400** — `validation_error`, `invalid_json`, `unknown_mandi` (all provided ids
unknown), `location_required` (no ids + no farm location), or `no_price_data` (no
price for the commodity at the selected mandis).

**401** — missing/invalid token.

### Per-mandi mode (`per_mandi: true`) — F2 flashcards

When the request carries `"per_mandi": true`, the engine prices **each resolved
mandi independently** (each mandi on its OWN latest modal + its OWN momentum
series — **not** the cross-mandi average) and returns one **card per mandi** for
the frontend to render as a flashcard. The forecaster and store-vs-sell math are
run per mandi; the live weather quality-risk is the farm's single location, so it
is shared across mandis as a range modifier. Mandis with no price data for the
commodity are **skipped**; if none have data → `400 no_price_data`.

Response: `{ "cards": [ <card>, ... ] }`. Each `<card>`:

```json
{
  "mandi_id": "IND-001",
  "mandi_name": "Indore (Chhawni)",
  "district": "Indore",
  "state": "Madhya Pradesh",
  "distance_km": 0,
  "decision": "HOLD",
  "wait_days": { "best": 21, "range": [16, 26] },
  "good_sale_window_day": 21,
  "max_hold_days": 180,
  "quantity_qtl": 50,
  "confidence": "high",
  "per_quintal": {
    "sell_now": 4490,
    "expected_at_D": { "mid": 4848, "range": [4221, 5475] },
    "storage_cost": 63,
    "expected_gain": 295
  },
  "total": {
    "sell_now": 224500,
    "expected_at_D": { "mid": 242400, "range": [211050, 273750] },
    "storage_cost": 3150,
    "expected_gain": 14750
  },
  "curve": [
    { "day": 1, "price": 4490, "low": 4477, "high": 4504 },
    { "day": 2, "price": 4507, "low": 4480, "high": 4535 }
  ]
}
```

Card field notes:
- `decision` — `"HOLD"` (STORE) or `"SELL"`.
- `distance_km` — great-circle km from the farm (1 decimal); `null` when the farmer
  has no pinned farm location (e.g. explicit `mandi_ids` and no farm coords).
- `good_sale_window_day` / `wait_days.best` — days from today to the best expected
  sale (the soonest profitable day for HOLD, day **1** for SELL). `wait_days.range`
  brackets it (±25%).
- `max_hold_days` — crop shelf-life cap (days). Per-crop **stand-in table** (e.g.
  soybean/maize/bajra/gram 180, wheat 240, onion 90, pomegranate 30, tomato 14); a
  sourced crop-master table swaps in later. Unknown crops → 120.
- `confidence` — `"high"` / `"low"`. The forecaster's `medium` maps to `"high"`
  (still a familiar, data-backed mandi); `low` = unfamiliar mandi / high uncertainty.
- `per_quintal` — all integers (₹/quintal). The identity
  `expected_gain == expected_at_D.mid − sell_now − storage_cost` holds exactly.
  `storage_cost` is the per-quintal holding cost (storage **+** pledge-loan interest)
  over the horizon.
- `total` — `per_quintal × quantity_qtl` (integers).
- `curve` — a **45-day** array `[{ day, price, low, high }]`. **v0 stand-in**, built
  deterministically from the forecast: day 1 anchored at `sell_now`, trending toward
  `expected_at_D.mid` by the good-sale day then flat to day 45; the `low`/`high` band
  widens over time from ~0 at day 1 to the forecast's full `low_pct`/`high_pct` band
  by the good-sale day. The v1 trained model plugs in behind the SAME
  `ForecastProvider` interface and the curve consumes its output unchanged.

The same `400` codes as the aggregate mode apply.

---

## POST /ask

**PUBLIC** (no auth). F3 "Jaaniye" ask-a-question endpoint. **STUB** — it echoes the
question with a friendly "coming soon" message; the real LLM (+ vision for
lab-report photos) plugs in behind this same endpoint and contract later.

**Headers:** `Content-Type: application/json`

**Request body:**
```json
{ "question": "सोयाबीन कब बेचूं?", "lang": "hi", "image_base64": "<base64>" }
```

Field rules:
- `question` — required; non-empty (trimmed).
- `lang` — optional; `"hi"` or `"en"`, **default `"hi"`**.
- `image_base64` — optional; a lab-report photo. Not parsed in the stub; sets
  `has_image` and appends a "lab-report analysis coming soon" line to the answer.

**200**
```json
{
  "answer": "आपने पूछा: \"सोयाबीन कब बेचूं?\". यह सुविधा जल्द ही उपलब्ध होगी — हमारा AI सलाहकार अभी जुड़ रहा है।",
  "has_image": false,
  "disclaimer": "यह एक डेमो प्लेसहोल्डर है, असली कृषि सलाह नहीं।",
  "stub": true
}
```

`answer` is in the requested language and echoes the question; `disclaimer` notes
this is a demo placeholder, not real agronomic advice; `stub` is always `true`
until the provider lands.

**400** — `validation_error` (empty question / invalid `lang`) or `invalid_json`
(malformed body).

---

## GET /warehouses

**PUBLIC** (no auth). Nearest curated WDRA/PACS warehouses (no public WDRA API
exists — this is a curated fixture). Feeds the storage leg of the decision.

**Query params:**
- `lat` + `lng` — optional **pair** (both or neither); if given, results are sorted
  by distance with `distance_km` attached.
- `district` — optional; filters to that district (case-insensitive).
- `limit` — optional; positive integer, max 50, **default 10**.

With both `district` and `lat`/`lng`, it filters by district then sorts by distance.
With neither, it returns the full curated list (capped at `limit`).

**Example:** `GET /warehouses?lat=22.7196&lng=75.8577&limit=3`

**200**
```json
{
  "warehouses": [
    { "warehouse_id": "WH-IND-01", "name": "CWC Warehouse Indore", "district": "Indore", "state": "Madhya Pradesh", "lat": 22.7044, "lng": 75.8741, "capacity": 12000, "cost_per_quintal_month": 20, "distance_km": 2.4 },
    { "warehouse_id": "WH-IND-03", "name": "Adani Agri Logistics Indore", "district": "Indore", "state": "Madhya Pradesh", "lat": 22.801, "lng": 75.912, "capacity": 15000, "cost_per_quintal_month": 24, "distance_km": 10.6 }
  ]
}
```

`capacity` is in metric tonnes; `cost_per_quintal_month` is ₹/quintal/month
(consistent with the `₹20/q/mo` storage constant family).

**400** — `validation_error` (e.g. `lat` without `lng`, out-of-range coords).

---

## External data clients (`src/lib/external/`)

Real clients for the government/external data APIs (spec §5). Each is a plain
class with an **injectable `fetchImpl`** (defaults to global `fetch`) so it is
unit-tested with a fake fetch and the network is never hit in `npm test`.

| Client | Source | Status (2026-06-13) | Used by |
|---|---|---|---|
| `OpenMeteoWeatherProvider` (`weather.ts`) | Open-Meteo | **LIVE**, keyless | `GET /weather` + `POST /decision` quality-risk modifier |
| `AgmarknetClient` (`agmarknet.ts`) | data.gov.in | **DOWN** (502 / timeout) | none yet — "ready for recovery"; live-refresh path for B3 later |
| `CedaClient` (`ceda.ts`) | CEDA Ashoka | host up; data endpoint **TBD** | none yet — backbone for the seasonal index (offline `build_forecast` job) |

**Failure discipline:**
- `OpenMeteoWeatherProvider.getForecast` **throws** `WeatherUnavailableError` on
  any network/HTTP/parse failure; callers decide how to degrade. The `/weather`
  route maps it to **503**; `/decision` catches it and proceeds without the
  modifier (`weather_quality_risk: null`).
- `AgmarknetClient` **never throws** — every call returns a typed
  `{ available: true, records } | { available: false, reason, status? }`, plus a
  `checkHealth()` up/down probe. No endpoint depends on it being up.
- `CedaClient` is a **shell** (the Swagger UI at `/documentation/` is JS-rendered
  and exposes no machine-readable OpenAPI JSON from our probes, so the data
  endpoint is **not guessed**). `fetchSpec()` probes for a spec at runtime;
  `getMonthlyTrend()` returns `{ available: false }` until `dataPath` is confirmed.

**Live verification (real evidence, on demand):**
- `npm run check:external` — calls each API and prints what comes back (human-readable).
- `npm run test:live` — env-guarded (`RUN_LIVE_TESTS=1`) vitest suite that hits the
  network. Excluded from the default `npm test` so that stays deterministic.

**Config:** `DATA_GOV_IN_API_KEY` (zod env, defaults to the rate-limited public
sample key). Open-Meteo + CEDA need no key.

### Documented next steps (out of scope here)
- **Daily prices (post-Supabase):** the live Agmarknet API is down, so the real
  daily price dataset comes from the Kaggle "Daily Market Prices of Commodity India
  2001–2026" (khandelwalmanas) imported into a `DbPriceRepository` behind the
  existing `PriceRepository` interface. `/prices/history` + `/mandis/nearby` stay on
  fixtures until then.
- **CEDA endpoint:** confirm the monthly-price path from the OpenAPI spec (open
  `https://api.ceda.ashoka.edu.in/documentation/` in a browser), then set
  `CedaClient { dataPath, authHeader? }` and implement `mapResponse()`. This feeds
  the offline `build_forecast` seasonal-index job (spec §2).
