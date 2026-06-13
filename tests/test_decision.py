import pandas as pd
from fasalsaathi.decision import decide


def _curve(prices):
    return pd.DataFrame({"day": range(1, len(prices) + 1), "price": prices,
                         "low": [p * 0.97 for p in prices],
                         "high": [p * 1.03 for p in prices]})


def test_rising_curve_storable_crop_recommends_hold():
    curve = _curve([4650 + 25 * d for d in range(1, 46)])  # steadily rising
    out = decide(curve, crop="Soyabean", group="Oil Seeds", sell_now_price=4650,
                 quantity_qtl=50, storage_cost_per_qtl_month=9, max_wait_days=45,
                 confidence="high")
    assert out["decision"] == "HOLD"
    assert 1 <= out["wait_days"]["best"] <= 45
    assert out["total"]["expected_gain"] > 0
    assert out["total"]["sell_now"] == 4650 * 50


def test_perishable_crop_forced_to_sell_even_if_curve_rises():
    curve = _curve([900 + 30 * d for d in range(1, 46)])  # rising
    out = decide(curve, crop="Tomato", group="Vegetables", sell_now_price=900,
                 quantity_qtl=10, storage_cost_per_qtl_month=9, max_wait_days=45,
                 confidence="high")
    assert out["decision"] == "SELL"          # max_hold_days=2 caps it
    assert out["wait_days"]["best"] <= 2


def test_falling_curve_recommends_sell():
    curve = _curve([4650 - 20 * d for d in range(1, 46)])
    out = decide(curve, crop="Soyabean", group="Oil Seeds", sell_now_price=4650,
                 quantity_qtl=50, storage_cost_per_qtl_month=9, max_wait_days=45,
                 confidence="high")
    assert out["decision"] == "SELL"
