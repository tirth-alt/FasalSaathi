import pandas as pd

from fasalsaathi.perishability import shelf_life

# Minimum per-quintal gain over sell-now (after costs) to justify holding.
RISK_MARGIN_PER_QTL = 50.0


def decide(curve: pd.DataFrame, crop: str, group: str, sell_now_price: float,
           quantity_qtl: float, storage_cost_per_qtl_month: float,
           max_wait_days: int, confidence: str = "high") -> dict:
    """Turn a price-forecast curve into a SELL/HOLD call with an optimal wait day.

    Net for holding d days = forecast(d) discounted by quality decay, minus
    accumulated storage cost. The wait window is capped by the crop's shelf life.
    """
    peri = shelf_life(crop, group)
    cap = min(max_wait_days, peri["max_hold_days"])
    decay = peri["quality_decay_per_day"]
    daily_storage = storage_cost_per_qtl_month / 30.0

    best_day, best_net = 0, sell_now_price  # day 0 = sell now
    eval_curve = curve[curve["day"] <= cap]
    for _, r in eval_curve.iterrows():
        d = int(r["day"])
        net = r["price"] * ((1 - decay) ** d) - d * daily_storage
        if net > best_net:
            best_net, best_day = net, d

    margin = RISK_MARGIN_PER_QTL * (2.0 if confidence == "low" else 1.0)
    hold = best_day > 0 and (best_net - sell_now_price) >= margin

    if hold:
        row = curve[curve["day"] == best_day].iloc[0]
        exp_mid, exp_low, exp_high = row["price"], row["low"], row["high"]
        good_day = best_day
        gain_pq = best_net - sell_now_price
    else:
        best_day = good_day = 0
        exp_mid = exp_low = exp_high = sell_now_price
        gain_pq = 0.0

    storage_total_pq = good_day * daily_storage

    def total(x):
        return round(x * quantity_qtl, 2)

    return {
        "decision": "HOLD" if hold else "SELL",
        "wait_days": {"best": good_day,
                      "range": [max(0, good_day - 7), min(cap, good_day + 7)]
                      if hold else [0, 0]},
        "max_hold_days": peri["max_hold_days"],
        "quantity_qtl": quantity_qtl,
        "confidence": confidence,
        "per_quintal": {
            "sell_now": round(sell_now_price, 2),
            "expected_at_D": {"mid": round(exp_mid, 2),
                              "range": [round(exp_low, 2), round(exp_high, 2)]},
            "storage_cost": round(storage_total_pq, 2),
            "expected_gain": round(gain_pq, 2)},
        "total": {
            "sell_now": total(sell_now_price),
            "expected_at_D": {"mid": total(exp_mid),
                              "range": [total(exp_low), total(exp_high)]},
            "storage_cost": total(storage_total_pq),
            "expected_gain": total(gain_pq)},
    }
