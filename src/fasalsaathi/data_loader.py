import pandas as pd

from fasalsaathi import config

_RENAME = {
    "State Name": "state", "District Name": "district", "Market Name": "market",
    "Variety": "variety", "Group": "group",
    "Arrivals": "arrivals", "Arrivals (Tonnes)": "arrivals",
    "Min Price": "min_price", "Min Price (Rs./Quintal)": "min_price",
    "Max Price": "max_price", "Max Price (Rs./Quintal)": "max_price",
    "Modal Price": "modal_price", "Modal Price (Rs./Quintal)": "modal_price",
    "Reported Date": "date",
}


def _parse_dates(s: pd.Series) -> pd.Series:
    """Fast date parse: each file uses one consistent style; try explicit
    formats (~50x faster than format='mixed' on millions of rows)."""
    out = pd.to_datetime(s, format="%d %b %Y", errors="coerce")  # "12 Jan 2007"
    mask = out.isna()
    if mask.any():
        out[mask] = pd.to_datetime(s[mask], format="%Y-%m-%d", errors="coerce")  # "2005-08-24"
    mask = out.isna()
    if mask.any():  # rare stragglers: generic parse
        out[mask] = pd.to_datetime(s[mask], errors="coerce")
    return out


def normalize_frame(df: pd.DataFrame, crop: str) -> pd.DataFrame:
    df = df.rename(columns=_RENAME).copy()
    df["crop"] = crop
    df["date"] = _parse_dates(df["date"])
    for col in ("arrivals", "min_price", "max_price", "modal_price"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["date", "modal_price"])
    df = df[df["modal_price"] > 0]
    keep = ["crop", "state", "district", "market", "variety", "group",
            "arrivals", "min_price", "max_price", "modal_price", "date"]
    return df[keep].reset_index(drop=True)


def available_crops() -> list[str]:
    return sorted(p.stem for p in config.DATA_DIR.glob("*.csv"))


def load_crop(crop: str) -> pd.DataFrame:
    path = config.DATA_DIR / f"{crop}.csv"
    if not path.exists():
        raise FileNotFoundError(f"No CSV for crop {crop!r} at {path}")
    raw = pd.read_csv(path)
    return normalize_frame(raw, crop=crop)
