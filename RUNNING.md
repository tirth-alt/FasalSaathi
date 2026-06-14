# Running FasalSaathi (integrated)

Two parts: **`backend/`** (Hono API, port 8787) and **`app/`** (Expo / React Native).
The AI/ML layer (trained price model, F3 LLM, real voice STT) plugs in later behind
existing interfaces — everything else works now.

## 1. Backend

```bash
cd backend
npm install
npm run dev          # tsx watch, auto-loads .env, serves http://localhost:8787
npm test             # 111 passing
```

Public endpoints work immediately (mandi prices F1, /ask F3). The auth-gated parts
(signup/login, profile, sell-or-store F2) need the two steps below.

### ⛔ Two steps YOU must do for live auth
The backend uses Supabase. The project URL + publishable key are already in
`backend/.env`, but:

1. **Add the service-role secret key.** Supabase dashboard → Settings → API → copy
   the **`sb_secret_…`** key into `backend/.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxx
   ```
   (Used by the backend for `admin.createUser`, `signInWithPassword`, and JWT
   verification. Without it, every auth call fails.)

2. **Create the `farmers` table.** In the Supabase dashboard → SQL Editor, paste and
   run the contents of:
   ```
   backend/supabase/migrations/20260613000000_init_farmers.sql
   ```
   (This creates the `farmers` table + RLS. The second migration `*_price_reference.sql`
   is optional — prices are served from in-app fixtures.)

After both: signup → login → onboarding → all 3 features work end-to-end.

## 2. App (frontend)

```bash
cd app
npm install
npx expo start       # press "w" for web preview, or scan the QR in Expo Go
```

`app/.env` points the app at `http://localhost:8787`. On a **physical phone** set
`EXPO_PUBLIC_API_URL` to your laptop's LAN IP (same Wi-Fi). On an **Android emulator**
use `http://10.0.2.2:8787`.

Optional: enable real lab-report photo picking in F3 (Jaaniye):
```bash
npx expo install expo-image-picker
```
(Without it, the photo button attaches a demo marker so the flow still works.)

## User journey (what works now)
1. **Login / Signup** with a hi/en toggle (phone + password).
2. **2-step onboarding** — details, then farm location (GPS + map pin + village /
   district / PIN, Zomato-style) + farm size with unit dropdown (Acre/Hectare/Bigha/Gaj).
   Features stay locked until onboarding is complete.
3. **Home** — today's price for your crop + 3 feature cards.
4. **F1 Mandi prices** — voice-first (mic stub + transcript-confirm), 7-day chart with
   per-day points, today big, nearby mandis, and a distance/transport/labour calculator.
5. **F2 Bechu ki Rakhu** — crop / harvested? / urgent-cash form → per-mandi flashcards
   (HOLD/SELL, wait-days, expected ₹/qtl, sell-now total) + a 45-day forecast curve.
6. **F3 Jaaniye** — ask a farming question + upload a lab-report photo → placeholder
   answer (real LLM/vision connects later behind `POST /ask`).
