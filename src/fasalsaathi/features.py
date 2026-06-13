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
    W = config.WINDOW
    s = series.sort_values("date").reset_index(drop=True)
    # Collapse duplicate dates (same market can report multiple rows/day) to a
    # single median modal price -> denoises the series before feature building.
    if s["date"].duplicated().any():
        agg = {c: "first" for c in s.columns if c not in ("date", "modal_price", "arrivals")}
        agg["modal_price"] = "median"
        agg["arrivals"] = "sum"
        s = s.groupby("date", as_index=False).agg(agg).sort_values("date").reset_index(drop=True)
    prices = s["modal_price"].to_numpy(dtype=float)
    n = len(prices)
    if n < W + 1:
        return pd.DataFrame()

    # join weather onto the series by date so window aggregation is vectorised
    for c in ("rain", "tmax", "tmin", "tmean", "humidity"):
        s[c] = np.nan
    if weather_daily is not None and len(weather_daily):
        wd = weather_daily.copy()
        wd["date"] = pd.to_datetime(wd["date"])
        s = s.drop(columns=["rain", "tmax", "tmin", "tmean", "humidity"]).merge(
            wd[["date", "rain", "tmax", "tmin", "tmean", "humidity"]], on="date", how="left")

    # sliding windows of length W; row i ends at anchor index t = i + W - 1
    sw = np.lib.stride_tricks.sliding_window_view  # (n-W+1, W)
    pw = sw(prices, W)
    anchor = pw[:, -1]
    t_idx = np.arange(W - 1, n)              # anchor original indices
    valid = anchor > 0
    feat = {}
    for k in range(1, W):
        feat[f"lag_ratio_{k}"] = pw[:, W - 1 - k] / anchor
    feat["roll_mean_ratio"] = pw.mean(1) / anchor
    feat["roll_std_ratio"] = pw.std(1) / anchor
    x = np.arange(W, dtype=float)
    wts = (x - x.mean()) / ((x - x.mean()) ** 2).sum()   # least-squares slope weights
    feat["slope_ratio"] = (pw @ wts) / anchor
    feat["arrivals_log"] = np.log1p(np.clip(s["arrivals"].to_numpy(float)[t_idx], 0, None))
    dts = s["date"].iloc[t_idx].reset_index(drop=True)
    feat["month"] = dts.dt.month.to_numpy()
    feat["weekofyear"] = dts.dt.isocalendar().week.to_numpy().astype(int)
    feat["dayofyear"] = dts.dt.dayofyear.to_numpy()
    # weather window aggregates (NaN where weather absent)
    rw = sw(s["rain"].to_numpy(float), W)
    feat["rain_sum_10d"] = rw.sum(1)
    feat["rain_max_1d"] = rw.max(1)
    feat["temp_mean_10d"] = sw(s["tmean"].to_numpy(float), W).mean(1)
    feat["temp_max_10d"] = sw(s["tmax"].to_numpy(float), W).max(1)
    feat["temp_min_10d"] = sw(s["tmin"].to_numpy(float), W).min(1)
    feat["humidity_mean_10d"] = sw(s["humidity"].to_numpy(float), W).mean(1)
    feat["heavy_rain_flag"] = (rw.max(1) > config.HEAVY_RAIN_MM).astype(float)
    feat["heatwave_flag"] = (sw(s["tmax"].to_numpy(float), W).max(1) > config.HEATWAVE_C).astype(float)

    base = pd.DataFrame(feat)
    base["anchor_price"] = anchor
    base["anchor_date"] = dts.values
    for c in config.CATEGORICALS:
        base[c] = s[c].iloc[t_idx].values
    base["_t"] = t_idx
    base = base[valid]
    # subsample anchors by stride
    base = base.iloc[::max(1, stride)].reset_index(drop=True)

    # expand over horizons: target = price(t+h)/anchor, clipped
    parts = []
    for h in horizons:
        tt = base["_t"].to_numpy()
        m = tt + h < n
        if not m.any():
            continue
        b = base[m].copy()
        ratio = prices[b["_t"].to_numpy() + h] / b["anchor_price"].to_numpy()
        b["horizon"] = h
        b["target_ratio"] = np.clip(ratio, 0.5, 2.0)
        parts.append(b)
    if not parts:
        return pd.DataFrame()
    return pd.concat(parts, ignore_index=True).drop(columns="_t")


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
