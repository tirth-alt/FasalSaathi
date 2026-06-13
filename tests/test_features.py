import numpy as np
import pandas as pd
from fasalsaathi.features import window_features, build_training_rows
from fasalsaathi import config


def _series(prices, arrivals=None):
    n = len(prices)
    dates = pd.date_range("2026-01-01", periods=n, freq="D")
    return pd.DataFrame({
        "date": dates, "modal_price": prices,
        "arrivals": arrivals if arrivals is not None else [10.0] * n,
        "crop": "Soyabean", "state": "MP", "district": "Dewas",
        "market": "Dewas", "variety": "Local", "group": "Oil Seeds",
    })


def test_window_features_are_scale_invariant():
    base = _series([100, 101, 102, 103, 104, 105, 106, 107, 108, 110])
    scaled = _series([1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070, 1080, 1100])
    fb = window_features(base)
    fs = window_features(scaled)
    for k in range(1, 10):
        assert abs(fb[f"lag_ratio_{k}"] - fs[f"lag_ratio_{k}"]) < 1e-9
    assert abs(fb["roll_mean_ratio"] - fs["roll_mean_ratio"]) < 1e-9


def test_window_features_carry_calendar_and_categoricals():
    f = window_features(_series([100] * 9 + [110]))
    assert f["crop"] == "Soyabean" and f["market"] == "Dewas"
    assert 1 <= f["month"] <= 12
    assert "anchor_price" in f and f["anchor_price"] == 110


def test_window_features_weather_keys_present_nan_when_absent():
    f = window_features(_series([100] * 10))
    for k in config.WEATHER_FEATURES:
        assert k in f
        assert f[k] != f[k]  # NaN when no weather supplied


def test_window_features_merge_weather_when_supplied():
    w = pd.DataFrame({
        "date": pd.date_range("2026-01-01", periods=10, freq="D"),
        "rain": [0] * 9 + [60], "tmax": [35] * 10, "tmin": [20] * 10,
        "tmean": [27] * 10, "humidity": [55] * 10,
    })
    f = window_features(_series([100] * 10), weather_daily=w)
    assert f["rain_sum_10d"] == 60
    assert f["heavy_rain_flag"] == 1


def test_build_training_rows_targets_are_future_ratios():
    df = _series(list(range(100, 130)))  # 30 strictly rising days
    rows = build_training_rows(df, horizons=[1, 5])
    assert len(rows) > 0
    r = rows.iloc[0]
    assert r["horizon"] in (1, 5)
    assert r["target_ratio"] > 1.0
    assert "lag_ratio_1" in rows.columns and "anchor_price" in rows.columns


def test_build_training_rows_skips_when_insufficient_future():
    df = _series(list(range(100, 112)))  # 12 days
    rows = build_training_rows(df, horizons=[45])  # no 45-day future exists
    assert len(rows) == 0
