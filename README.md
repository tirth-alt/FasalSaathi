# FasalSaathi

An assistant for Indian farmers, in one repo:

- **Soil Report Engine** — point the app at a soil report (or ask a farming question); an
  on-device LLM (Gemma 3n) explains it in plain language, translating chemical codes into
  common fertilizers and telling the farmer what to apply and what to **stop**. RAG-grounded.
- **Sell-or-Store forecast** — a trained LightGBM model forecasts the next 45 days of mandi
  prices and answers "sell now or store?" with the rupee math, shown as a chart.
- **Mobile app** — React Native / Expo, the farmer-facing UI.
- **Backend** — Node/TypeScript API (prices, decision, weather, warehouses).

```
app/                React Native (Expo) app  — frontend + Soil engine UI
  src/soil/         soil engine: RAG + router + prompts + on-device LLM client
  src/data/forecast.json   model output the Sell/Store chart renders
backend/            Node/TS API (prices, sell/hold decision, weather, warehouses)
src/fasalsaathi/    Python price-model inference package
models/             trained model: global_lgbm.pkl / .txt (+ model_meta.json)
data/mock_prices.json    mock time-series input for the demo forecast
scripts/forecast_from_mock.py   runs the .pkl on the mock data -> app/src/data/forecast.json
docs/               design spec + implementation plan
```

---

## Run each part

### 1. Mobile app (Expo)
```bash
cd app
npm install
npx expo start            # Expo Go for UI; a dev-client build for the on-device Soil LLM
```
- The **Soil** tab runs Gemma 3n **on-device** via a native module → needs a **dev-client build**
  (`eas build --profile development --platform android`), not Expo Go.
- UI is English; the Soil advisor answers in English (`lang: 'en'`, `en-IN` TTS).
- A cloud-LLM variant (no native build) lives on the `soil-api` branch — set
  `EXPO_PUBLIC_OPENROUTER_KEY` in `app/.env` (gitignored).

### 2. Backend (Node/TypeScript)
```bash
cd backend
npm install
cp .env.example .env      # fill in keys
npm run dev               # see backend/README.md + backend/docs/api.md
```
Routes: prices, sell/hold decision, weather, warehouses. The app currently uses bundled mock
data for the demo, so the backend is optional to *show* the frontend.

### 3. Price model (Python)
```bash
pip install -r requirements.txt
```
```python
import sys; sys.path.insert(0, "src")
from fasalsaathi.route import predict_route
result = predict_route(payload)     # input/output formats in "Price model API" below
```

### 4. Regenerate the demo forecast (drives the Sell/Store chart)
```bash
python scripts/forecast_from_mock.py
# reads data/mock_prices.json + models/global_lgbm.pkl -> writes app/src/data/forecast.json
```
Edit `data/mock_prices.json` and rerun to change the forecast the app charts.

### Tests
```bash
cd app && npm run test:soil     # soil engine (17 tests)
```

---

## Price model API

Give it a crop and the last ~10 days of that crop's mandi prices; it forecasts the next 45
days and returns **SELL or HOLD**, the **optimal wait window**, and quantity-scaled totals.
`predict_route` loads `models/global_lgbm.txt` automatically; weather is fetched live from
Open-Meteo unless a provider returning an empty frame is injected (offline/demo).

### Input
```jsonc
{
  "crop": "Wheat", "group": "Cereals", "variety": "Local",
  "mandi": { "state": "Madhya Pradesh", "district": "Indore", "market": "Indore" },
  "last_10_days": [
    {"date": "2026-06-01", "modal": 2400, "min": 2350, "max": 2450, "arrivals": 80}
    // ~10 entries, oldest first; last entry's modal is the price anchor
  ],
  "quantity_qtl": 50,
  "storage_cost_per_qtl_month": 9,   // optional, default 9
  "max_wait_days": 45                // optional, default 45 (capped by crop shelf-life)
}
```

### Output
```jsonc
{
  "decision": "HOLD",                         // or "SELL"
  "wait_days": {"best": 21, "range": [14, 28]},
  "confidence": "high",                       // "low" = unfamiliar mandi
  "per_quintal": { "sell_now": 2412, "expected_at_D": {"mid": 2540, "range": [2470, 2610]},
                   "storage_cost": 63, "expected_gain": 65 },
  "total":       { "sell_now": 120600, "expected_at_D": {"mid": 127000, ...}, ... },
  "curve": [ {"day": 1, "price": 2415, "low": 2350, "high": 2480}, ... ]  // 45 days
}
```

### Notes
- **Trained on** Onion, Potato, Tomato, Wheat, Paddy (historical Agmarknet daily prices);
  metrics in `models/model_meta.json`. Unknown crops should be rejected upstream.
- Predicts *price movement* (ratios), so historical data forecasts current prices as long as
  the last day's `modal` is a real current price.
- `models/global_lgbm.pkl` is a self-contained bundle (booster + feature columns + window).
