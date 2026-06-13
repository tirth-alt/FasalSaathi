# FasalSaathi — AI Layer (Bech ya Rakh)

The forecasting + decision engine behind FasalSaathi's **"Bech ya Rakh?"** (sell-or-hold)
module. A farmer picks a crop and the last ~10 days of that crop's mandi prices; the
model forecasts the next 45 days and a transparent decision layer returns **SELL or HOLD**,
the **optimal wait window**, and quantity-scaled rupee totals.

Project background and rationale: [`docs/design-spec.md`](docs/design-spec.md),
[`docs/implementation-plan.md`](docs/implementation-plan.md), and the original idea in
[`AGRI-BRAINSTORM.md`](AGRI-BRAINSTORM.md).

## How it works

- **One global LightGBM model** over all crops (`crop` is a feature), trained on historical
  Agmarknet daily prices.
- **Scale-invariant targets** — the model predicts price *movement* `price(t+h)/price(t)`,
  not absolute rupees, so historical data forecasts current-year prices. The farmer's latest
  price is the anchor; the model supplies the shape: `forecast = current_price × factor(h)`.
- **Multi-horizon** — `horizon h` is a model feature, so one model emits the whole 1–45 day
  price curve directly (no recursive feedback, no error compounding).
- **Decision layer** — finds the day where expected net (forecast − storage cost, discounted
  by per-crop perishability) peaks; caps the wait by crop shelf-life; scales by quantity.
- **Weather (optional)** — `weather.py` joins Open-Meteo data by district+date; currently
  off by default.

## Layout

```
src/fasalsaathi/
  config.py          paths, horizons, constants
  data_loader.py     normalize Agmarknet CSVs (schema + date formats)
  features.py        scale-invariant 10-day-window features + multi-horizon table (vectorized)
  perishability.py   per-crop shelf-life / decay table
  weather.py         Open-Meteo provider (geocode + archive, cached); optional
  train.py           global LightGBM trainer (time split, per-horizon metrics)
  forecast.py        last-10-days -> 45-day price curve + confidence + cold-start fallback
  decision.py        SELL/HOLD + optimal wait day + quantity-scaled totals
  route.py           predict_route(payload) -> decision   (the backend entry point)
tests/               pytest suite (one file per module)
scripts/
  train_real.py      train on the local archive (--top N / --since / --stride / --weather)
  export_pickle.py   export a self-contained model pickle
docs/                design spec + implementation plan
```

## Quickstart

```bash
pip install -r requirements.txt
pytest                                   # run the test suite

# train on the local Agmarknet archive (set DATA_DIR in src/fasalsaathi/config.py)
python scripts/train_real.py --all --since 2019-01-01 --stride 7
python scripts/export_pickle.py          # -> models/global_lgbm.pkl
```

### Using the model from a backend

```python
from fasalsaathi.route import predict_route

out = predict_route({
    "crop": "Wheat", "group": "Cereals",
    "mandi": {"state": "MP", "district": "Indore", "market": "Indore"},
    "last_10_days": [{"date": "2026-06-01", "modal": 2400, "min": 2350, "max": 2450, "arrivals": 80}, ...],
    "quantity_qtl": 50, "cash_need_now": 30000,
    "storage_cost_per_qtl_month": 9, "max_wait_days": 45,
})
# -> {"decision": "HOLD"/"SELL", "wait_days": {...}, "total": {...}, "curve": [...], ...}
```

Or load the exported pickle directly (`models/global_lgbm.pkl`) — a dict with the booster,
feature columns, categoricals, window size, and metrics.

## Notes

- `DATA_DIR` (the per-crop CSV archive) is set in `src/fasalsaathi/config.py`.
- Trained artifacts (`models/`), the weather cache (`cache/`), and logs are gitignored.
- **Model quality:** beats a naive persistence baseline at multi-week horizons (the window the
  hold decision uses); short-horizon daily moves remain near random-walk. See `docs/design-spec.md`.
