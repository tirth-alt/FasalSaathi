# Bech ya Rakh — Sell-or-Hold Forecast & Decision Engine (Design Spec)

*Date: 2026-06-13. Module 2 of FasalSaathi (see `AGRI-BRAINSTORM.md`).*

## 1. Goal

Help a farmer answer, in one step: **"Should I sell my crop today, or hold it — and if I hold, how many days until a good sale?"**

The farmer picks his crop (one of 325, optionally variety + mandi), the system is fed the **latest ~10 days of that crop's mandi prices (current, e.g. 2026)**, and it returns a **SELL or HOLD** recommendation with the supporting arithmetic, the **expected good-sale window (wait ~X days)**, and a downside range.

This is the differentiator module. It directly attacks distress selling (the #1 exploitation mechanism in `AGRI-BRAINSTORM.md`).

## 2. Core principle

Per `AGRI-BRAINSTORM.md` line 76: **"calculation, not prediction" at the surface.** The ML forecast supplies the "price in N days" number, but the farmer-facing output always shows the arithmetic and a range — never a bare command. The forecast is one transparent input, not a black box verdict.

## 3. Key design decisions

### 3.1 One global model, not 325
A single LightGBM model is trained over **all 325 crops pooled together**, with `crop`, `variety`, `state`, `district`, `market` as categorical features. The model learns shared price dynamics (post-harvest glut → recovery, arrivals/weather effects) once; data-rich crops strengthen forecasts for data-poor ones. The farmer's crop choice is just a feature value at inference.

### 3.2 Predict *movement*, not *level* — so old data forecasts new prices
**The caveat:** training data is 2005–2024; at inference we feed *current 2026* prices. A model trained on absolute rupees would anchor to stale 2007-era levels and systematically under-predict 2026 prices.

**The fix — scale-invariant targets:**
- **Target = multiplicative factor (return), not rupees.** The model predicts `price(t+h) / price(t)`, i.e. the *shape* of the move (e.g. +6% seasonal recovery, −4% glut dip), not an absolute value.
- **Features are ratios too** — the last-10-day price lags are expressed relative to the latest price, so nothing in the model is tied to a specific year's rupee level.
- **Reconstruct absolute price at inference:** the route's latest 2026 price is the *anchor*. `forecast(2026, d) = current_2026_price × predicted_factor(d)`.

**Why it works:** the *patterns* of movement are stable across years even as absolute rupees drift upward; that stability is what transfers to 2026. **Old data teaches the shape; fresh prices set the level.**

### 3.3 Multi-horizon → trajectory → optimal wait window
The model predicts the **whole price curve for the next ~45 days**, not a single horizon. Horizon `h` is a model feature, so one model emits the full trajectory `factor(h)` for `h = 1..45`. The decision engine searches this curve for the best day to sell.

### 3.4 Inference input = last 10 days only
At predict-time only ~10 days of history are available (the "route"). **Every feature must be computable from 10 days + the calendar.** Lags 1–10, a 10-day rolling mean / slope / volatility, and latest arrivals — *no* 30-day lag. Calendar features (month, week-of-year, day-of-year, harvest-season flag) are always known.

## 4. Architecture — 5 independent, testable components

1. **Loader / normalizer** (`data_loader.py`)
   - Reads any of the 325 CSVs. Unifies schema variations: column names (`Arrivals (Tonnes)` vs `Arrivals`, `Min Price (Rs./Quintal)` vs `Min Price`) and date formats (`12 Jan 2007` vs `2005-08-24`).
   - Output standard schema: `crop, state, district, market, variety, group, arrivals, min_price, max_price, modal_price, date`.
   - Testable on a single file.

2. **Feature builder** (`features.py`)
   - Per (crop, market, variety) series sorted by date, builds training rows.
   - **Features (all scale-invariant):** price-lag ratios for days 1–10 (`lag_k / latest`), 10-day rolling mean ratio, 10-day slope, 10-day volatility, latest arrivals (log), calendar (month, week-of-year, day-of-year, harvest-season flag), categoricals (crop, state, district, market, variety, group), and **horizon `h`**.
   - **Target:** `modal_price(t+h) / modal_price(t)` for `h ∈ {1..45}` (multiple horizon rows per anchor date).
   - Testable: given a known series, asserts correct lag/target math.

3. **Trainer** (`train.py`)
   - One global LightGBM regression model over all crops & all horizons.
   - **Time-based split (never random):** train on past, validate on the most recent period.
   - **Cross-year generalization test:** train on ≤2022, evaluate on 2023–2024 (higher, unseen price levels) to prove the %-target approach transfers — direct evidence it will handle 2026.
   - Saves model artifact + metrics report.

4. **Forecaster** (`forecast.py`)
   - Input: crop (+ variety/mandi) and the last 10 days of prices.
   - Builds the 10-day-window features, queries the model for `h = 1..45`, returns the absolute price curve `current_price × factor(h)` plus a **confidence band** derived from validation residuals per horizon.
   - **Unknown / unseen categoricals (cold-start) — graceful fallback.** A farmer may pass a mandi (or variety) the model never saw in training. Because the *level* comes from the farmer's own anchor price, only the *trend shape* needs a fallback. Strategy:
     - **Geographic back-off:** unknown `market` → use `district` → `state` → crop-national pattern. The forecast is produced at the most specific level the model actually knows; the market feature is set to "unknown" (LightGBM handles missing/unseen categoricals natively) and the model leans on crop + region + season + the 10-day momentum.
     - **Crop/variety back-off:** unknown `variety` → drop to crop level; unknown `crop` → fall back to its `Group`; if the crop is entirely unrecognized → **reject with a clear message** (we can't anchor perishability or dynamics).
     - **Honesty flag:** when any back-off is used, widen the confidence band and return a `confidence` field (e.g. `"low — unfamiliar mandi; using <district/state> pattern"`) so the UI/decision can hedge (bigger risk margin → bias toward SELL when uncertain).
     - **Input validation:** if the passed city isn't a known mandi at all, suggest the nearest known mandi(s) for that crop rather than silently guessing.

5. **Decision engine** (`decision.py`)
   - `bech_ya_rakh(crop, mandi, quantity, cash_need_now, storage_cost_per_qtl_month, max_wait_days)`.
   - **Per-crop perishability cap (MVP: hardcoded).** Wait time is not the same for all crops — perishables dilute fast and cannot be held. A hardcoded table (see 4.6) gives each crop a `max_hold_days` and a daily `quality_decay` factor. The search window is capped at `min(user max_wait_days, crop max_hold_days)`, and held value is discounted by accumulated decay.
   - For each future day `d`: `expected_net(d) = forecast(d) × (1 − quality_decay)^d − d × daily_storage_cost`.
   - `d* = argmax expected_net(d)` over `d ≤ min(max_wait_days, max_hold_days)` → **good-sale window**. Highly perishable crops (`max_hold_days ≈ 0–2`) effectively force **SELL now**, regardless of the forecast.
   - Decision: if `expected_net(d*) − sell_now_net` clears a risk margin (and cash need is satisfiable, e.g. via the pledge-loan path noted in the brainstorm) → **HOLD ~d\* days**, else **SELL now**.
   - **Quantity scales every rupee figure into a total for the whole lot.** Per-quintal forecasts are multiplied by `quantity_qtl` so the farmer sees what his actual harvest is worth now vs. at the good-sale window — that is the number he decides on.
   - Output includes: `decision`, `wait_days` (range), `good_sale_window` (~date — *when to expect good prices and sell*), and **both per-quintal and total (×quantity)** figures for: `sell_now`, `expected_at_D` (range), `storage_cost`, `expected_gain`; plus `downside_risk` and `reasoning`.

### 4.6 Per-crop perishability table (MVP, hardcoded)

A small lookup (`perishability.py`) maps crop → `{max_hold_days, quality_decay_per_day}`. Hand-curated for the demo crops; everything else falls back to its `Group` (Fruits/Vegetables → short, Oil Seeds/Cereals/Pulses/Spices → long) and finally a safe default. Illustrative values:

| Crop / group | max_hold_days | quality_decay/day | Behaviour |
|---|---|---|---|
| Tomato, Green Leafy | 1–2 | high | almost always SELL now |
| Onion | ~30 | low-med | can hold weeks (cured) |
| Banana, most Fruits | 3–7 | high | short hold |
| Soyabean, Wheat, Pulses, Oil Seeds | 90–180 | ~0 | full forecast window usable |
| *(fallback by Group)* | per group | per group | — |

This is an MVP shortcut; a later version can replace it with crop-specific spoilage/storage-condition models. The table lives in one file so swapping it out is isolated.

## 5. Interface contract

**Input (route):**
```json
{
  "crop": "Soyabean",
  "variety": "Local",
  "mandi": {"state": "Madhya Pradesh", "district": "Dewas", "market": "Dewas"},
  "last_10_days": [{"date": "2026-06-04", "modal": 4650, "min": 4500, "max": 4800, "arrivals": 120}, ...],
  "quantity_qtl": 50,
  "cash_need_now": 30000,
  "storage_cost_per_qtl_month": 9,
  "max_wait_days": 45
}
```

**Output** (quantity = 50 qtl in this example):
```json
{
  "decision": "HOLD",
  "wait_days": {"best": 21, "range": [14, 28]},
  "good_sale_window": "2026-07-04",
  "quantity_qtl": 50,
  "per_quintal": {
    "sell_now": 4650,
    "expected_at_D": {"mid": 5180, "range": [4900, 5450]},
    "storage_cost": 27,
    "expected_gain": 503
  },
  "total": {
    "sell_now": 232500,
    "expected_at_D": {"mid": 259000, "range": [245000, 272500]},
    "storage_cost": 1350,
    "expected_gain": 25150
  },
  "downside_risk": "If price falls, you could lose ~₹250/qtl (~₹12,500 total)",
  "confidence": "high",
  "reasoning": "Post-harvest recovery expected; prices typically rise ~11% over the next 3 weeks for this crop/mandi. Storage 6km away at ₹9/qtl/month. For your 50 quintals, waiting ~21 days is worth ~₹25,150."
}
```
The full forecast curve (`factor(h)` → price per day for `h = 1..45`) is also returned so the UI can plot the predicted trajectory and mark the good-sale window.

## 6. Validation

- **Walk-forward backtest:** train up to date T, predict T+h, compare to actual, roll forward.
- **Metric:** MAPE per horizon and per crop-group; report against a **persistence baseline** ("price stays flat"). If we don't beat the baseline, we say so.
- **Cross-year holdout** (3.2): the headline number proving 2026-readiness.

## 7. Tech

Python 3.12; `pandas`, `lightgbm`, `scikit-learn`. Model saved as a single artifact; `forecast()` and `bech_ya_rakh()` are the public interfaces. Light enough for the cloud nightly-refresh story in the brainstorm.

## 8. Out of scope (this pass)

Voice/vernacular UI, real-time Agmarknet API ingestion, WDRA/eNWR warehouse & pledge-loan integrations, weather API wiring. Storage cost and cash need are passed in as parameters for now. The decision engine is structured so these integrations slot in later without changing the model.

## 9. Demo focus

Model is general (all 325 crops). Spotlight **soybean (MP)** in the demo: storable, strong seasonal pattern, reliable reporting — the cleanest "wait and gain" narrative.
