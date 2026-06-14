# FasalSaathi — FE ⇄ BE Integration Gaps

Documented mismatches between the frontend (`app/`) and backend (`backend/`) teams,
and how each is resolved during integration. Status updated as gaps are closed.

| # | Gap | Side | Resolution | Status |
|---|-----|------|------------|--------|
| 1 | Frontend was 100% mock (local AsyncStorage profile, fake login) | FE | New `app/src/api` client + Supabase auth via backend endpoints | wiring |
| 2 | Login was phone-only & local; backend uses email/password | FE/BE | Phone+password mapped to synthetic email `<phone>@fasalsaathi.app` | wiring |
| 3 | `POST /decision` returns an **aggregate**, but `output_format.md` (F2 cards) needs **per-mandi + 45-day curve** | BE | Extend `/decision` to optionally emit the per-mandi `output_format.md` shape (incl. `curve[45]`) behind the same `ForecastProvider`; aggregate response + tests preserved | todo |
| 4 | No **`/ask`** endpoint for F3 (Jaaniye LLM) | BE | Add a `POST /ask` **stub** (echo + placeholder answer, optional image) | todo |
| 5 | Onboarding unit **"Gaj"** not in backend enum (`acre\|hectare\|bigha`) | FE/BE | Convert Gaj→acre for storage (1 acre ≈ 4840 gaj) and keep the farmer's chosen display unit client-side | wiring |
| 6 | No **PIN code** field / **map pin** in onboarding (spec wants Zomato-style) | FE | Add PIN field + map pin step; reverse-geocode already present | wiring |
| 7 | **Transport / labour cost** calculator has no backend source | FE | Compute client-side from national-average agriculture constants (documented below) | wiring |
| 8 | **Voice STT** not implemented (app is "voice-first") | FE/ML | Mic = stub showing transcript→confirm UX; real STT (Sarvam) later | wiring |
| 9 | Live auth needs the **service-role secret key** + the **farmers table** applied | infra | Request `sb_secret_…` key; apply `init_farmers` migration to the project | blocked-on-user |

## National-average constants (Gap 7) — client-side calculator
Used to estimate the cost of taking produce to a mandi (editable, clearly labelled as
estimates). Sourced from public Indian agri-logistics averages; refine later.

- **Transport:** ~₹6–10 / quintal / km (small farmer, hired vehicle). Default **₹8/q/km**.
- **Loading/unloading labour:** ~₹15–25 / quintal. Default **₹20/quintal**.
- **Mandi commission (arhtiya):** ~1.5–2.5% of sale value (display only). Default **2%**.

`cost = distance_km × ₹8 × quintals + ₹20 × quintals`. Net-in-hand = sale − transport −
labour − commission.

## Unit conversions (Gap 5)
- 1 hectare = 2.47105 acre
- 1 bigha ≈ 0.4 acre (varies by state; using the common ~0.4-acre pucca bigha)
- 1 acre ≈ 4840 gaj (sq. yard) — Gaj stored as its acre equivalent

## Blocked-on-user (Gap 9)
1. `SUPABASE_SERVICE_ROLE_KEY` = the `sb_secret_…` key (Supabase → Settings → API).
2. Apply `backend/supabase/migrations/20260613000000_init_farmers.sql` to the project
   (Supabase SQL editor or `supabase db push`).
