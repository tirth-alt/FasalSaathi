"""Hardcoded MVP perishability. Replace with a real spoilage model later."""

_CROP = {
    "Tomato":   {"max_hold_days": 2,   "quality_decay_per_day": 0.12},
    "Onion":    {"max_hold_days": 30,  "quality_decay_per_day": 0.02},
    "Potato":   {"max_hold_days": 45,  "quality_decay_per_day": 0.015},
    "Banana":   {"max_hold_days": 5,   "quality_decay_per_day": 0.10},
    "Soyabean": {"max_hold_days": 150, "quality_decay_per_day": 0.001},
    "Wheat":    {"max_hold_days": 180, "quality_decay_per_day": 0.0005},
}
_GROUP = {
    "Vegetables": {"max_hold_days": 4,   "quality_decay_per_day": 0.10},
    "Fruits":     {"max_hold_days": 6,   "quality_decay_per_day": 0.08},
    "Oil Seeds":  {"max_hold_days": 150, "quality_decay_per_day": 0.001},
    "Cereals":    {"max_hold_days": 180, "quality_decay_per_day": 0.0005},
    "Pulses":     {"max_hold_days": 150, "quality_decay_per_day": 0.001},
    "Spices":     {"max_hold_days": 180, "quality_decay_per_day": 0.0008},
}
_DEFAULT = {"max_hold_days": 21, "quality_decay_per_day": 0.02}


def shelf_life(crop: str, group: str | None = None) -> dict:
    if crop in _CROP:
        return dict(_CROP[crop])
    if group and group in _GROUP:
        return dict(_GROUP[group])
    return dict(_DEFAULT)
