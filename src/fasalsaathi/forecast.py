import json

import pandas as pd
import lightgbm as lgb

from fasalsaathi import config
from fasalsaathi.features import window_features
from fasalsaathi.train import FEATURE_COLS

_MARKET_IDX = config.CATEGORICALS.index("market")


class Forecaster:
    def __init__(self, model_path=None, meta_path=None):
        self.model = lgb.Booster(model_file=str(model_path or config.MODEL_PATH))
        meta = json.loads((meta_path or config.META_PATH).read_text())
        self.band = {int(k): v for k, v in meta.get("residual_band_by_horizon", {}).items()}
        cats = self.model.pandas_categorical
        # categoricals appear in FEATURE_COLS in config.CATEGORICALS order
        self._known_markets = set(cats[_MARKET_IDX]) if cats and len(cats) > _MARKET_IDX else set()

    def _band_for(self, h: int) -> float:
        if not self.band:
            return 0.05
        nearest = min(self.band, key=lambda k: abs(k - h))
        return self.band[nearest]

    def forecast_curve(self, last_window: pd.DataFrame, weather_daily=None,
                       return_meta: bool = False):
        feats = window_features(last_window, weather_daily=weather_daily)
        anchor = feats["anchor_price"]
        confidence = "high"
        if self._known_markets and feats["market"] not in self._known_markets:
            confidence = "low"  # unseen mandi -> rely on crop/region/season + momentum
        rows = []
        for h in range(1, config.MAX_HORIZON + 1):
            r = dict(feats)
            r["horizon"] = h
            rows.append(r)
        X = pd.DataFrame(rows)
        for c in config.CATEGORICALS:
            X[c] = X[c].astype("category")
        factors = self.model.predict(X[FEATURE_COLS])
        widen = 2.0 if confidence == "low" else 1.0
        out = []
        for h, fac in zip(range(1, config.MAX_HORIZON + 1), factors):
            band = self._band_for(h) * widen
            out.append({"day": h, "price": float(anchor * fac),
                        "low": float(anchor * (fac - band)),
                        "high": float(anchor * (fac + band))})
        curve = pd.DataFrame(out)
        if return_meta:
            return {"curve": curve, "confidence": confidence, "anchor_price": anchor}
        return curve
