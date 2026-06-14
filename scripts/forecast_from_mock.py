"""Run the trained .pkl price model on the mock dataset and emit a forecast JSON
the app bundles and charts. Offline (no weather API). Run from repo root:

    python scripts/forecast_from_mock.py

Reads:  data/mock_prices.json   (mock time-series input)
        models/global_lgbm.pkl  (trained model, loaded by predict_route)
Writes: app/src/data/forecast.json
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import pandas as pd  # noqa: E402
from fasalsaathi.route import predict_route  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")


class _NoWeather:
    """Offline stub — skips the Open-Meteo call so the demo runs without network."""

    def weather_window(self, district, dates):
        return pd.DataFrame()


def main() -> None:
    with open(os.path.join(ROOT, "data", "mock_prices.json"), encoding="utf-8") as fh:
        payload = json.load(fh)

    out = predict_route(payload, weather_provider=_NoWeather())

    history = [
        {"day": -len(payload["last_10_days"]) + 1 + i, "price": round(float(d["modal"]), 1)}
        for i, d in enumerate(payload["last_10_days"])
    ]
    curve = [
        {"day": int(p["day"]), "price": round(float(p["price"]), 1)}
        for p in out["curve"]
    ]
    result = {
        "crop": payload["crop"],
        "quantity_qtl": payload["quantity_qtl"],
        "decision": out["decision"],
        "confidence": out.get("confidence"),
        "waitDays": out["wait_days"]["best"],
        "sellNow": round(float(out["per_quintal"]["sell_now"]), 1),
        "expectedMid": round(float(out["per_quintal"]["expected_at_D"]["mid"]), 1),
        "expectedGainPerQtl": round(float(out["per_quintal"]["expected_gain"]), 1),
        "totalSellNow": round(float(out["total"]["sell_now"]), 0),
        "totalExpected": round(float(out["total"]["expected_at_D"]["mid"]), 0),
        "totalGain": round(float(out["total"]["expected_gain"]), 0),
        "history": history,
        "curve": curve,
    }

    out_dir = os.path.join(ROOT, "app", "src", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "forecast.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    print(f"wrote {out_path}: {result['decision']} wait={result['waitDays']}d "
          f"sellNow={result['sellNow']} curve={len(curve)}pts")


if __name__ == "__main__":
    main()
