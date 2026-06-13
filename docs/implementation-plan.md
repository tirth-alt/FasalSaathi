# Bech ya Rakh — Forecast & Decision Engine Implementation Plan

> Task-by-task implementation plan. Steps use checkbox (`- [ ]`) syntax for tracking. All tasks are implemented; see `src/fasalsaathi/` and `tests/`.

**Goal:** Build a single global ML model that forecasts mandi price *movement* for any of 325 crops and a decision layer that turns the forecast into a SELL/HOLD call with an optimal wait window.

**Architecture:** Normalize the 325-CSV Agmarknet archive into one clean schema → build scale-invariant (ratio) features over a 10-day window with horizon as a feature → train one global LightGBM regressor predicting `price(t+h)/price(t)` → at inference, multiply predicted factors by the farmer's current (2026) anchor price to get a 45-day curve → decision engine caps the wait by per-crop perishability, subtracts storage cost, scales by quantity, and picks the best day to sell. See spec: `docs/design-spec.md`.

**Tech Stack:** Python 3.12, pandas, numpy, lightgbm, scikit-learn, pytest. Data archive at `C:/Users/Tushar Srivastava/Desktop/archive (2)` (one CSV per crop).

---

## File Structure

- `src/fasalsaathi/__init__.py` — package marker
- `src/fasalsaathi/config.py` — paths, horizon set, demo crop list, constants
- `src/fasalsaathi/data_loader.py` — normalize one CSV → standard schema; load crop(s)
- `src/fasalsaathi/perishability.py` — hardcoded crop/group → max_hold_days, decay
- `src/fasalsaathi/features.py` — 10-day-window ratio features + multi-horizon targets
- `src/fasalsaathi/train.py` — build training table, time-split, train+save global model, metrics
- `src/fasalsaathi/forecast.py` — load model; last-10-days → 45-day price curve + confidence; cold-start fallback
- `src/fasalsaathi/decision.py` — `bech_ya_rakh(...)` assembling forecast + perishability + storage + quantity
- `src/fasalsaathi/route.py` — single `predict_route(payload: dict) -> dict` entry point (the "route")
- `tests/` — mirrors each module
- `models/` — saved model artifact + metrics (gitignored)
- `requirements.txt`, `pytest.ini`

---

## Task 1: Project scaffold

**Files:**
- Create: `requirements.txt`, `pytest.ini`, `src/fasalsaathi/__init__.py`, `src/fasalsaathi/config.py`
- Modify: `.gitignore`

- [ ] **Step 1: Write `requirements.txt`**

```
pandas>=2.3
numpy>=2.1
lightgbm>=4.6
scikit-learn>=1.7
pytest>=8.0
```

- [ ] **Step 2: Write `pytest.ini`**

```ini
[pytest]
pythonpath = src
testpaths = tests
```

- [ ] **Step 3: Write `src/fasalsaathi/__init__.py`** (empty file)

- [ ] **Step 4: Write `src/fasalsaathi/config.py`**

```python
from pathlib import Path

# Root of the per-crop Agmarknet CSV archive (one file per crop).
DATA_DIR = Path(r"C:/Users/Tushar Srivastava/Desktop/archive (2)")
MODEL_DIR = Path(__file__).resolve().parents[2] / "models"
MODEL_PATH = MODEL_DIR / "global_lgbm.txt"
META_PATH = MODEL_DIR / "model_meta.json"

# Horizons (days ahead) the model is TRAINED on. Inference may query any
# h in 1..MAX_HORIZON; the model interpolates because h is a numeric feature.
TRAIN_HORIZONS = [1, 3, 5, 7, 10, 14, 21, 28, 35, 45]
MAX_HORIZON = 45
WINDOW = 10  # days of history available at inference (the "route" input)

# Crops used for the fast default training run. Full archive = all 325.
DEMO_CROPS = ["Soyabean", "Wheat", "Onion", "Tomato"]

# Categorical feature columns (LightGBM native categorical handling).
CATEGORICALS = ["crop", "state", "district", "market", "variety", "group"]
```

- [ ] **Step 5: Append to `.gitignore`**

```
models/
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 6: Install deps**

Run: `python -m pip install -r requirements.txt`
Expected: all already satisfied (lightgbm/pandas/sklearn present), pytest installs if missing.

- [ ] **Step 7: Commit**

```bash
git add requirements.txt pytest.ini src/fasalsaathi/__init__.py src/fasalsaathi/config.py .gitignore
git commit -m "chore: scaffold fasalsaathi package and config"
```

---

## Task 2: Data normalizer (schema + dates)

Two header styles exist: with suffixes (`Arrivals (Tonnes)`, `Min Price (Rs./Quintal)`, date `12 Jan 2007`) and without (`Arrivals`, `Min Price`, date `2005-08-24`). Normalize both.

**Files:**
- Create: `src/fasalsaathi/data_loader.py`
- Test: `tests/test_data_loader.py`

- [ ] **Step 1: Write the failing test**

```python
import pandas as pd
from fasalsaathi.data_loader import normalize_frame

def test_normalize_handles_both_header_styles():
    suffixed = pd.DataFrame({
        "State Name": ["MP"], "District Name": ["Dewas"], "Market Name": ["Dewas"],
        "Variety": ["Local"], "Group": ["Oil Seeds"], "Arrivals (Tonnes)": [1.3],
        "Min Price (Rs./Quintal)": [1021.0], "Max Price (Rs./Quintal)": [1069.0],
        "Modal Price (Rs./Quintal)": [1029.0], "Reported Date": ["12 Jan 2007"],
    })
    out = normalize_frame(suffixed, crop="Soyabean")
    row = out.iloc[0]
    assert row["crop"] == "Soyabean"
    assert row["state"] == "MP" and row["market"] == "Dewas"
    assert row["modal_price"] == 1029.0 and row["arrivals"] == 1.3
    assert str(row["date"].date()) == "2007-01-12"

def test_normalize_plain_headers_and_iso_date():
    plain = pd.DataFrame({
        "State Name": ["AR"], "District Name": ["Tawang"], "Market Name": ["Tawang"],
        "Variety": ["Other"], "Group": ["Fruits"], "Arrivals": [0.12],
        "Min Price": [4000.0], "Max Price": [4000.0], "Modal Price": [4000.0],
        "Reported Date": ["2005-08-24"],
    })
    out = normalize_frame(plain, crop="Apple")
    assert str(out.iloc[0]["date"].date()) == "2005-08-24"

def test_normalize_drops_zero_and_nan_prices():
    bad = pd.DataFrame({
        "State Name": ["AR"], "District Name": ["X"], "Market Name": ["Y"],
        "Variety": ["V"], "Group": ["Vegetables"], "Arrivals (Tonnes)": [2.98],
        "Min Price (Rs./Quintal)": [0.0], "Max Price (Rs./Quintal)": [0.0],
        "Modal Price (Rs./Quintal)": [0.0], "Reported Date": ["19 Aug 2013"],
    })
    out = normalize_frame(bad, crop="Tomato")
    assert len(out) == 0  # zero modal price row removed
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_data_loader.py -v`
Expected: FAIL — `ImportError: cannot import name 'normalize_frame'`

- [ ] **Step 3: Write minimal implementation**

```python
import pandas as pd

_RENAME = {
    "State Name": "state", "District Name": "district", "Market Name": "market",
    "Variety": "variety", "Group": "group",
    "Arrivals": "arrivals", "Arrivals (Tonnes)": "arrivals",
    "Min Price": "min_price", "Min Price (Rs./Quintal)": "min_price",
    "Max Price": "max_price", "Max Price (Rs./Quintal)": "max_price",
    "Modal Price": "modal_price", "Modal Price (Rs./Quintal)": "modal_price",
    "Reported Date": "date",
}

def normalize_frame(df: pd.DataFrame, crop: str) -> pd.DataFrame:
    df = df.rename(columns=_RENAME).copy()
    df["crop"] = crop
    # Parse both "12 Jan 2007" and "2005-08-24" formats.
    df["date"] = pd.to_datetime(df["date"], format="mixed", dayfirst=False, errors="coerce")
    for col in ("arrivals", "min_price", "max_price", "modal_price"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["date", "modal_price"])
    df = df[df["modal_price"] > 0]
    keep = ["crop", "state", "district", "market", "variety", "group",
            "arrivals", "min_price", "max_price", "modal_price", "date"]
    return df[keep].reset_index(drop=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_data_loader.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/data_loader.py tests/test_data_loader.py
git commit -m "feat: normalize Agmarknet CSV schema and date formats"
```

---

## Task 3: Load crops from disk

**Files:**
- Modify: `src/fasalsaathi/data_loader.py`
- Test: `tests/test_data_loader.py`

- [ ] **Step 1: Add failing test** (append to `tests/test_data_loader.py`)

```python
from pathlib import Path
from fasalsaathi.data_loader import load_crop, available_crops
from fasalsaathi import config

def test_available_crops_lists_csv_stems():
    crops = available_crops()
    assert "Soyabean" in crops
    assert len(crops) > 300

def test_load_crop_returns_normalized_frame():
    df = load_crop("Soyabean")
    assert {"crop", "market", "modal_price", "date"}.issubset(df.columns)
    assert (df["modal_price"] > 0).all()
    assert df["crop"].unique().tolist() == ["Soyabean"]
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_data_loader.py -k "available or load_crop" -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement** (append to `src/fasalsaathi/data_loader.py`)

```python
from pathlib import Path
from fasalsaathi import config

def available_crops() -> list[str]:
    return sorted(p.stem for p in config.DATA_DIR.glob("*.csv"))

def load_crop(crop: str) -> pd.DataFrame:
    path = config.DATA_DIR / f"{crop}.csv"
    if not path.exists():
        raise FileNotFoundError(f"No CSV for crop {crop!r} at {path}")
    raw = pd.read_csv(path)
    return normalize_frame(raw, crop=crop)
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_data_loader.py -v`
Expected: PASS (5 tests). Note: `load_crop("Soyabean")` reads a real ~tens-of-MB file; allow a few seconds.

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/data_loader.py tests/test_data_loader.py
git commit -m "feat: load and list crops from the archive"
```

---

## Task 4: Perishability table

**Files:**
- Create: `src/fasalsaathi/perishability.py`
- Test: `tests/test_perishability.py`

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_perishability.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement**

```python
# Hardcoded MVP perishability. Replace with a real spoilage model later.
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
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_perishability.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/perishability.py tests/test_perishability.py
git commit -m "feat: hardcoded per-crop perishability lookup"
```

---

## Task 5: Feature row from a 10-day window

Scale-invariant features: all price-derived features are ratios to the latest price, so nothing is tied to a year's rupee level.

**Files:**
- Create: `src/fasalsaathi/features.py`
- Test: `tests/test_features.py`

- [ ] **Step 1: Write the failing test**

```python
import numpy as np
import pandas as pd
from fasalsaathi.features import window_features

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
    # ratio features identical regardless of absolute level
    for k in range(1, 10):
        assert abs(fb[f"lag_ratio_{k}"] - fs[f"lag_ratio_{k}"]) < 1e-9
    assert abs(fb["roll_mean_ratio"] - fs["roll_mean_ratio"]) < 1e-9

def test_window_features_carry_calendar_and_categoricals():
    f = window_features(_series([100]*9 + [110]))
    assert f["crop"] == "Soyabean" and f["market"] == "Dewas"
    assert 1 <= f["month"] <= 12
    assert "anchor_price" in f and f["anchor_price"] == 110
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_features.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement**

```python
import numpy as np
import pandas as pd
from fasalsaathi import config

def window_features(window: pd.DataFrame) -> dict:
    """Build features from the last WINDOW rows (sorted ascending by date)."""
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
    return feats
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_features.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/features.py tests/test_features.py
git commit -m "feat: scale-invariant 10-day window features"
```

---

## Task 6: Build the multi-horizon training table

For each market series, slide the window; for each anchor and each training horizon, emit a row with target = `price(t+h)/price(t)`.

**Files:**
- Modify: `src/fasalsaathi/features.py`
- Test: `tests/test_features.py`

- [ ] **Step 1: Add failing test**

```python
from fasalsaathi.features import build_training_rows

def test_build_training_rows_targets_are_future_ratios():
    # strictly rising series: 30 days
    prices = list(range(100, 130))
    df = _series(prices)
    rows = build_training_rows(df, horizons=[1, 5])
    assert len(rows) > 0
    # for any row, target_ratio == price(anchor+h)/anchor and h recorded
    r = rows.iloc[0]
    assert r["horizon"] in (1, 5)
    assert r["target_ratio"] > 1.0  # rising series → future > present
    assert "lag_ratio_1" in rows.columns and "anchor_price" in rows.columns

def test_build_training_rows_skips_when_insufficient_history_or_future():
    df = _series(list(range(100, 112)))  # 12 days
    rows = build_training_rows(df, horizons=[45])  # no 45-day future exists
    assert len(rows) == 0
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_features.py -k build_training_rows -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement** (append to `features.py`)

```python
def build_training_rows(series: pd.DataFrame, horizons: list[int] | None = None) -> pd.DataFrame:
    """series = one market's history (sorted). Returns one row per (anchor, horizon)."""
    horizons = horizons or config.TRAIN_HORIZONS
    s = series.sort_values("date").reset_index(drop=True)
    prices = s["modal_price"].to_numpy(dtype=float)
    n = len(prices)
    out = []
    for t in range(config.WINDOW - 1, n):
        window = s.iloc[t - config.WINDOW + 1 : t + 1]
        if len(window) < config.WINDOW:
            continue
        base_feats = window_features(window)
        anchor = base_feats["anchor_price"]
        for h in horizons:
            if t + h >= n:
                continue
            future = prices[t + h]
            if anchor <= 0:
                continue
            row = dict(base_feats)
            row["horizon"] = h
            row["target_ratio"] = float(future / anchor)
            out.append(row)
    return pd.DataFrame(out)

def build_training_table(frames: list[pd.DataFrame], horizons: list[int] | None = None) -> pd.DataFrame:
    """Concatenate training rows across many market series / crops."""
    parts = []
    for df in frames:
        group_cols = ["crop", "state", "district", "market", "variety"]
        for _, series in df.groupby(group_cols, observed=True):
            if len(series) >= config.WINDOW + 1:
                parts.append(build_training_rows(series, horizons))
    return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_features.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/features.py tests/test_features.py
git commit -m "feat: build multi-horizon ratio-target training table"
```

---

## Task 7: Train the global LightGBM model

Train on ratio targets; time-based split; save model + metrics; assert it beats the persistence baseline (predict ratio = 1.0).

**Files:**
- Create: `src/fasalsaathi/train.py`
- Test: `tests/test_train.py`

- [ ] **Step 1: Write the failing test** (small synthetic data so it runs fast)

```python
import numpy as np
import pandas as pd
from fasalsaathi.train import train_model, FEATURE_COLS

def _synthetic_series(market, seed):
    rng = np.random.default_rng(seed)
    n = 400
    dates = pd.date_range("2022-01-01", periods=n, freq="D")
    # seasonal sine + mild noise, positive prices
    price = 2000 + 300 * np.sin(np.arange(n) / 30.0) + rng.normal(0, 20, n)
    return pd.DataFrame({
        "date": dates, "modal_price": price, "arrivals": rng.uniform(5, 50, n),
        "crop": "Soyabean", "state": "MP", "district": "Dewas",
        "market": market, "variety": "Local", "group": "Oil Seeds",
    })

def test_train_model_beats_persistence_baseline(tmp_path):
    frames = [_synthetic_series(f"M{i}", seed=i) for i in range(6)]
    model, metrics = train_model(frames, model_path=tmp_path / "m.txt",
                                 meta_path=tmp_path / "m.json")
    # MAPE on ratio target must beat the naive "ratio=1.0" baseline
    assert metrics["mape"] < metrics["baseline_mape"]
    assert (tmp_path / "m.txt").exists()
    assert set(FEATURE_COLS).issubset(set(model.feature_name()))
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_train.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement**

```python
import json
import numpy as np
import pandas as pd
import lightgbm as lgb
from fasalsaathi import config
from fasalsaathi.features import build_training_table

FEATURE_COLS = (
    [f"lag_ratio_{k}" for k in range(1, config.WINDOW)]
    + ["roll_mean_ratio", "roll_std_ratio", "slope_ratio", "arrivals_log",
       "month", "weekofyear", "dayofyear", "horizon"]
    + config.CATEGORICALS
)

def _mape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100)

def train_model(frames, model_path=None, meta_path=None):
    model_path = model_path or config.MODEL_PATH
    meta_path = meta_path or config.META_PATH
    table = build_training_table(frames)
    if table.empty:
        raise ValueError("No training rows produced")
    table = table.sort_values("anchor_date").reset_index(drop=True)
    for c in config.CATEGORICALS:
        table[c] = table[c].astype("category")
    # time-based split: last 20% by anchor_date = validation
    cut = int(len(table) * 0.8)
    train_df, val_df = table.iloc[:cut], table.iloc[cut:]
    X_train, y_train = train_df[FEATURE_COLS], train_df["target_ratio"]
    X_val, y_val = val_df[FEATURE_COLS], val_df["target_ratio"]
    dtrain = lgb.Dataset(X_train, label=y_train, categorical_feature=config.CATEGORICALS)
    dval = lgb.Dataset(X_val, label=y_val, reference=dtrain)
    params = {"objective": "regression", "metric": "mae", "learning_rate": 0.05,
              "num_leaves": 63, "min_data_in_leaf": 50, "verbose": -1}
    model = lgb.train(params, dtrain, num_boost_round=400, valid_sets=[dval],
                      callbacks=[lgb.early_stopping(30, verbose=False)])
    pred = model.predict(X_val, num_iteration=model.best_iteration)
    # residual std per horizon → confidence bands (used by forecaster)
    resid = pd.DataFrame({"horizon": val_df["horizon"].to_numpy(),
                          "err": np.abs(y_val.to_numpy() - pred)})
    band = resid.groupby("horizon")["err"].mean().to_dict()
    metrics = {"mape": _mape(y_val, pred),
               "baseline_mape": _mape(y_val, np.ones_like(y_val)),
               "n_train": int(len(train_df)), "n_val": int(len(val_df)),
               "residual_band_by_horizon": {str(k): float(v) for k, v in band.items()}}
    config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(model_path))
    meta_path.write_text(json.dumps(metrics, indent=2))
    return model, metrics
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_train.py -v`
Expected: PASS — model beats baseline on synthetic seasonal data.

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/train.py tests/test_train.py
git commit -m "feat: train global LightGBM on ratio targets with time-split"
```

---

## Task 8: Forecaster (curve + cold-start fallback)

**Files:**
- Create: `src/fasalsaathi/forecast.py`
- Test: `tests/test_forecast.py`

- [ ] **Step 1: Write the failing test** (trains a tiny model in a fixture, then forecasts)

```python
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
        n = 400
        dates = pd.date_range("2022-01-01", periods=n, freq="D")
        price = 2000 + 300 * np.sin(np.arange(n) / 30.0) + rng.normal(0, 20, n)
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
    # day-1 forecast should be near the 2026 anchor level, not the 2000-era training level
    assert 2000 < curve.iloc[0]["price"] < 3000
    assert {"day", "price", "low", "high"}.issubset(curve.columns)
    assert (curve["high"] >= curve["price"]).all()

def test_forecast_unknown_market_still_works_with_low_confidence(trained):
    mp, meta = trained
    fc = Forecaster(mp, meta)
    out = fc.forecast_curve(_last10(market="TotallyNewMandi", anchor=2500.0), return_meta=True)
    assert out["confidence"] in ("low", "medium")
    assert len(out["curve"]) == 45
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_forecast.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement**

```python
import json
import numpy as np
import pandas as pd
import lightgbm as lgb
from fasalsaathi import config
from fasalsaathi.features import window_features
from fasalsaathi.train import FEATURE_COLS

class Forecaster:
    def __init__(self, model_path=None, meta_path=None):
        self.model = lgb.Booster(model_file=str(model_path or config.MODEL_PATH))
        meta = json.loads((meta_path or config.META_PATH).read_text())
        self.band = {int(k): v for k, v in meta.get("residual_band_by_horizon", {}).items()}
        self._known = set(self.model.pandas_categorical[0]) if self.model.pandas_categorical else set()

    def _band_for(self, h: int) -> float:
        if not self.band:
            return 0.05
        # nearest trained horizon's residual
        nearest = min(self.band, key=lambda k: abs(k - h))
        return self.band[nearest]

    def forecast_curve(self, last_window: pd.DataFrame, return_meta: bool = False):
        feats = window_features(last_window)
        anchor = feats["anchor_price"]
        confidence = "high"
        # cold-start: unknown market widens the band
        if self._known and feats["market"] not in self._known:
            confidence = "low"
        rows = []
        for h in range(1, config.MAX_HORIZON + 1):
            r = dict(feats); r["horizon"] = h
            rows.append(r)
        X = pd.DataFrame(rows)
        for c in config.CATEGORICALS:
            X[c] = X[c].astype("category")
        factors = self.model.predict(X[FEATURE_COLS])
        out = []
        for h, fac in zip(range(1, config.MAX_HORIZON + 1), factors):
            band = self._band_for(h) * (2.0 if confidence == "low" else 1.0)
            price = anchor * fac
            out.append({"day": h, "price": float(price),
                        "low": float(anchor * (fac - band)),
                        "high": float(anchor * (fac + band))})
        curve = pd.DataFrame(out)
        if return_meta:
            return {"curve": curve, "confidence": confidence, "anchor_price": anchor}
        return curve
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_forecast.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/forecast.py tests/test_forecast.py
git commit -m "feat: forecaster builds 45-day curve with confidence + cold-start fallback"
```

---

## Task 9: Decision engine

**Files:**
- Create: `src/fasalsaathi/decision.py`
- Test: `tests/test_decision.py`

- [ ] **Step 1: Write the failing test** (use a synthetic curve directly — no model needed)

```python
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
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_decision.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement**

```python
import pandas as pd
from fasalsaathi.perishability import shelf_life

# Minimum per-quintal gain over sell-now (after costs) to justify holding.
RISK_MARGIN_PER_QTL = 50.0

def decide(curve: pd.DataFrame, crop: str, group: str, sell_now_price: float,
           quantity_qtl: float, storage_cost_per_qtl_month: float,
           max_wait_days: int, confidence: str = "high") -> dict:
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

    # require the gain to clear the risk margin (wider when confidence is low)
    margin = RISK_MARGIN_PER_QTL * (2.0 if confidence == "low" else 1.0)
    hold = best_day > 0 and (best_net - sell_now_price) >= margin

    if hold:
        row = curve[curve["day"] == best_day].iloc[0]
        exp_mid, exp_low, exp_high = row["price"], row["low"], row["high"]
        good_day = best_day
    else:
        best_day = 0
        exp_mid = exp_low = exp_high = sell_now_price
        good_day = 0

    storage_total_pq = good_day * daily_storage
    gain_pq = (best_net - sell_now_price) if hold else 0.0

    def total(x): return round(x * quantity_qtl, 2)
    return {
        "decision": "HOLD" if hold else "SELL",
        "wait_days": {"best": good_day,
                      "range": [max(0, good_day - 7), min(cap, good_day + 7)] if hold else [0, 0]},
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
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_decision.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/fasalsaathi/decision.py tests/test_decision.py
git commit -m "feat: sell/hold decision engine with perishability cap and quantity scaling"
```

---

## Task 10: Route entry point + end-to-end wiring

**Files:**
- Create: `src/fasalsaathi/route.py`
- Test: `tests/test_route.py`

- [ ] **Step 1: Write the failing test**

```python
import numpy as np
import pandas as pd
import pytest
from fasalsaathi.train import train_model
from fasalsaathi.route import predict_route

@pytest.fixture
def model_files(tmp_path):
    rng = np.random.default_rng(1)
    frames = []
    for i in range(6):
        n = 400
        dates = pd.date_range("2022-01-01", periods=n, freq="D")
        price = 2000 + 300 * np.sin(np.arange(n) / 30.0) + rng.normal(0, 20, n)
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
    out = predict_route(payload, model_path=mp, meta_path=meta)
    assert out["decision"] in ("SELL", "HOLD")
    assert out["total"]["sell_now"] > 0
    assert "curve" in out and len(out["curve"]) == 45
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_route.py -v`
Expected: FAIL — `ImportError`

- [ ] **Step 3: Implement**

```python
import pandas as pd
from fasalsaathi.forecast import Forecaster
from fasalsaathi.decision import decide

def predict_route(payload: dict, model_path=None, meta_path=None) -> dict:
    mandi = payload["mandi"]
    rows = []
    for d in payload["last_10_days"]:
        rows.append({
            "date": pd.to_datetime(d["date"]), "modal_price": float(d["modal"]),
            "arrivals": float(d.get("arrivals", 0.0)),
            "crop": payload["crop"], "state": mandi["state"],
            "district": mandi["district"], "market": mandi["market"],
            "variety": payload.get("variety", "Other"),
            "group": payload.get("group", "Unknown")})
    window = pd.DataFrame(rows).sort_values("date")
    fc = Forecaster(model_path, meta_path)
    fres = fc.forecast_curve(window, return_meta=True)
    sell_now = float(window["modal_price"].iloc[-1])
    out = decide(fres["curve"], crop=payload["crop"],
                 group=payload.get("group", "Unknown"), sell_now_price=sell_now,
                 quantity_qtl=float(payload["quantity_qtl"]),
                 storage_cost_per_qtl_month=float(payload.get("storage_cost_per_qtl_month", 9)),
                 max_wait_days=int(payload.get("max_wait_days", 45)),
                 confidence=fres["confidence"])
    out["good_sale_window_day"] = out["wait_days"]["best"]
    out["curve"] = fres["curve"].to_dict(orient="records")
    return out
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_route.py -v`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `python -m pytest -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/fasalsaathi/route.py tests/test_route.py
git commit -m "feat: predict_route end-to-end entry point"
```

---

## Task 11: Train on real data + write a runnable training script

**Files:**
- Create: `scripts/train_real.py`
- Test: manual (real data, slow)

- [ ] **Step 1: Write `scripts/train_real.py`**

```python
"""Train the global model on real archive data.
Usage: python scripts/train_real.py            # demo crops (fast)
       python scripts/train_real.py --all       # all 325 crops (slow, lots of RAM)
"""
import sys
from fasalsaathi import config
from fasalsaathi.data_loader import load_crop, available_crops
from fasalsaathi.train import train_model

def main():
    use_all = "--all" in sys.argv
    crops = available_crops() if use_all else config.DEMO_CROPS
    print(f"Loading {len(crops)} crops...")
    frames = []
    for c in crops:
        try:
            df = load_crop(c)
            frames.append(df)
            print(f"  {c}: {len(df):,} rows")
        except Exception as e:
            print(f"  SKIP {c}: {e}")
    print("Training...")
    model, metrics = train_model(frames)
    print(f"MAPE={metrics['mape']:.2f}%  baseline={metrics['baseline_mape']:.2f}%  "
          f"train={metrics['n_train']:,}  val={metrics['n_val']:,}")
    print(f"Saved to {config.MODEL_PATH}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run on demo crops**

Run: `python scripts/train_real.py`
Expected: prints per-crop row counts, then `MAPE=... baseline=...` with **MAPE < baseline**, model saved to `models/global_lgbm.txt`. (Soyabean/Wheat/Onion/Tomato — may take a few minutes and significant RAM.)

- [ ] **Step 3: Smoke-test the route on the real model**

Run:
```bash
python -c "from fasalsaathi.route import predict_route; import json; print(json.dumps(predict_route({'crop':'Soyabean','variety':'Local','group':'Oil Seeds','mandi':{'state':'Madhya Pradesh','district':'Dewas','market':'Dewas'},'last_10_days':[{'date':f'2026-06-{d:02d}','modal':4600+d*5,'min':4500,'max':4800,'arrivals':100} for d in range(1,11)],'quantity_qtl':50,'cash_need_now':30000,'storage_cost_per_qtl_month':9,'max_wait_days':45}), default=str, indent=2)[:1500])"
```
Expected: a JSON decision with `decision`, `wait_days`, `total`, and a 45-point `curve`.

- [ ] **Step 4: Commit**

```bash
git add scripts/train_real.py
git commit -m "feat: real-data training script (demo crops + --all)"
```

---

## Self-Review

**Spec coverage:**
- Global model, crop as feature → Tasks 6, 7 (training table pools all crops; categoricals incl. crop). ✓
- Predict movement not level (ratio targets) → Tasks 5, 6 (ratio features + `target_ratio`), reconstructed in Task 8. ✓
- Old data → 2026 prices via anchor → Task 8 (`anchor * factor`), tested in `test_forecast_curve_anchored_to_current_price`. ✓
- 45-day trajectory + optimal wait window → Tasks 8 (curve) + 9 (`decide` argmax). ✓
- 10-day input contract → Task 5 (`WINDOW=10`), Task 10 (`last_10_days`). ✓
- Quantity scales totals → Task 9 (`total` block), tested. ✓
- Per-crop perishability cap → Tasks 4 + 9, tested (tomato forced SELL). ✓
- Unknown mandi/crop fallback + confidence → Task 8 (cold-start), Task 9 (wider margin). ✓
- Time-based split + beat persistence baseline → Task 7, asserted in test. ✓
- Cross-year validation (train ≤2022, test 2023–24): **covered by the time-based split** (validation = most recent dates). A dedicated year-cut report is a nice-to-have; noted as future work, not a blocker for MVP.

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `FEATURE_COLS` (Task 7) matches keys produced by `window_features` (Task 5) + `horizon` (Task 6). `forecast_curve` returns columns `day/price/low/high` consumed by `decide` (Task 9). `predict_route` (Task 10) passes `group`/`confidence` matching `decide`'s signature. ✓

**Known MVP simplifications (documented, not gaps):** cash_need/pledge-loan path is accepted but not yet used in the decision (spec §8 out-of-scope); confidence is binary high/low; residual band is symmetric.

---

## Weather Integration Addendum (added after spec §3.4)

Weather features (Open-Meteo Archive API) are joined by `district + date` and learned by the model. Network is isolated and tests run offline (HTTP injected/mocked). Adds one module and modifies three tasks.

### Task W1: Weather provider (`weather.py`)

**Files:** Create `src/fasalsaathi/weather.py`, `tests/test_weather.py`

- [ ] **Step 1: Failing test** — aggregation + offline behaviour (no network in tests)

```python
import pandas as pd
from fasalsaathi.weather import weather_features_from_daily, WeatherProvider

def _daily(rain, tmax, tmin, tmean, hum):
    dates = pd.date_range("2026-06-01", periods=len(rain), freq="D")
    return pd.DataFrame({"date": dates, "rain": rain, "tmax": tmax,
                         "tmin": tmin, "tmean": tmean, "humidity": hum})

def test_weather_features_aggregate_window():
    d = _daily([0,10,60,0,0,0,0,0,0,5], [35]*9+[41], [20]*10, [27]*10, [55]*10)
    f = weather_features_from_daily(d)
    assert f["rain_sum_10d"] == 85
    assert f["rain_max_1d"] == 60
    assert f["heavy_rain_flag"] == 1     # 60 > HEAVY_RAIN_MM (50)
    assert f["heatwave_flag"] == 1       # 41 > HEATWAVE_C (40)
    assert f["temp_max_10d"] == 41 and f["humidity_mean_10d"] == 55

def test_weather_features_empty_returns_nan():
    f = weather_features_from_daily(pd.DataFrame(columns=["date","rain","tmax","tmin","tmean","humidity"]))
    assert all(v != v for v in [f["rain_sum_10d"], f["temp_mean_10d"]])  # NaN

def test_provider_uses_injected_fetcher_no_network():
    calls = {}
    def fake_geocode(name): calls["geo"] = name; return (22.9, 76.0)
    def fake_archive(lat, lon, start, end):
        return _daily([1]*3, [30]*3, [18]*3, [24]*3, [50]*3).assign(
            date=pd.date_range(start, periods=3, freq="D"))
    wp = WeatherProvider(geocoder=fake_geocode, archive=fake_archive)
    out = wp.weather_window("Dewas", pd.date_range("2026-06-01", periods=3, freq="D"))
    assert len(out) == 3 and "rain" in out.columns
    assert calls["geo"] == "Dewas"
```

- [ ] **Step 2: Run to verify fail** — `python -m pytest tests/test_weather.py -v` → ImportError

- [ ] **Step 3: Implement**

```python
import json
import numpy as np
import pandas as pd
import requests
from fasalsaathi import config

def weather_features_from_daily(daily: pd.DataFrame) -> dict:
    """Aggregate a daily weather window into the WEATHER_FEATURES dict."""
    if daily is None or len(daily) == 0:
        return {k: np.nan for k in config.WEATHER_FEATURES}
    return {
        "rain_sum_10d": float(daily["rain"].sum()),
        "rain_max_1d": float(daily["rain"].max()),
        "temp_mean_10d": float(daily["tmean"].mean()),
        "temp_max_10d": float(daily["tmax"].max()),
        "temp_min_10d": float(daily["tmin"].min()),
        "humidity_mean_10d": float(daily["humidity"].mean()),
        "heavy_rain_flag": int(daily["rain"].max() > config.HEAVY_RAIN_MM),
        "heatwave_flag": int(daily["tmax"].max() > config.HEATWAVE_C),
    }

def _http_geocode(name: str):
    r = requests.get(config.OPENMETEO_GEOCODE_URL,
                     params={"name": name, "count": 1}, timeout=20)
    res = r.json().get("results")
    if not res:
        return None
    return (res[0]["latitude"], res[0]["longitude"])

def _http_archive(lat, lon, start, end) -> pd.DataFrame:
    params = {"latitude": lat, "longitude": lon,
              "start_date": str(pd.Timestamp(start).date()),
              "end_date": str(pd.Timestamp(end).date()),
              "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,"
                       "temperature_2m_mean,relative_humidity_2m_mean",
              "timezone": "Asia/Kolkata"}
    r = requests.get(config.OPENMETEO_ARCHIVE_URL, params=params, timeout=60)
    d = r.json()["daily"]
    return pd.DataFrame({
        "date": pd.to_datetime(d["time"]), "rain": d["precipitation_sum"],
        "tmax": d["temperature_2m_max"], "tmin": d["temperature_2m_min"],
        "tmean": d["temperature_2m_mean"], "humidity": d["relative_humidity_2m_mean"]})

class WeatherProvider:
    def __init__(self, geocoder=_http_geocode, archive=_http_archive):
        self.geocoder = geocoder
        self.archive = archive
        config.WEATHER_CACHE.mkdir(parents=True, exist_ok=True)
        self._geo = json.loads(config.GEOCODE_CACHE.read_text()) if config.GEOCODE_CACHE.exists() else {}

    def latlon(self, district: str):
        if district in self._geo:
            return tuple(self._geo[district]) if self._geo[district] else None
        ll = self.geocoder(district)
        self._geo[district] = list(ll) if ll else None
        config.GEOCODE_CACHE.parent.mkdir(parents=True, exist_ok=True)
        config.GEOCODE_CACHE.write_text(json.dumps(self._geo))
        return ll

    def daily_history(self, district: str, start, end) -> pd.DataFrame:
        cache = config.WEATHER_CACHE / f"{district}.parquet"
        if cache.exists():
            df = pd.read_parquet(cache)
        else:
            ll = self.latlon(district)
            if not ll:
                return pd.DataFrame(columns=["date","rain","tmax","tmin","tmean","humidity"])
            df = self.archive(ll[0], ll[1], start, end)
            df.to_parquet(cache)
        return df

    def weather_window(self, district: str, dates) -> pd.DataFrame:
        dates = pd.to_datetime(pd.Index(dates))
        df = self.daily_history(district, dates.min(), dates.max())
        if len(df) == 0:
            return df
        return df[df["date"].isin(dates)].sort_values("date")
```

- [ ] **Step 4: Run to verify pass** — `python -m pytest tests/test_weather.py -v` → 3 PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: Open-Meteo weather provider + window aggregation"`

### Modification to Task 5 (window_features)

After building price features, merge weather features. `window_features(window, weather_daily=None)` gains an optional weather frame; if provided, call `weather_features_from_daily(weather_daily)` and merge; else fill `WEATHER_FEATURES` with `NaN`. Add an assertion to `tests/test_features.py` that the keys exist.

### Modification to Task 6/7 (training table + FEATURE_COLS)

- `build_training_table` accepts an optional `WeatherProvider`; for each market series it fetches that district's weather history once and passes the matching window to `window_features`.
- `FEATURE_COLS` gains `+ config.WEATHER_FEATURES`.

### Modification to Task 10 (route)

`predict_route` auto-fetches weather for the mandi's district over the `last_10_days` dates via `WeatherProvider().weather_window(...)` (unless weather is already supplied in the payload), and passes it into the forecaster's feature build.
