# sqm_scraper_pro/scripts/plot_returns.py
"""
Plot SQM postcode data: 10yr % pa return (grouped, 1dp) vs median 12m % change.

Usage:
    py scripts/plot_returns.py                        # All Houses, saves PNG
    py scripts/plot_returns.py --type "All Units"
    py scripts/plot_returns.py --type "All Houses" --show
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent.parent / "data" / "processed" / "sqm_all_postcodes.csv"
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "processed"


def strip_pct(series: pd.Series) -> pd.Series:
    """Strip trailing '%' and convert to float. Non-numeric (incl. comma-thousands) → NaN."""
    return pd.to_numeric(
        series.astype(str).str.replace("%", "", regex=False).str.strip(),
        errors="coerce",
    )


def load_and_clean(df: pd.DataFrame, property_type: str = "All Houses") -> pd.DataFrame:
    """Filter to property_type, convert pct columns to float, log and drop unparseable rows."""
    df = df[df["property_type"] == property_type].copy()
    for col in ("chg_10yr_pa_pct", "chg_12m_pct"):
        df[col] = strip_pct(df[col])

    null_mask = df["chg_10yr_pa_pct"].isna() | df["chg_12m_pct"].isna()
    for _, row in df[null_mask].iterrows():
        logger.warning(
            "Dropping row with unparseable pct: postcode=%s chg_10yr=%s chg_12m=%s",
            row["postcode"], row["chg_10yr_pa_pct"], row["chg_12m_pct"],
        )

    df = df[~null_mask].reset_index(drop=True)
    logger.info("Loaded %d rows for '%s' (dropped %d unparseable)", len(df), property_type, null_mask.sum())
    return df


def build_groups(df: pd.DataFrame) -> pd.DataFrame:
    """Round 10yr to 1dp, aggregate median 12m and postcode count per group."""
    df = df.copy()
    df["group_10yr"] = (df["chg_10yr_pa_pct"] * 10).round() / 10
    groups = (
        df.groupby("group_10yr", as_index=False)
        .agg(median_12m=("chg_12m_pct", "median"), count=("postcode", "count"))
        .sort_values("group_10yr")
    )
    return groups


def plot(groups: pd.DataFrame, property_type: str, output_path: Path, show: bool = False) -> None:
    """Scatter plot: x=10yr group, y=median 12m, bubble size=sqrt(postcode count)."""
    fig, ax = plt.subplots(figsize=(14, 8))

    scatter = ax.scatter(
        groups["group_10yr"],
        groups["median_12m"],
        s=(groups["count"] ** 0.5) * 30,   # sqrt scaling: perceptually honest bubble size
        c=groups["median_12m"],
        cmap="RdYlGn",
        alpha=0.75,
        edgecolors="grey",
        linewidths=0.4,
    )

    plt.colorbar(scatter, ax=ax, label="Median 12m % change")

    ax.axhline(0, color="black", linewidth=0.6, linestyle="--", alpha=0.5)
    ax.axvline(0, color="black", linewidth=0.6, linestyle="--", alpha=0.5)

    ax.set_xlabel("10-Year % pa Return Group (rounded to 1 dp)", fontsize=12)
    ax.set_ylabel("Median 12-Month % Change", fontsize=12)
    ax.set_title(
        f"SQM Asking Prices — 10yr Return vs 12m Change\n"
        f"Property type: {property_type} | Each bubble = 1dp group, size = postcode count",
        fontsize=13,
    )

    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    logger.info("Chart saved to %s", output_path)

    if show:
        plt.show()
    plt.close(fig)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser()
    parser.add_argument("--type", default="All Houses", dest="property_type",
                        help="Property type filter (default: All Houses)")
    parser.add_argument("--show", action="store_true", help="Open chart window")
    args = parser.parse_args()

    raw = pd.read_csv(DATA_FILE, dtype=str)
    df = load_and_clean(raw, property_type=args.property_type)

    groups = build_groups(df)
    logger.info("Built %d groups", len(groups))

    slug = args.property_type.lower().replace(" ", "_")
    output_path = OUTPUT_DIR / f"sqm_returns_chart_{slug}.png"
    plot(groups, args.property_type, output_path, show=args.show)


if __name__ == "__main__":
    main()
