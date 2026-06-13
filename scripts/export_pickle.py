"""Export the trained model as a self-contained pickle bundle.

Usage: python scripts/export_pickle.py [output.pkl]

The bundle is a dict with everything needed to predict:
  booster        - the trained lightgbm.Booster
  meta           - metrics + residual bands + feature importance
  feature_cols   - exact feature column order the booster expects
  categoricals   - categorical feature names
  window         - input history length (days)
  max_horizon    - forecast horizon (days)
"""
import pickle
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import lightgbm as lgb                       # noqa: E402
from fasalsaathi import config               # noqa: E402
from fasalsaathi.train import FEATURE_COLS   # noqa: E402


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else config.MODEL_DIR / "global_lgbm.pkl"
    if not config.MODEL_PATH.exists():
        raise SystemExit(f"No trained model at {config.MODEL_PATH}. Train first.")
    booster = lgb.Booster(model_file=str(config.MODEL_PATH))
    meta = json.loads(config.META_PATH.read_text()) if config.META_PATH.exists() else {}
    bundle = {
        "booster": booster,
        "meta": meta,
        "feature_cols": FEATURE_COLS,
        "categoricals": config.CATEGORICALS,
        "window": config.WINDOW,
        "max_horizon": config.MAX_HORIZON,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as f:
        pickle.dump(bundle, f)
    print(f"Exported pickle -> {out} ({out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
