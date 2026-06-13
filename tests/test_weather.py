import pandas as pd
from fasalsaathi.weather import weather_features_from_daily, WeatherProvider


def _daily(rain, tmax, tmin, tmean, hum):
    dates = pd.date_range("2026-06-01", periods=len(rain), freq="D")
    return pd.DataFrame({"date": dates, "rain": rain, "tmax": tmax,
                         "tmin": tmin, "tmean": tmean, "humidity": hum})


def test_weather_features_aggregate_window():
    d = _daily([0, 10, 60, 0, 0, 0, 0, 0, 0, 5], [35] * 9 + [41], [20] * 10,
               [27] * 10, [55] * 10)
    f = weather_features_from_daily(d)
    assert f["rain_sum_10d"] == 75  # 0+10+60+0*6+5
    assert f["rain_max_1d"] == 60
    assert f["heavy_rain_flag"] == 1     # 60 > HEAVY_RAIN_MM (50)
    assert f["heatwave_flag"] == 1       # 41 > HEATWAVE_C (40)
    assert f["temp_max_10d"] == 41 and f["humidity_mean_10d"] == 55


def test_weather_features_empty_returns_nan():
    empty = pd.DataFrame(columns=["date", "rain", "tmax", "tmin", "tmean", "humidity"])
    f = weather_features_from_daily(empty)
    assert all(v != v for v in [f["rain_sum_10d"], f["temp_mean_10d"]])  # NaN


def test_provider_uses_injected_fetcher_no_network(tmp_path, monkeypatch):
    from fasalsaathi import config
    monkeypatch.setattr(config, "WEATHER_CACHE", tmp_path / "w")
    monkeypatch.setattr(config, "GEOCODE_CACHE", tmp_path / "geo.json")
    calls = {}

    def fake_geocode(name):
        calls["geo"] = name
        return (22.9, 76.0)

    def fake_archive(lat, lon, start, end):
        n = (pd.Timestamp(end) - pd.Timestamp(start)).days + 1
        return _daily([1] * n, [30] * n, [18] * n, [24] * n, [50] * n).assign(
            date=pd.date_range(start, periods=n, freq="D"))

    wp = WeatherProvider(geocoder=fake_geocode, archive=fake_archive)
    dates = pd.date_range("2026-06-01", periods=3, freq="D")
    out = wp.weather_window("Dewas", dates)
    assert len(out) == 3 and "rain" in out.columns
    assert calls["geo"] == "Dewas"


def test_provider_unknown_district_returns_empty(tmp_path, monkeypatch):
    from fasalsaathi import config
    monkeypatch.setattr(config, "WEATHER_CACHE", tmp_path / "w")
    monkeypatch.setattr(config, "GEOCODE_CACHE", tmp_path / "geo.json")
    wp = WeatherProvider(geocoder=lambda name: None, archive=lambda *a: None)
    out = wp.weather_window("Nowhere", pd.date_range("2026-06-01", periods=3, freq="D"))
    assert len(out) == 0
