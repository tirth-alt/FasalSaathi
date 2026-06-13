# FasalSaathi — Bech ya Rakh model

Forecast + decision engine for the **sell-or-hold** question. Give it a crop and the
last ~10 days of that crop's mandi prices; it forecasts the next 45 days and returns
**SELL or HOLD**, the **optimal wait window**, and quantity-scaled rupee totals.

```
src/fasalsaathi/   inference package
models/            trained model: global_lgbm.txt (+ model_meta.json) and global_lgbm.pkl
requirements.txt   runtime deps (pandas, numpy, lightgbm, requests)
```

## Install & call

```bash
pip install -r requirements.txt
```

```python
import sys; sys.path.insert(0, "src")
from fasalsaathi.route import predict_route

result = predict_route(payload)   # payload + result formats below
```

`predict_route` loads `models/global_lgbm.txt` automatically. Weather is fetched live
from Open-Meteo by default; pass a provider that returns an empty frame to skip it.

---

## Input format

```jsonc
{
  "crop":  "Wheat",                 // required. one of the trained crops (see below)
  "group": "Cereals",               // required. crop group (used for perishability)
  "variety": "Local",               // optional. defaults to "Other"
  "mandi": {                        // required
    "state":    "Madhya Pradesh",
    "district": "Indore",           // used to fetch weather (Open-Meteo)
    "market":   "Indore"
  },
  "last_10_days": [                 // required. exactly the most recent ~10 days, oldest first
    {"date": "2026-06-01", "modal": 2400, "min": 2350, "max": 2450, "arrivals": 80},
    {"date": "2026-06-02", "modal": 2412, "min": 2360, "max": 2460, "arrivals": 75}
    // ... 10 entries total
  ],
  "quantity_qtl": 50,               // required. lot size in quintals -> scales the totals
  "cash_need_now": 30000,           // optional. rupees needed now (context)
  "storage_cost_per_qtl_month": 9,  // optional. default 9
  "max_wait_days": 45               // optional. default 45 (capped by crop shelf-life)
}
```

### Field reference

| Field | Type | Unit / notes |
|-------|------|--------------|
| `crop`, `group` | string | crop name + its group (e.g. Cereals, Vegetables) |
| `mandi.state/district/market` | string | location; `district` drives the weather lookup |
| `last_10_days[].date` | `YYYY-MM-DD` | calendar date of the report |
| `last_10_days[].modal` | number | **modal price, ₹/quintal** — the value the model uses |
| `last_10_days[].min/max` | number | ₹/quintal (optional, not required by the model) |
| `last_10_days[].arrivals` | number | tonnes arriving that day (supply signal) |
| `quantity_qtl` | number | quintals; multiplies every rupee figure in the output |

---

## Input conditioning (how to prepare `last_10_days`)

The model is sensitive to how the window is built. Condition the input like this:

1. **Exactly the last ~10 reporting days, sorted oldest → newest.** The most recent
   day is the **anchor**: the forecast is `anchor_modal × predicted_factor`, so the
   last entry's `modal` sets the absolute price level.
2. **Use modal price in ₹/quintal.** Don't mix per-kg or per-bag units. `min`/`max`
   are optional; only `modal` feeds the model.
3. **One row per date.** If a mandi reports multiple rows for the same day, collapse to
   the **median** modal price first.
4. **No zero / null modal prices.** Drop days with `modal <= 0` or missing before sending.
5. **Gaps are OK.** Calendar gaps (market closed) are fine — just send the last 10
   *reported* days; don't pad with zeros.
6. **`arrivals`**: send tonnes if known; use `0` if unknown (it's a weak feature).
7. **Unknown mandi/variety**: still works — the model backs off to district/state/crop
   and returns `confidence: "low"`. Unknown **crop** should be rejected upstream.

The model predicts *price movement* (ratios), not absolute rupees, so historical data
forecasts current-year prices correctly as long as the anchor (last day) is a real
current price.

---

## Output format

```jsonc
{
  "decision": "HOLD",                       // "HOLD" or "SELL"
  "wait_days": {"best": 21, "range": [14, 28]},
  "good_sale_window_day": 21,               // days from today to the best expected sale
  "max_hold_days": 180,                     // crop shelf-life cap
  "quantity_qtl": 50,
  "confidence": "high",                     // "high" or "low" (low = unfamiliar mandi)
  "per_quintal": {
    "sell_now": 2412,
    "expected_at_D": {"mid": 2540, "range": [2470, 2610]},
    "storage_cost": 63,
    "expected_gain": 65
  },
  "total": {                                // per_quintal × quantity_qtl
    "sell_now": 120600,
    "expected_at_D": {"mid": 127000, "range": [123500, 130500]},
    "storage_cost": 3150,
    "expected_gain": 3250
  },
  "curve": [                                // 45-day forecast, day 1..45
    {"day": 1, "price": 2415, "low": 2350, "high": 2480},
    {"day": 2, "price": 2418, "low": 2351, "high": 2485}
    // ...
  ]
}
```

- **`decision`** — `HOLD` only if the best expected net beats selling now by a risk margin
  *and* the crop can be stored that long; otherwise `SELL`.
- **`wait_days.best`** — how many days to hold for the best expected sale; `good_sale_window_day`
  is the same value as "days from today".
- **`total`** — the numbers the farmer decides on (per-quintal × quantity).
- **`curve`** — the full 45-day price forecast (take `curve[:10]` for "next 10 days").

---

## Notes

- **Trained on** 5 high-volume crops (Onion, Potato, Tomato, Wheat, Paddy) from historical
  Agmarknet daily prices. Model metrics are in `models/model_meta.json`.
- **Quality:** beats a naive "price stays flat" baseline at the multi-week horizons the hold
  decision uses; very short-horizon daily moves stay near random-walk.
- `models/global_lgbm.pkl` is a self-contained bundle (booster + feature columns +
  categoricals + window + metrics) if you prefer to load the model directly.
