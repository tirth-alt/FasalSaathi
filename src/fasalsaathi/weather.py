"""Weather features from the free Open-Meteo Archive API, keyed by lat/lon.

District name -> lat/lon (Open-Meteo Geocoding) -> daily weather history
(Open-Meteo Archive). Both calls are free and need no API key. Results are
cached to disk so we never refetch. Network is injectable for offline tests.
"""
import json

import numpy as np
import pandas as pd
import requests

from fasalsaathi import config

_DAILY_COLS = ["date", "rain", "tmax", "tmin", "tmean", "humidity"]


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
    """District name -> (lat, lon) via Open-Meteo geocoding (free, no key)."""
    r = requests.get(config.OPENMETEO_GEOCODE_URL,
                     params={"name": name, "count": 1, "country": "IN"}, timeout=20)
    res = r.json().get("results")
    if not res:
        return None
    return (res[0]["latitude"], res[0]["longitude"])


def _http_archive(lat, lon, start, end) -> pd.DataFrame:
    """Daily weather for a position+date range via Open-Meteo Archive (free)."""
    params = {
        "latitude": lat, "longitude": lon,
        "start_date": str(pd.Timestamp(start).date()),
        "end_date": str(pd.Timestamp(end).date()),
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,"
                 "temperature_2m_mean,relative_humidity_2m_mean",
        "timezone": "Asia/Kolkata",
    }
    r = requests.get(config.OPENMETEO_ARCHIVE_URL, params=params, timeout=60)
    d = r.json()["daily"]
    return pd.DataFrame({
        "date": pd.to_datetime(d["time"]), "rain": d["precipitation_sum"],
        "tmax": d["temperature_2m_max"], "tmin": d["temperature_2m_min"],
        "tmean": d["temperature_2m_mean"], "humidity": d["relative_humidity_2m_mean"],
    })


class WeatherProvider:
    def __init__(self, geocoder=_http_geocode, archive=_http_archive):
        self.geocoder = geocoder
        self.archive = archive
        self._geo = (json.loads(config.GEOCODE_CACHE.read_text())
                     if config.GEOCODE_CACHE.exists() else {})

    def _empty(self) -> pd.DataFrame:
        return pd.DataFrame(columns=_DAILY_COLS)

    def latlon(self, district: str):
        if district in self._geo:
            v = self._geo[district]
            return tuple(v) if v else None
        ll = self.geocoder(district)
        self._geo[district] = list(ll) if ll else None
        config.GEOCODE_CACHE.parent.mkdir(parents=True, exist_ok=True)
        config.GEOCODE_CACHE.write_text(json.dumps(self._geo))
        return ll

    def daily_history(self, district: str, start, end) -> pd.DataFrame:
        config.WEATHER_CACHE.mkdir(parents=True, exist_ok=True)
        cache = config.WEATHER_CACHE / f"{district}.csv"
        if cache.exists():
            df = pd.read_csv(cache)
            df["date"] = pd.to_datetime(df["date"])
            return df
        ll = self.latlon(district)
        if not ll:
            return self._empty()
        df = self.archive(ll[0], ll[1], start, end)
        if df is None or len(df) == 0:
            return self._empty()
        df.to_csv(cache, index=False)
        return df

    def weather_window(self, district: str, dates) -> pd.DataFrame:
        dates = pd.to_datetime(pd.Index(dates))
        df = self.daily_history(district, dates.min(), dates.max())
        if len(df) == 0:
            return df
        df = df.copy()
        df["date"] = pd.to_datetime(df["date"])
        return df[df["date"].isin(dates)].sort_values("date").reset_index(drop=True)
