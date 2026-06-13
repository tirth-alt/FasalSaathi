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


def build_training_rows(series: pd.DataFrame, horizons: list[int] | None = None,
                        weather_daily: pd.DataFrame | None = None,
                        stride: int = 1) -> pd.DataFrame:
    """series = one market's history (sorted). One row per (anchor, horizon).

    stride>1 subsamples anchor dates (e.g. stride=7 keeps ~weekly anchors) to
    keep the training table tractable on large crops.
    """
    horizons = horizons or config.TRAIN_HORIZONS
    s = series.sort_values("date").reset_index(drop=True)
    prices = s["modal_price"].to_numpy(dtype=float)
    n = len(prices)
    wd = weather_daily
    if wd is not None and len(wd):
        wd = wd.copy()
        wd["date"] = pd.to_datetime(wd["date"])
    out = []
    for t in range(config.WINDOW - 1, n, max(1, stride)):
        window = s.iloc[t - config.WINDOW + 1: t + 1]
        if len(window) < config.WINDOW:
            continue
        w_slice = None
        if wd is not None and len(wd):
            w_slice = wd[wd["date"].isin(pd.to_datetime(window["date"]))]
        base_feats = window_features(window, weather_daily=w_slice)
        anchor = base_feats["anchor_price"]
        if anchor <= 0:
            continue
        for h in horizons:
            if t + h >= n:
                continue
            row = dict(base_feats)
            row["horizon"] = h
            row["target_ratio"] = float(prices[t + h] / anchor)
            out.append(row)
    return pd.DataFrame(out)


def build_training_table(frames: list[pd.DataFrame], horizons: list[int] | None = None,
                         weather_provider=None, stride: int = 1) -> pd.DataFrame:
    """Concatenate training rows across many market series / crops.

    If a weather_provider is given, each district's weather history is fetched
    once and the matching window joined per anchor (Open-Meteo, cached on disk).
    """
    group_cols = ["crop", "state", "district", "market", "variety"]
    parts = []
    weather_cache: dict = {}
    for df in frames:
        for _, series in df.groupby(group_cols, observed=True):
            if len(series) < config.WINDOW + 1:
                continue
            wd = None
            if weather_provider is not None:
                district = series["district"].iloc[0]
                if district not in weather_cache:
                    dates = pd.to_datetime(series["date"])
                    weather_cache[district] = weather_provider.weather_window(
                        district, dates)
                wd = weather_cache[district]
            parts.append(build_training_rows(series, horizons, weather_daily=wd, stride=stride))
    return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()
