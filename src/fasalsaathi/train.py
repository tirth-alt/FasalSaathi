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
    + config.WEATHER_FEATURES
    + config.CATEGORICALS
)


def _mape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100)


def train_model(frames, model_path=None, meta_path=None, weather_provider=None):
    model_path = model_path or config.MODEL_PATH
    meta_path = meta_path or config.META_PATH
    table = build_training_table(frames, weather_provider=weather_provider)
    if table.empty:
        raise ValueError("No training rows produced")
    table = table.sort_values("anchor_date").reset_index(drop=True)
    for c in config.CATEGORICALS:
        table[c] = table[c].astype("category")
    # time-based split: last 20% by anchor_date = validation (never random)
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
    # residual mean abs error per horizon -> confidence bands for the forecaster
    resid = pd.DataFrame({"horizon": val_df["horizon"].to_numpy(),
                          "err": np.abs(y_val.to_numpy() - pred)})
    band = resid.groupby("horizon")["err"].mean().to_dict()
    importance = dict(zip(model.feature_name(),
                          (int(v) for v in model.feature_importance())))
    metrics = {"mape": _mape(y_val, pred),
               "baseline_mape": _mape(y_val, np.ones_like(y_val)),
               "n_train": int(len(train_df)), "n_val": int(len(val_df)),
               "residual_band_by_horizon": {str(k): float(v) for k, v in band.items()},
               "feature_importance": importance}
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(model_path))
    meta_path.write_text(json.dumps(metrics, indent=2))
    return model, metrics
