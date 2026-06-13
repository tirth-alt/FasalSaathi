"""Single entry point: a route payload in -> a sell/hold decision out.

Weather is auto-fetched for the mandi's district over the input dates (free
Open-Meteo API) unless a weather_provider is injected (tests) or weather is
already present in the payload.
"""
import pandas as pd

from fasalsaathi.forecast import Forecaster
from fasalsaathi.decision import decide
from fasalsaathi.weather import WeatherProvider


def predict_route(payload: dict, model_path=None, meta_path=None,
                  weather_provider=None) -> dict:
    mandi = payload["mandi"]
    rows = []
    for d in payload["last_10_days"]:
        rows.append({
            "date": pd.to_datetime(d["date"]), "modal_price": float(d["modal"]),
            "arrivals": float(d.get("arrivals", 0.0)),
            "crop": payload["crop"], "state": mandi["state"],
            "district": mandi["district"], "market": mandi["market"],
            "variety": payload.get("variety", "Other"),
            "group": payload.get("group", "Unknown")})
    window = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)

    # weather for the same 10 dates (auto-fetched per district)
    wp = weather_provider or WeatherProvider()
    weather_daily = wp.weather_window(mandi["district"], window["date"])

    fc = Forecaster(model_path, meta_path)
    fres = fc.forecast_curve(window, weather_daily=weather_daily, return_meta=True)
    sell_now = float(window["modal_price"].iloc[-1])
    out = decide(fres["curve"], crop=payload["crop"],
                 group=payload.get("group", "Unknown"), sell_now_price=sell_now,
                 quantity_qtl=float(payload["quantity_qtl"]),
                 storage_cost_per_qtl_month=float(payload.get("storage_cost_per_qtl_month", 9)),
                 max_wait_days=int(payload.get("max_wait_days", 45)),
                 confidence=fres["confidence"])
    out["good_sale_window_day"] = out["wait_days"]["best"]
    out["curve"] = fres["curve"].to_dict(orient="records")
    return out
