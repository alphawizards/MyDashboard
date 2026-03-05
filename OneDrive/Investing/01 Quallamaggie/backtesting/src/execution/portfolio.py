import polars as pl

# Phase 5: Risk Sizing Constraints
# Translates the Rev4 Pine Script risk sizing logic into numerical limits.
PORTFOLIO_CONFIG = {
    "initial_capital": 100_000,
    "risk_per_trade_pct": 0.005,  # 0.5% risk per trade
    "max_pos_size_pct": 0.20,     # Max 20% of account in a single position
    "max_adr_stop": 1.0,          # Stop width must not exceed 1x ADR
    "max_open_positions": 10,     # Maximum concurrent open positions
}


def calculate_position_size(
    entry_price: float,
    stop_price: float,
    capital: float,
    adr: float | None = None,
    config: dict | None = None,
) -> dict:
    """
    Scalar position sizer — called per trade in the execution loop.

    Formula (backtestprep.md §3.3):
        risk_amount = capital * risk_per_trade_pct
        dist_to_stop = entry_price - stop_price
        shares = risk_amount / dist_to_stop
        max_shares = (capital * max_pos_size_pct) / entry_price
        final_shares = min(shares, max_shares)

    Returns:
        dict with keys: shares (int), risk_dollars (float), capital_required (float)
    """
    cfg = config or PORTFOLIO_CONFIG

    # Guard: stop must be below entry
    dist_to_stop = entry_price - stop_price
    if dist_to_stop <= 0:
        dist_to_stop = entry_price * 0.05  # fallback: 5% stop width

    risk_amount = capital * cfg["risk_per_trade_pct"]
    calc_shares = risk_amount / dist_to_stop
    max_shares = (capital * cfg["max_pos_size_pct"]) / entry_price

    final_shares = max(1, int(min(calc_shares, max_shares)))
    capital_required = final_shares * entry_price

    return {
        "shares": final_shares,
        "risk_dollars": final_shares * dist_to_stop,
        "capital_required": capital_required,
    }


def calculate_chandelier_exit(df: pl.DataFrame, atr_mult: float = 3.0) -> pl.DataFrame:
    """
    Phase 6: Trade Management Exits.
    Dynamic trailing stop derived from Highest High in lookback minus (ATR * Multiplier).

    Lookback scales by setup type (Pine Rev4 line 376):
        Flag (Setup A) = 20 bars
        HTF  (Setup B) = 30 bars
        EP   (Setup C) = 10 bars

    CRITICAL: All rolling windows MUST use .over("ticker") to prevent cross-ticker
    contamination on multi-ticker DataFrames.
    """
    # Build per-row lookback from setup_label (requires metrics to have set this column).
    # If setup_label is absent, default to 20 (Flag).
    if "setup_label" not in df.columns:
        df = df.with_columns(pl.lit("FLAG").alias("setup_label"))

    # Compute chandelier for each lookback tier, then select the correct one per row.
    # Polars does not support dynamic window sizes in a single expression, so we
    # compute all three tiers and pick via when/then.
    hh_20 = pl.col("high").rolling_max(window_size=20).over("ticker")
    hh_30 = pl.col("high").rolling_max(window_size=30).over("ticker")
    hh_10 = pl.col("high").rolling_max(window_size=10).over("ticker")

    highest_high = (
        pl.when(pl.col("setup_label") == "HTF").then(hh_30)
          .when(pl.col("setup_label") == "EP").then(hh_10)
          .otherwise(hh_20)
    )

    return df.with_columns(
        (highest_high - (pl.col("atr") * atr_mult)).alias("chandelier_exit")
    )
