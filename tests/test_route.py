import numpy as np
import pandas as pd
import pytest
from fasalsaathi.train import train_model
from fasalsaathi.route import predict_route


class _NoWeather:
    """Injected provider that returns no weather (offline) -> weather feats NaN."""
    def weather_window(self, district, dates):
        return pd.DataFrame(columns=["date", "rain", "tmax", "tmin", "tmean", "humidity"])


@pytest.fixture
def model_files(tmp_path):
    rng = np.random.default_rng(1)
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


def test_predict_route_returns_full_decision(model_files):
    mp, meta = model_files
    payload = {
        "crop": "Soyabean", "variety": "Local", "group": "Oil Seeds",
        "mandi": {"state": "MP", "district": "Dewas", "market": "M0"},
        "last_10_days": [
            {"date": f"2026-06-{d:02d}", "modal": 2500 + d, "min": 2400 + d,
             "max": 2600 + d, "arrivals": 20} for d in range(1, 11)],
        "quantity_qtl": 50, "cash_need_now": 30000,
        "storage_cost_per_qtl_month": 9, "max_wait_days": 45,
    }
    out = predict_route(payload, model_path=mp, meta_path=meta,
                        weather_provider=_NoWeather())
    assert out["decision"] in ("SELL", "HOLD")
    assert out["total"]["sell_now"] > 0
    assert "curve" in out and len(out["curve"]) == 45
