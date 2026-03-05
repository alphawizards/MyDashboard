import argparse
import polars as pl
import sys
from pathlib import Path
from loguru import logger

# Add the project root to sys.path so we can import 'src'
sys.path.append(str(Path(__file__).parent.parent))

from src.data.ingestion import DataPipeline
from src.features.metrics import apply_all_features, apply_index_features
from src.strategy.rev4_rules import evaluate_setups
from src.execution.backtester import Backtester

# Index tickers required for regime filter and RS computation
INDEX_TICKERS = ["SPY", "QQQ"]

# Default cost sensitivity multipliers  (backtestprep.md §4.6)
DEFAULT_COST_MULTIPLIERS = [1.0, 2.0, 3.0]


def _run_single(
    equity_df: pl.DataFrame,
    initial_capital: float,
    cost_multiplier: float,
    oos_start_date: str | None,
) -> dict:
    """
    Run one backtest pass for a given cost multiplier and optional IS/OOS split.
    Returns a summary dict for the comparison table.
    """
    from src.analysis.tearsheet import generate_report

    bt = Backtester(initial_capital=initial_capital)

    if oos_start_date:
        # IS pass
        is_df = equity_df.filter(pl.col("date") < pl.lit(oos_start_date).str.to_date())
        oos_df = equity_df.filter(pl.col("date") >= pl.lit(oos_start_date).str.to_date())

        logger.info(f"IS period: {is_df['date'].min()} → {is_df['date'].max()} ({len(is_df)} rows)")
        logger.info(f"OOS period: {oos_df['date'].min()} → {oos_df['date'].max()} ({len(oos_df)} rows)")

        is_trades, is_equity = bt.run_vectorized(is_df, cost_multiplier=cost_multiplier)
        oos_bt = Backtester(initial_capital=initial_capital)
        oos_trades, oos_equity = oos_bt.run_vectorized(oos_df, cost_multiplier=cost_multiplier)

        logger.info("=== IN-SAMPLE TEARSHEET ===")
        is_metrics = generate_report(is_trades, is_equity, label="IN-SAMPLE")
        logger.info("=== OUT-OF-SAMPLE TEARSHEET ===")
        oos_metrics = generate_report(oos_trades, oos_equity, label="OUT-OF-SAMPLE")

        # Degradation analysis
        _print_oos_comparison(is_metrics, oos_metrics)

        return is_metrics

    else:
        trades, equity_curve = bt.run_vectorized(equity_df, cost_multiplier=cost_multiplier)
        metrics = generate_report(trades, equity_curve)
        return metrics


def _print_oos_comparison(is_metrics: dict, oos_metrics: dict) -> None:
    """Print IS vs OOS comparison table with degradation flags."""
    logger.info("=" * 60)
    logger.info("IS / OOS COMPARISON  (backtestprep.md §5.2)")
    logger.info("=" * 60)
    header = f"{'Metric':<22} {'In-Sample':>12} {'Out-of-Sample':>14} {'Degradation':>12}"
    logger.info(header)
    logger.info("-" * 62)

    metric_keys = [
        ("cagr_pct", "CAGR (%)"),
        ("sharpe", "Sharpe"),
        ("max_drawdown_pct", "Max DD (%)"),
        ("win_rate_pct", "Win Rate (%)"),
        ("profit_factor", "Profit Factor"),
    ]
    for key, label in metric_keys:
        is_val = is_metrics.get(key)
        oos_val = oos_metrics.get(key)
        if is_val is not None and oos_val is not None and is_val != 0:
            degradation = (oos_val - is_val) / abs(is_val) * 100
            flag = " ⚠ DEGRADE" if abs(degradation) > 50 else ""
            logger.info(f"{label:<22} {is_val:>12.2f} {oos_val:>14.2f} {degradation:>11.1f}%{flag}")

    # Sharpe degradation warning
    is_sharpe = is_metrics.get("sharpe", 0)
    oos_sharpe = oos_metrics.get("sharpe", 0)
    if is_sharpe > 0 and oos_sharpe < is_sharpe * 0.5:
        logger.warning(
            f"OOS Sharpe ({oos_sharpe:.2f}) < 50% of IS Sharpe ({is_sharpe:.2f}). "
            "Significant OOS degradation detected — possible overfitting."
        )


def _print_cost_sensitivity_table(results: list[dict]) -> None:
    """Print 1x/2x/3x cost sensitivity comparison table."""
    logger.info("=" * 65)
    logger.info("TRANSACTION COST SENSITIVITY  (backtestprep.md §4.6)")
    logger.info("=" * 65)
    header = f"{'Multiplier':>12} {'Net CAGR':>10} {'Net Sharpe':>11} {'Max DD':>10} {'Profit Factor':>14}"
    logger.info(header)
    logger.info("-" * 65)
    for r in results:
        mult = r.get("cost_multiplier", "?")
        cagr = r.get("cagr_pct", float("nan"))
        sharpe = r.get("sharpe", float("nan"))
        mdd = r.get("max_drawdown_pct", float("nan"))
        pf = r.get("profit_factor", float("nan"))
        logger.info(f"{mult:>11.1f}x {cagr:>10.2f}% {sharpe:>11.2f} {mdd:>10.2f}% {pf:>14.2f}")

    # Flag fragile strategy
    two_x = next((r for r in results if r.get("cost_multiplier") == 2.0), None)
    if two_x and two_x.get("cagr_pct", 1) <= 0:
        logger.warning("FRAGILE STRATEGY: Negative CAGR at 2x transaction costs.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Qullamaggie Rev4 Quant Backtester")
    parser.add_argument("--tickers", nargs="+", default=["TSLA", "NVDA", "AMD"],
                        help="List of equity tickers to backtest")
    parser.add_argument("--start", type=str, default="2020-01-01",
                        help="Start Date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default="2023-12-31",
                        help="End Date (YYYY-MM-DD)")
    parser.add_argument("--oos-start", type=str, default=None,
                        help="Start of Out-of-Sample period (YYYY-MM-DD). "
                             "Default: 70%% of date range.")
    parser.add_argument("--cost-multiplier", nargs="+", type=float,
                        default=DEFAULT_COST_MULTIPLIERS,
                        help="Cost sensitivity multipliers (default: 1.0 2.0 3.0)")
    parser.add_argument("--initial-capital", type=float, default=100_000.0,
                        help="Starting capital in USD (default: 100000)")
    args = parser.parse_args()

    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = BASE_DIR / "data"

    logger.info("=== QULLAMAGGIE REV4 SYSTEM INITIALIZATION ===")

    # ------------------------------------------------------------------
    # 1. Data Ingestion — equities + index benchmarks
    # ------------------------------------------------------------------
    pipeline = DataPipeline(DATA_DIR / "raw", DATA_DIR / "processed")

    all_tickers = list(set(args.tickers + INDEX_TICKERS))
    pipeline.ingest_daily_bars(all_tickers, args.start, args.end)

    try:
        df = pl.read_parquet(DATA_DIR / "processed" / "historical_bars.parquet")
        logger.success(f"Loaded {len(df)} rows from Parquet for backtesting.")
    except Exception as e:
        logger.error(f"Failed to load parquet data. Exiting: {e}")
        return

    # ------------------------------------------------------------------
    # 2. Split equities from index data
    # ------------------------------------------------------------------
    equity_df = df.filter(~pl.col("ticker").is_in(INDEX_TICKERS))
    index_df = df.filter(pl.col("ticker").is_in(INDEX_TICKERS))

    if len(equity_df) == 0:
        logger.error("No equity data after splitting index tickers.")
        return

    # ------------------------------------------------------------------
    # 3. Feature Engineering
    # ------------------------------------------------------------------
    logger.info("Applying vectorized features (Phase 1-4 metrics)...")
    equity_df = equity_df.sort(["ticker", "date"])
    equity_df = apply_all_features(equity_df)

    logger.info("Applying index features (regime, RS vs SPY)...")
    index_df = index_df.sort(["ticker", "date"])
    equity_df = apply_index_features(equity_df, index_df)

    # ------------------------------------------------------------------
    # Missing Data Policy  (backtestprep.md §2.6)
    # ------------------------------------------------------------------
    # Step 1: Forward-fill price columns per ticker.
    #   Rationale: a missing price bar means no trade occurred that day.
    #   Forward-filling simulates holding the last known price, consistent
    #   with "no trade" semantics and prevents calendar gaps from biasing returns.
    price_cols = ["open", "high", "low", "close", "volume"]
    available_price_cols = [c for c in price_cols if c in equity_df.columns]
    equity_df = equity_df.with_columns([
        pl.col(c).forward_fill().over("ticker") for c in available_price_cols
    ])

    # Step 2: Drop only rows where feature columns are null due to insufficient
    #   lookback history (requires >= 252 bars for 52-week high, >= 126 for 6m momentum).
    #   Log counts per ticker so the data loss is auditable.
    rows_before = len(equity_df)
    lookback_cols = ["high_52w", "perf_6m_raw", "atr", "bbw_rank"]
    available_lookback_cols = [c for c in lookback_cols if c in equity_df.columns]
    if available_lookback_cols:
        equity_df = equity_df.drop_nulls(subset=available_lookback_cols)
    rows_after = len(equity_df)
    rows_dropped = rows_before - rows_after
    if rows_dropped > 0:
        logger.info(
            f"Missing data policy: dropped {rows_dropped} rows "
            f"({rows_dropped / rows_before:.1%}) with insufficient lookback history "
            f"(< 252 bars for 52w high, < 126 bars for 6m momentum)."
        )

    # ------------------------------------------------------------------
    # 4. Strategy Rules (Dual Gates + Scoring)
    # ------------------------------------------------------------------
    logger.info("Evaluating Rev4 dual-gate strategy rules...")
    equity_df = evaluate_setups(equity_df)

    setup_a_count = equity_df.filter(pl.col('setup_a')).shape[0]
    setup_b_count = equity_df.filter(pl.col('setup_b')).shape[0]
    setup_c_count = equity_df.filter(pl.col('setup_c')).shape[0]
    logger.success(f"Discovered Setups — A: {setup_a_count}, B: {setup_b_count}, C: {setup_c_count}")

    # ------------------------------------------------------------------
    # 5. Derive OOS start date if not provided  (backtestprep.md §5.2)
    # ------------------------------------------------------------------
    oos_start = args.oos_start
    if oos_start is None and len(args.cost_multiplier) == 1:
        # Only auto-split when running a single cost pass (not sensitivity sweep)
        all_dates = sorted(equity_df["date"].unique().to_list())
        if len(all_dates) >= 10:
            split_idx = int(len(all_dates) * 0.70)
            oos_start = str(all_dates[split_idx])
            logger.info(f"Auto IS/OOS split at 70%: OOS starts {oos_start}")

    # ------------------------------------------------------------------
    # 6. Execution Simulator — cost sensitivity sweep
    # ------------------------------------------------------------------
    multipliers = args.cost_multiplier
    sensitivity_results: list[dict] = []

    for mult in multipliers:
        if len(multipliers) > 1:
            logger.info(f"--- Cost multiplier: {mult}x ---")
        metrics = _run_single(
            equity_df=equity_df,
            initial_capital=args.initial_capital,
            cost_multiplier=mult,
            oos_start_date=oos_start if len(multipliers) == 1 else None,
        )
        if metrics:
            metrics["cost_multiplier"] = mult
            sensitivity_results.append(metrics)

    if len(multipliers) > 1:
        _print_cost_sensitivity_table(sensitivity_results)

    logger.success("Rev4 backtest pipeline complete.")


if __name__ == "__main__":
    main()
