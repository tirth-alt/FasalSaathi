import numpy as np
import pandas as pd
import pytest
from fasalsaathi.train import train_model
from fasalsaathi.forecast import Forecaster


@pytest.fixture
def trained(tmp_path):
    rng = np.random.default_rng(0)
    frames = []
    for i in range(6):
        n = 800
        dates = pd.date_range("2022-01-01", periods=n, freq="D")
        price = 2000 + 300 * np.sin(2 * np.pi * np.arange(n) / 365.25) + rng.normal(0, 15, n)
        frames.append(pd.DataFrame({
            "date": dates, "modal_price": price, "arrivals": rng.uniform(5, 50, n),
            "crop": "Soyabean", "state": "MP", "district": "Dewas",
            "market": f"M{i}", "variety": "Local", "group": "Oil Seeds"}))
    train_model(frames, model_path=tmp_path / "m.txt", meta_path=tmp_path / "m.json")
    return tmp_path / "m.txt", tmp_path / "m.json"


def _last10(market="M0", anchor=2500.0):
    dates = pd.date_range("2026-06-01", periods=10, freq="D")
    return pd.DataFrame({
        "date": dates, "modal_price": np.linspace(anchor * 0.98, anchor, 10),
        "arrivals": [20.0] * 10, "crop": "Soyabean", "state": "MP",
        "district": "Dewas", "market": market, "variety": "Local", "group": "Oil Seeds"})


def test_forecast_curve_anchored_to_current_price(trained):
    mp, meta = trained
    fc = Forecaster(mp, meta)
    curve = fc.forecast_curve(_last10(anchor=2500.0))
    assert len(curve) == 45  # h=1..45
    # forecast must sit near the 2026 anchor level, NOT the 2000-era training level
    assert 2000 < curve.iloc[0]["price"] < 3000
    assert {"day", "price", "low", "high"}.issubset(curve.columns)
    assert (curve["high"] >= curve["price"]).all()


def test_forecast_unknown_market_low_confidence(trained):
    mp, meta = trained
    fc = Forecaster(mp, meta)
    out = fc.forecast_curve(_last10(market="TotallyNewMandi", anchor=2500.0), return_meta=True)
    assert out["confidence"] in ("low", "medium")
    assert len(out["curve"]) == 45
