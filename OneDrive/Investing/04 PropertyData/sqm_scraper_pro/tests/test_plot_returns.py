# sqm_scraper_pro/tests/test_plot_returns.py
import logging
import pandas as pd
import pytest
from scripts.plot_returns import strip_pct, load_and_clean, build_groups


def test_strip_pct_basic():
    s = pd.Series(["4.9%", "-1.2%", "0.0%"])
    result = strip_pct(s)
    assert list(result) == [4.9, -1.2, 0.0]


def test_strip_pct_handles_nan():
    s = pd.Series(["4.9%", None, "N/A"])
    result = strip_pct(s)
    assert result[0] == pytest.approx(4.9)
    assert pd.isna(result[1])
    assert pd.isna(result[2])


def test_strip_pct_handles_comma_thousands():
    """Values like '3,283.9%' exist in the real dataset and must parse to NaN."""
    s = pd.Series(["3,283.9%", "4.9%"])
    result = strip_pct(s)
    assert pd.isna(result[0])
    assert result[1] == pytest.approx(4.9)


def test_load_and_clean_returns_floats():
    raw = pd.DataFrame({
        "postcode": [2000, 2000],
        "week_ending": ["17 Mar 2026", "17 Mar 2026"],
        "property_type": ["All Houses", "All Units"],
        "asking_price_aud": [2996.0, 1392.0],
        "chg_prev_week_aud": [-21.0, -4.9],
        "rolling_month_pct": ["-6.5%", "-1.7%"],
        "rolling_quarter_pct": ["10.5%", "3.4%"],
        "chg_12m_pct": ["4.8%", "10.6%"],
        "chg_3yr_pa_pct": ["19.9%", "7.0%"],
        "chg_7yr_pa_pct": ["9.1%", "3.3%"],
        "chg_10yr_pa_pct": ["7.2%", "6.5%"],
    })
    cleaned = load_and_clean(raw, property_type="All Houses")
    assert len(cleaned) == 1
    assert cleaned["chg_10yr_pa_pct"].dtype == float
    assert cleaned["chg_12m_pct"].dtype == float
    assert cleaned.iloc[0]["chg_10yr_pa_pct"] == pytest.approx(7.2)


def test_load_and_clean_logs_and_drops_unparseable(caplog):
    """Rows with unparseable pct values must be logged at WARNING before dropping."""
    raw = pd.DataFrame({
        "postcode": [2000, 2001],
        "week_ending": ["17 Mar 2026", "17 Mar 2026"],
        "property_type": ["All Houses", "All Houses"],
        "asking_price_aud": [2996.0, 1000.0],
        "chg_prev_week_aud": [-21.0, 1.0],
        "rolling_month_pct": ["-6.5%", "1.0%"],
        "rolling_quarter_pct": ["10.5%", "1.0%"],
        "chg_12m_pct": ["4.8%", "1.0%"],
        "chg_3yr_pa_pct": ["19.9%", "1.0%"],
        "chg_7yr_pa_pct": ["9.1%", "1.0%"],
        "chg_10yr_pa_pct": ["3,283.9%", "5.0%"],  # first row unparseable
    })
    with caplog.at_level(logging.WARNING):
        cleaned = load_and_clean(raw, property_type="All Houses")
    assert len(cleaned) == 1
    assert cleaned.iloc[0]["postcode"] == 2001
    assert any(
        "2000" in r.message and r.levelno == logging.WARNING
        for r in caplog.records
    )
    assert 2000 not in cleaned["postcode"].values


def test_build_groups_rounds_to_1dp():
    df = pd.DataFrame({
        "chg_10yr_pa_pct": [4.94, 4.96, 5.04, 5.06],
        "chg_12m_pct":     [10.0, 12.0, 8.0,  9.0],
        "postcode":        [1000, 1001, 1002, 1003],
    })
    groups = build_groups(df)
    assert set(groups["group_10yr"]) == {4.9, 5.0, 5.1}
    assert "median_12m" in groups.columns
    assert "count" in groups.columns


def test_build_groups_median_is_correct():
    df = pd.DataFrame({
        "chg_10yr_pa_pct": [5.0, 5.0, 5.0],
        "chg_12m_pct":     [10.0, 20.0, 30.0],
        "postcode":        [1000, 1001, 1002],
    })
    groups = build_groups(df)
    row = groups[groups["group_10yr"] == 5.0].iloc[0]
    assert row["median_12m"] == pytest.approx(20.0)
    assert row["count"] == 3
