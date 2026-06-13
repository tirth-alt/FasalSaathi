"""Train the global model on real archive data.

Usage:
    python scripts/train_real.py                 # demo crops, no weather (fast)
    python scripts/train_real.py --weather        # + Open-Meteo weather join (slower)
    python scripts/train_real.py --all            # all 325 crops (slow, lots of RAM)
    python scripts/train_real.py --stride 7       # subsample anchors (default 7)
    python scripts/train_real.py Soyabean Wheat   # explicit crop list (positional)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from fasalsaathi import config                       # noqa: E402
from fasalsaathi.data_loader import load_crop, available_crops  # noqa: E402
from fasalsaathi.train import train_model            # noqa: E402
from fasalsaathi.weather import WeatherProvider      # noqa: E402


def main():
    args = sys.argv[1:]
    use_all = "--all" in args
    use_weather = "--weather" in args
    stride = 7
    if "--stride" in args:
        stride = int(args[args.index("--stride") + 1])

    # positional (non-flag) args = explicit crop names
    skip = {"--stride", str(stride)}
    positional = [a for a in args if not a.startswith("--") and a not in skip]
    if use_all:
        crops = available_crops()
    elif positional:
        crops = positional
    else:
        crops = config.DEMO_CROPS
    print(f"Loading {len(crops)} crop(s) | stride={stride} | weather={use_weather}")
    frames = []
    for c in crops:
        try:
            df = load_crop(c)
            frames.append(df)
            print(f"  {c}: {len(df):,} rows, {df['district'].nunique()} districts")
        except Exception as e:
            print(f"  SKIP {c}: {e}")

    wp = WeatherProvider() if use_weather else None
    print("Training (this can take a while)...")
    model, metrics = train_model(frames, weather_provider=wp, stride=stride)
    print(f"\nMAPE={metrics['mape']:.2f}%  baseline={metrics['baseline_mape']:.2f}%  "
          f"train={metrics['n_train']:,}  val={metrics['n_val']:,}")
    verdict = "BEATS baseline" if metrics["mape"] < metrics["baseline_mape"] else "WORSE than baseline"
    print(f"Verdict: {verdict}")
    # top features by importance
    imp = sorted(metrics["feature_importance"].items(), key=lambda kv: -kv[1])[:10]
    print("Top features:", ", ".join(f"{k}={v}" for k, v in imp))
    print(f"Saved model -> {config.MODEL_PATH}")


if __name__ == "__main__":
    main()
