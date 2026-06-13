import numpy as np
import pandas as pd
from fasalsaathi.train import train_model, FEATURE_COLS


def _synthetic_series(market, seed):
    rng = np.random.default_rng(seed)
    n = 800  # ~2.2 years
    dates = pd.date_range("2022-01-01", periods=n, freq="D")
    # Annual seasonality (calendar features are genuinely predictive), like real mandi prices.
    price = 2000 + 300 * np.sin(2 * np.pi * np.arange(n) / 365.25) + rng.normal(0, 15, n)
    return pd.DataFrame({
        "date": dates, "modal_price": price, "arrivals": rng.uniform(5, 50, n),
        "crop": "Soyabean", "state": "MP", "district": "Dewas",
        "market": market, "variety": "Local", "group": "Oil Seeds",
    })


def test_train_model_beats_persistence_baseline(tmp_path):
    frames = [_synthetic_series(f"M{i}", seed=i) for i in range(6)]
    model, metrics = train_model(frames, model_path=tmp_path / "m.txt",
                                 meta_path=tmp_path / "m.json")
    assert metrics["mape"] < metrics["baseline_mape"]
    assert (tmp_path / "m.txt").exists()
    assert set(FEATURE_COLS).issubset(set(model.feature_name()))
