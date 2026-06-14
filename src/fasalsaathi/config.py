from pathlib import Path

# Root of the per-crop Agmarknet CSV archive (one file per crop).
DATA_DIR = Path(r"C:/Users/Tushar Srivastava/Desktop/archive (2)")
MODEL_DIR = Path(__file__).resolve().parents[2] / "models"
MODEL_PATH = MODEL_DIR / "global_lgbm.txt"
META_PATH = MODEL_DIR / "model_meta.json"

# On-disk caches for weather + district geocoding (so we never refetch).
CACHE_DIR = Path(__file__).resolve().parents[2] / "cache"
WEATHER_CACHE = CACHE_DIR / "weather"
GEOCODE_CACHE = CACHE_DIR / "geocode.json"

# Horizons (days ahead) the model is TRAINED on. Inference may query any
# h in 1..MAX_HORIZON; the model interpolates because h is a numeric feature.
TRAIN_HORIZONS = [1, 3, 5, 7, 10, 14, 21, 28, 35, 45]
MAX_HORIZON = 45
WINDOW = 10  # days of history available at inference (the "route" input)

# Crops used for the fast default training run. Full archive = all 325.
DEMO_CROPS = ["Soyabean", "Wheat", "Onion", "Tomato"]

# Categorical feature columns (LightGBM native categorical handling).
CATEGORICALS = ["crop", "state", "district", "market", "variety", "group"]

# --- Weather (Open-Meteo Archive API) ---------------------------------------
OPENMETEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPENMETEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
# Daily weather variables fetched per district and aggregated over the window.
HEAVY_RAIN_MM = 50.0   # daily rainfall above this -> heavy-rain flag
HEATWAVE_C = 40.0      # daily max temp above this -> heatwave flag
# Weather feature columns added to every training/inference row.
WEATHER_FEATURES = [
    "rain_sum_10d", "rain_max_1d", "temp_mean_10d", "temp_max_10d",
    "temp_min_10d", "humidity_mean_10d", "heavy_rain_flag", "heatwave_flag",
]

# Exact feature column order the model expects (must match how it was trained).
FEATURE_COLS = (
    [f"lag_ratio_{k}" for k in range(1, WINDOW)]
    + ["roll_mean_ratio", "roll_std_ratio", "slope_ratio", "arrivals_log",
       "month", "weekofyear", "dayofyear", "horizon"]
    + WEATHER_FEATURES
    + CATEGORICALS
)
