{
  "decision": "HOLD",                       // "HOLD" or "SELL"
  "wait_days": {"best": 21, "range": [14, 28]},
  "good_sale_window_day": 21,               // days from today to the best expected sale
  "max_hold_days": 180,                     // crop shelf-life cap
  "quantity_qtl": 50,
  "confidence": "high",                     // "high" or "low" (low = unfamiliar mandi)
  "per_quintal": {
    "sell_now": 2412,
    "expected_at_D": {"mid": 2540, "range": [2470, 2610]},
    "storage_cost": 63,
    "expected_gain": 65
  },
  "total": {                                // per_quintal × quantity_qtl
    "sell_now": 120600,
    "expected_at_D": {"mid": 127000, "range": [123500, 130500]},
    "storage_cost": 3150,
    "expected_gain": 3250
  },
  "curve": [                                // 45-day forecast, day 1..45
    {"day": 1, "price": 2415, "low": 2350, "high": 2480},
    {"day": 2, "price": 2418, "low": 2351, "high": 2485}
    // ...
  ]
}