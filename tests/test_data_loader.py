import pandas as pd
from fasalsaathi.data_loader import normalize_frame, load_crop, available_crops


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


def test_available_crops_lists_csv_stems():
    crops = available_crops()
    assert "Soyabean" in crops
    assert len(crops) > 300


def test_load_crop_returns_normalized_frame():
    df = load_crop("Soyabean")
    assert {"crop", "market", "modal_price", "date"}.issubset(df.columns)
    assert (df["modal_price"] > 0).all()
    assert df["crop"].unique().tolist() == ["Soyabean"]
