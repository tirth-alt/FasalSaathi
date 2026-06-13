import numpy as np
import pandas as pd

from fasalsaathi import config
from fasalsaathi.weather import weather_features_from_daily


def window_features(window: pd.DataFrame, weather_daily: pd.DataFrame | None = None) -> dict:
    """Build features from the last WINDOW rows (sorted ascending by date).

    All price-derived features are ratios to the latest (anchor) price, so they
    are scale-invariant across years. Weather features are aggregated from the
    matching daily weather window (NaN when weather is unavailable).
    """
    w = window.sort_values("date").tail(config.WINDOW).reset_index(drop=True)
    prices = w["modal_price"].to_numpy(dtype=float)
    anchor = prices[-1]
    feats: dict = {}
    # lag ratios: price k days before anchor / anchor
    for k in range(1, config.WINDOW):
        idx = len(prices) - 1 - k
        feats[f"lag_ratio_{k}"] = (prices[idx] / anchor) if idx >= 0 else 1.0
    feats["roll_mean_ratio"] = float(prices.mean() / anchor)
    feats["roll_std_ratio"] = float(prices.std() / anchor)
    # normalized slope over the window
    x = np.arange(len(prices), dtype=float)
    slope = np.polyfit(x, prices, 1)[0] if len(prices) > 1 else 0.0
    feats["slope_ratio"] = float(slope / anchor)
    feats["arrivals_log"] = float(np.log1p(max(w["arrivals"].iloc[-1], 0.0)))
    last_date = pd.Timestamp(w["date"].iloc[-1])
    feats["month"] = int(last_date.month)
    feats["weekofyear"] = int(last_date.isocalendar().week)
    feats["dayofyear"] = int(last_date.dayofyear)
    for c in config.CATEGORICALS:
        feats[c] = w[c].iloc[-1]
    feats["anchor_price"] = float(anchor)
    feats["anchor_date"] = last_date
    # weather features (NaN when absent)
    feats.update(weather_features_from_daily(weather_daily))
    return feats
