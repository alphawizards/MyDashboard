import argparse
import math
import polars as pl
import sys
from pathlib import Path
from loguru import logger

# Add the project root to sys.path so we can import 'src'
sys.path.append(str(Path(__file__).parent.parent))

from src.data.ingestion import DataPipeline
from src.features.metrics import apply_all_features, apply_index_features
from src.strategy.rev4_rules import PARAMS, TRIAL_COUNTER, evaluate_setups
from src.execution.backtester import Backtester
from src.analysis.ledger import append_to_ledger
from src.analysis.significance import deflated_sharpe_ratio
from src.analysis.visual_tearsheet import generate_visual_tearsheet
from src.analysis.trade_visualizer import generate_trade_visualizer
from src.analysis.factor_ic import generate_factor_ic_report

# Index tickers required for regime filter and RS computation
INDEX_TICKERS = ["SPY", "QQQ"]

# Default cost sensitivity multipliers  (backtestprep.md §4.6)
DEFAULT_COST_MULTIPLIERS = [1.0, 2.0, 3.0]


def _run_single(
    equity_df: pl.DataFrame,
    initial_capital: float,
    cost_multiplier: float,
    oos_start_date: str | None,
    min_score: int | None = 6,
    max_holding_days: int | None = 20,
) -> tuple[dict, pl.DataFrame, pl.DataFrame]:
    """
    Run one backtest pass for a given cost multiplier and optional IS/OOS split.
    Returns (metrics, trade_log, equity_curve) — equity_curve covers the IS
    period (or full period when no split) and is used downstream for the
    visual tearsheet's sensitivity overlay.
    """
    from src.analysis.tearsheet import generate_report

    bt = Backtester(
        initial_capital=initial_capital,
        min_score=min_score,
        max_holding_days=max_holding_days,
    )

    if oos_start_date:
        # IS pass
        is_df = equity_df.filter(pl.col("date") < pl.lit(oos_start_date).str.to_date())
        oos_df = equity_df.filter(pl.col("date") >= pl.lit(oos_start_date).str.to_date())

        logger.info(f"IS period: {is_df['date'].min()} → {is_df['date'].max()} ({len(is_df)} rows)")
        logger.info(f"OOS period: {oos_df['date'].min()} → {oos_df['date'].max()} ({len(oos_df)} rows)")

        is_trades, is_equity = bt.run_vectorized(is_df, cost_multiplier=cost_multiplier)
        oos_bt = Backtester(
            initial_capital=initial_capital,
            min_score=min_score,
            max_holding_days=max_holding_days,
        )
        oos_trades, oos_equity = oos_bt.run_vectorized(oos_df, cost_multiplier=cost_multiplier)

        logger.info("=== IN-SAMPLE TEARSHEET ===")
        is_metrics = generate_report(is_trades, is_equity, label="IN-SAMPLE")
        logger.info("=== OUT-OF-SAMPLE TEARSHEET ===")
        oos_metrics = generate_report(oos_trades, oos_equity, label="OUT-OF-SAMPLE")

        # Degradation analysis
        _print_oos_comparison(is_metrics, oos_metrics)

        return is_metrics, is_trades, is_equity

    else:
        trades, equity_curve = bt.run_vectorized(equity_df, cost_multiplier=cost_multiplier)
        metrics = generate_report(trades, equity_curve)
        return metrics, trades, equity_curve


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


def _run_walk_forward(
    equity_df: pl.DataFrame,
    initial_capital: float,
    cost_multiplier: float = 1.0,
    is_months: int = 24,
    oos_months: int = 6,
) -> tuple[dict, pl.DataFrame, pl.DataFrame]:
    """
    Walk-forward validation: rolling IS/OOS windows concatenated into a single
    out-of-sample equity curve.

    Window schedule:
        IS  window = is_months  trading months (~21 bars/month)
        OOS window = oos_months trading months
        Step = oos_months (non-overlapping OOS periods)

    Returns (summary_metrics, concatenated_oos_trades, concatenated_oos_equity).
    summary_metrics includes per-window Sharpe and the grand OOS Sharpe.
    """
    from src.analysis.tearsheet import generate_report

    all_dates = sorted(equity_df["date"].unique().to_list())
    n_dates = len(all_dates)

    is_bars  = is_months  * 21   # approximate trading days
    oos_bars = oos_months * 21

    if n_dates < is_bars + oos_bars:
        logger.warning(
            f"Walk-forward requires >= {is_bars + oos_bars} trading days; "
            f"only {n_dates} available. Skipping."
        )
        return {}, pl.DataFrame(), pl.DataFrame()

    all_oos_trades:  list[pl.DataFrame] = []
    all_oos_equity:  list[pl.DataFrame] = []
    window_results:  list[dict]         = []

    start_idx = 0
    window_num = 0

    while start_idx + is_bars + oos_bars <= n_dates:
        window_num += 1

        is_end_idx  = start_idx + is_bars
        oos_end_idx = is_end_idx + oos_bars

        is_start_date  = all_dates[start_idx]
        is_end_date    = all_dates[is_end_idx - 1]
        oos_start_date = all_dates[is_end_idx]
        oos_end_date   = all_dates[min(oos_end_idx - 1, n_dates - 1)]

        is_df  = equity_df.filter(
            (pl.col("date") >= is_start_date) & (pl.col("date") <= is_end_date)
        )
        oos_df = equity_df.filter(
            (pl.col("date") >= oos_start_date) & (pl.col("date") <= oos_end_date)
        )

        logger.info(
            f"WF Window {window_num}: IS [{is_start_date} → {is_end_date}] | "
            f"OOS [{oos_start_date} → {oos_end_date}]"
        )

        # IS run (for reference only — OOS is what we aggregate)
        bt_is = Backtester(initial_capital=initial_capital)
        _, _ = bt_is.run_vectorized(is_df, cost_multiplier=cost_multiplier)

        # OOS run — fresh capital each window (avoids cross-window compounding bias)
        bt_oos = Backtester(initial_capital=initial_capital)
        oos_trades, oos_equity = bt_oos.run_vectorized(oos_df, cost_multiplier=cost_multiplier)

        if len(oos_trades) > 0:
            wf_metrics = generate_report(oos_trades, oos_equity, label=f"WF-OOS-W{window_num}")
            wf_metrics["window"] = window_num
            wf_metrics["oos_start"] = str(oos_start_date)
            wf_metrics["oos_end"]   = str(oos_end_date)
            window_results.append(wf_metrics)
            all_oos_trades.append(oos_trades)
            all_oos_equity.append(oos_equity)
        else:
            logger.warning(f"WF Window {window_num}: no OOS trades generated.")

        # Step forward by one OOS window
        start_idx += oos_bars

    if not window_results:
        logger.warning("Walk-forward: no OOS windows produced trades.")
        return {}, pl.DataFrame(), pl.DataFrame()

    # ------------------------------------------------------------------
    # Aggregate across all OOS windows
    # ------------------------------------------------------------------
    combined_trades = pl.concat(all_oos_trades)
    combined_equity = pl.concat(all_oos_equity).sort("date")

    logger.info("=" * 65)
    logger.info(f"WALK-FORWARD SUMMARY  ({window_num} windows, {is_months}m IS / {oos_months}m OOS)")
    logger.info("=" * 65)
    header = f"{'Window':>8} {'OOS Start':>12} {'OOS End':>12} {'CAGR':>8} {'Sharpe':>8} {'WR%':>7} {'PF':>7}"
    logger.info(header)
    logger.info("-" * 65)
    sharpes = []
    for w in window_results:
        cagr   = w.get("cagr_pct", float("nan"))
        sharpe = w.get("sharpe", float("nan"))
        wr     = w.get("win_rate_pct", float("nan"))
        pf     = w.get("profit_factor", float("nan"))
        logger.info(
            f"{w['window']:>8}  {w['oos_start']:>12}  {w['oos_end']:>12} "
            f"{cagr:>7.1f}% {sharpe:>8.2f} {wr:>6.1f}% {pf:>7.2f}"
        )
        if not (sharpe != sharpe):  # exclude NaN
            sharpes.append(sharpe)

    # Positive-Sharpe window hit rate
    n_positive = sum(1 for s in sharpes if s > 0)
    logger.info("-" * 65)
    if sharpes:
        logger.info(
            f"Positive-Sharpe windows: {n_positive}/{len(sharpes)} "
            f"({n_positive / len(sharpes) * 100:.0f}%)"
        )
    else:
        logger.warning(
            "No windows produced enough trades to compute Sharpe. "
            "Consider relaxing --min-score or expanding the ticker universe."
        )
        n_positive = 0

    # Grand OOS metrics over all concatenated trades
    grand_metrics = generate_report(combined_trades, combined_equity, label="WF-GRAND-OOS")
    grand_metrics["wf_windows"] = window_num
    grand_metrics["wf_positive_windows"] = n_positive
    grand_metrics["wf_window_results"] = window_results

    return grand_metrics, combined_trades, combined_equity


def main() -> None:
    parser = argparse.ArgumentParser(description="Qullamaggie Rev4 Quant Backtester")
    parser.add_argument("--tickers", nargs="+", default=None,
                        help="Explicit ticker list. Omit to use full universe from parquet.")
    parser.add_argument("--start", type=str, default="2016-01-01",
                        help="Start Date filter (YYYY-MM-DD). Applied after parquet load.")
    parser.add_argument("--end", type=str, default="2026-12-31",
                        help="End Date filter (YYYY-MM-DD). Applied after parquet load.")
    parser.add_argument("--oos-start", type=str, default=None,
                        help="Start of Out-of-Sample period (YYYY-MM-DD). "
                             "Default: 70%% of date range.")
    parser.add_argument("--cost-multiplier", nargs="+", type=float,
                        default=DEFAULT_COST_MULTIPLIERS,
                        help="Cost sensitivity multipliers (default: 1.0 2.0 3.0)")
    parser.add_argument("--initial-capital", type=float, default=100_000.0,
                        help="Starting capital in USD (default: 100000)")
    parser.add_argument("--fetch", action="store_true",
                        help="Force re-fetch from Alpaca API even if parquet exists. "
                             "Without this flag, existing parquet is loaded directly.")
    parser.add_argument("--output", type=str, default=None,
                        help="Output path for the visual tearsheet PDF "
                             "(default: backtesting/tearsheet_<label>.pdf)")
    parser.add_argument("--no-visual", action="store_true",
                        help="Skip PDF tearsheet generation (text metrics only).")
    parser.add_argument("--no-trade-viz", action="store_true",
                        help="Skip trade-level visualizer PDF (annotated charts, MAE/MFE, etc.).")
    parser.add_argument("--max-trade-charts", type=int, default=20,
                        help="Maximum annotated trade charts to render (default: 20).")
    parser.add_argument("--walk-forward", action="store_true",
                        help="Run rolling walk-forward validation (24m IS / 6m OOS) "
                             "in addition to static IS/OOS split.")
    parser.add_argument("--factor-ic", action="store_true",
                        help="Run cross-sectional Factor IC analysis and emit "
                             "factor_ic.pdf. Computes Spearman IC for all Rev4 metrics "
                             "vs 5/10/20-day forward returns on universe-qualified rows.")
    parser.add_argument("--min-score", type=int, default=6,
                        help="Minimum conviction score required for entry (default: 6). "
                             "Set 0 to disable.")
    parser.add_argument("--time-stop", type=int, default=20,
                        help="Maximum holding period in trading days (default: 20). "
                             "Set 0 to disable.")
    args = parser.parse_args()

    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = BASE_DIR / "data"
    PARQUET_PATH = DATA_DIR / "processed" / "historical_bars.parquet"

    logger.info("=== QULLAMAGGIE REV4 SYSTEM INITIALIZATION ===")

    # ------------------------------------------------------------------
    # 1. Data Ingestion — use existing parquet or fetch from Alpaca
    # ------------------------------------------------------------------
    if args.fetch or not PARQUET_PATH.exists():
        # Only hit the API when explicitly requested or no local data exists.
        pipeline = DataPipeline(DATA_DIR / "raw", DATA_DIR / "processed")
        fetch_tickers = list(set((args.tickers or ["TSLA", "NVDA", "AMD"]) + INDEX_TICKERS))
        logger.info(f"Fetching {len(fetch_tickers)} tickers from Alpaca API...")
        pipeline.ingest_daily_bars(fetch_tickers, args.start, args.end)
    else:
        logger.info(f"Using existing parquet: {PARQUET_PATH}")

    try:
        df = pl.read_parquet(PARQUET_PATH)
        logger.success(f"Loaded {len(df):,} rows from Parquet.")
    except Exception as e:
        logger.error(f"Failed to load parquet data. Exiting: {e}")
        return

    # ------------------------------------------------------------------
    # 1b. Apply date range filter
    # ------------------------------------------------------------------
    df = df.with_columns(pl.col("date").cast(pl.Date))
    df = df.filter(
        (pl.col("date") >= pl.lit(args.start).str.to_date()) &
        (pl.col("date") <= pl.lit(args.end).str.to_date())
    )
    logger.info(
        f"Date filter [{args.start} → {args.end}]: {len(df):,} rows retained."
    )

    # ------------------------------------------------------------------
    # 1c. Apply ticker filter (optional — default is full universe)
    # ------------------------------------------------------------------
    if args.tickers:
        # Ensure index tickers are always included for regime filter / RS
        keep = list(set(args.tickers + INDEX_TICKERS))
        df = df.filter(pl.col("ticker").is_in(keep))
        logger.info(f"Ticker filter: restricted to {len(keep)} tickers ({len(df):,} rows).")
    else:
        logger.info(
            f"Full universe mode: {df['ticker'].n_unique():,} tickers loaded. "
            f"Strategy gates will screen to qualified names."
        )

    # ------------------------------------------------------------------
    # 2. Split equities from index data
    # ------------------------------------------------------------------
    equity_df = df.filter(~pl.col("ticker").is_in(INDEX_TICKERS))
    index_df = df.filter(pl.col("ticker").is_in(INDEX_TICKERS))

    if len(equity_df) == 0:
        logger.error("No equity data after splitting index tickers.")
        return

    logger.info(
        f"Universe: {equity_df['ticker'].n_unique():,} equities, "
        f"{index_df['ticker'].n_unique()} index benchmarks."
    )

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
    # 4b. Factor IC Analysis (optional)  -- runs on full date range for
    #     maximum statistical power before the IS/OOS split is applied.
    # ------------------------------------------------------------------
    if args.factor_ic:
        ic_output = BASE_DIR / "factor_ic.pdf"
        try:
            generate_factor_ic_report(
                df=equity_df,
                output_path=ic_output,
                filter_col="pass_universe",
            )
        except Exception as exc:
            logger.error(f"Factor IC analysis failed: {exc}")

    # ------------------------------------------------------------------
    # 5. Derive OOS start date if not provided  (backtestprep.md §5.2)
    # ------------------------------------------------------------------
    # IS/OOS split is ALWAYS applied.  For cost sensitivity sweeps each
    # multiplier runs with the same IS/OOS boundary so the comparison is
    # apples-to-apples.
    oos_start = args.oos_start
    if oos_start is None:
        all_dates = sorted(equity_df["date"].unique().to_list())
        if len(all_dates) >= 10:
            split_idx = int(len(all_dates) * 0.70)
            oos_start = str(all_dates[split_idx])
            logger.info(f"Auto IS/OOS split at 70%: OOS starts {oos_start}")
        else:
            logger.warning("Fewer than 10 unique dates — IS/OOS split skipped.")

    # ------------------------------------------------------------------
    # 6. Execution Simulator — cost sensitivity sweep with IS/OOS
    # ------------------------------------------------------------------
    multipliers = args.cost_multiplier
    sensitivity_results: list[dict] = []
    # Equity curves per multiplier for cost-sensitivity overlay on the tearsheet
    sensitivity_curves: dict[float, tuple[list, list[float]]] = {}

    primary_trade_log: pl.DataFrame | None = None
    primary_equity_curve: pl.DataFrame | None = None
    primary_metrics: dict = {}

    min_score_arg    = args.min_score    if args.min_score    > 0 else None
    time_stop_arg    = args.time_stop    if args.time_stop    > 0 else None

    logger.info(
        f"Entry gates — min_score: {min_score_arg}, "
        f"max_holding_days: {time_stop_arg}, "
        f"vol_surge: strict (1.2x)"
    )

    for mult in multipliers:
        if len(multipliers) > 1:
            logger.info(f"--- Cost multiplier: {mult}x ---")
        metrics, trade_log, equity_curve = _run_single(
            equity_df=equity_df,
            initial_capital=args.initial_capital,
            cost_multiplier=mult,
            oos_start_date=oos_start,
            min_score=min_score_arg,
            max_holding_days=time_stop_arg,
        )
        if metrics:
            metrics["cost_multiplier"] = mult
            sensitivity_results.append(metrics)

        # Collect equity curve for cost-sensitivity overlay
        if equity_curve is not None and len(equity_curve) > 0 and "date" in equity_curve.columns:
            sensitivity_curves[mult] = (
                equity_curve["date"].to_list(),
                equity_curve["equity"].to_list(),
            )

        # Keep 1x run (or first run) as the primary for the main tearsheet panels
        if mult == 1.0 or primary_trade_log is None:
            primary_trade_log = trade_log
            primary_equity_curve = equity_curve
            primary_metrics = metrics

    if len(multipliers) > 1:
        _print_cost_sensitivity_table(sensitivity_results)

    # ------------------------------------------------------------------
    # 7. Visual Tearsheet (PDF)  — all 10 panels
    # ------------------------------------------------------------------
    if not args.no_visual and primary_trade_log is not None:
        ts_label = "IN-SAMPLE" if oos_start else "FULL_PERIOD"
        default_output = BASE_DIR / f"tearsheet_{ts_label}.pdf"
        output_path = Path(args.output) if args.output else default_output

        try:
            generate_visual_tearsheet(
                trade_log=primary_trade_log,
                equity_curve=primary_equity_curve,
                metrics=primary_metrics,
                output_path=output_path,
                initial_capital=args.initial_capital,
                oos_start_date=oos_start,
                label=ts_label,
                sensitivity_curves=sensitivity_curves if len(sensitivity_curves) > 1 else None,
                n_trials=len(multipliers),
            )
        except Exception as exc:
            logger.error(f"Visual tearsheet generation failed: {exc}")

    # ------------------------------------------------------------------
    # 7b. Trade-Level Visualizer (PDF) — annotated charts + diagnostics
    # ------------------------------------------------------------------
    if not args.no_visual and not args.no_trade_viz and primary_trade_log is not None and len(primary_trade_log) > 0:
        tv_label = "IN-SAMPLE" if oos_start else "FULL_PERIOD"
        tv_output = BASE_DIR / f"trade_visualizer_{tv_label}.pdf"

        try:
            generate_trade_visualizer(
                trade_log=primary_trade_log,
                ohlcv_data=equity_df,
                output_path=tv_output,
                max_annotated_charts=args.max_trade_charts,
                max_holding_days=time_stop_arg or 20,
            )
        except Exception as exc:
            logger.error(f"Trade visualizer generation failed: {exc}")

    # ------------------------------------------------------------------
    # 8. Walk-Forward Validation (optional)
    # ------------------------------------------------------------------
    if args.walk_forward:
        logger.info("=== WALK-FORWARD VALIDATION (24m IS / 6m OOS) ===")
        wf_metrics, wf_trades, wf_equity = _run_walk_forward(
            equity_df=equity_df,
            initial_capital=args.initial_capital,
            cost_multiplier=1.0,           # always 1x for WF to isolate strategy signal
        )

        if not args.no_visual and len(wf_trades) > 0:
            wf_output = BASE_DIR / "tearsheet_WALK_FORWARD.pdf"
            try:
                generate_visual_tearsheet(
                    trade_log=wf_trades,
                    equity_curve=wf_equity,
                    metrics=wf_metrics,
                    output_path=wf_output,
                    initial_capital=args.initial_capital,
                    oos_start_date=None,
                    label="WALK-FORWARD OOS",
                    sensitivity_curves=None,
                    n_trials=len(multipliers),
                )
            except Exception as exc:
                logger.error(f"Walk-forward tearsheet generation failed: {exc}")

    # ------------------------------------------------------------------
    # 9. Experiment Ledger — append-only trial record
    # ------------------------------------------------------------------
    dsr_passed: bool | None = None
    if primary_metrics and primary_equity_curve is not None and len(primary_equity_curve) > 0:
        sr   = primary_metrics.get("sharpe")
        skew = primary_metrics.get("skewness")
        kurt = primary_metrics.get("kurtosis")
        T    = len(primary_equity_curve)

        def _finite(v: object) -> bool:
            try:
                return v is not None and math.isfinite(float(v))  # type: ignore[arg-type]
            except (TypeError, ValueError):
                return False

        if _finite(sr) and _finite(skew) and _finite(kurt) and T > 1:
            dsr_result = deflated_sharpe_ratio(
                observed_sr=float(sr),        # type: ignore[arg-type]
                n_trials=TRIAL_COUNTER,
                T=T,
                skew=float(skew),             # type: ignore[arg-type]
                excess_kurtosis=float(kurt),  # type: ignore[arg-type]
            )
            dsr_passed = dsr_result.get("passes")
            logger.info(
                f"DSR: {dsr_result.get('dsr', float('nan')):.4f}  "
                f"(p={dsr_result.get('p_value', float('nan')):.4f}, "
                f"n_trials={TRIAL_COUNTER})  passes={dsr_passed}"
            )

    append_to_ledger(
        params=PARAMS,
        metrics=primary_metrics,
        trial_number=TRIAL_COUNTER,
        ledger_path=BASE_DIR / "backtest_ledger.csv",
        dsr_passed=dsr_passed,
        run_label="IN-SAMPLE" if oos_start else "FULL_PERIOD",
    )

    logger.success("Rev4 backtest pipeline complete.")


if __name__ == "__main__":
    main()
