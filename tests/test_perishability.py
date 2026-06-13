from fasalsaathi.perishability import shelf_life


def test_known_perishable_crop_short_hold():
    info = shelf_life("Tomato", group="Vegetables")
    assert info["max_hold_days"] <= 3
    assert info["quality_decay_per_day"] > 0.05


def test_known_storable_crop_long_hold():
    info = shelf_life("Soyabean", group="Oil Seeds")
    assert info["max_hold_days"] >= 60
    assert info["quality_decay_per_day"] < 0.01


def test_unknown_crop_falls_back_to_group():
    info = shelf_life("SomeNewBean", group="Pulses")
    assert info["max_hold_days"] >= 60  # pulses are storable


def test_unknown_crop_and_group_uses_safe_default():
    info = shelf_life("Mystery", group="Unknownia")
    assert info["max_hold_days"] >= 1
    assert 0 <= info["quality_decay_per_day"] <= 1
