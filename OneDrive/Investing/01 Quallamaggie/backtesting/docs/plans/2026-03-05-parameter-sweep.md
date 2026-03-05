# Parameter Sweep Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `backtesting/scripts/run_sweep.py` — a 54-trial focused grid search over setup quality and universe filter parameters, logging every result to `backtest_ledger.csv` with DSR-honest trial counting.

**Architecture:** Data pipeline (load + feature engineering) executes once. Each of 54 parameter variants re-runs only `evaluate_setups()` + `Backtester.run_vectorized()`. Results appended via `append_to_ledger()`. Final ranked summary saved to `sweep_results.csv` and printed to terminal.

**Tech Stack:** Python 3.11+, Polars ≥1.0, loguru, itertools, existing `src/` modules (`rev4_rules`, `backtester`, `tearsheet`, `ledger`, `significance`).

---

### Task 1: Scaffold run_sweep.py with grid variant generator + tests

**Files:**
- Create: `backtesting/scripts/run_sweep.py`
- Create: `backtesting/tests/test_sweep.py`

**Step 1: Write the failing tests**

Create `backtesting/tests/test_sweep.py`:

```python
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from scripts.run_sweep import _generate_grid_variants

BASELINE = {
    "min_price": 5.0,
    "min_dol_vol": 10.0,
    "min_adr": 3.0,
    "max_pullback": 25.0,
    "bbw_percentile": 50.0,
    "min_prior_move": 30.0,
    "mom_threshold_1m": 20.0,   # non-grid param — must be preserved
}

GRID_A = {
    "max_pullback":   [15.0, 25.0, 35.0],
    "bbw_percentile": [35.0, 50.0, 65.0],
    "min_prior_move": [20.0, 30.0, 40.0],
}


def test_generate_grid_count():
    """3x3x3 grid produces exactly 27 variants."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    assert len(variants) == 27


def test_generate_grid_baseline_match_label():
    """Exactly one variant matches baseline values and is labeled BASELINE_MATCH."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    matches = [(label, p) for label, p in variants if "BASELINE_MATCH" in label]
    assert len(matches) == 1
    _, params = matches[0]
    assert params["max_pullback"] == 25.0
    assert params["bbw_percentile"] == 50.0
    assert params["min_prior_move"] == 30.0


def test_generate_grid_non_grid_params_preserved():
    """Parameters not in the grid are passed through unchanged from baseline."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    for label, p in variants:
        assert p["mom_threshold_1m"] == 20.0, f"Non-grid param mutated in: {label}"


def test_generate_grid_values_injected():
    """All three values for each grid parameter appear across variants."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    pullback_values = {p["max_pullback"] for _, p in variants}
    bbw_values = {p["bbw_percentile"] for _, p in variants}
    prior_values = {p["min_prior_move"] for _, p in variants}
    assert pullback_values == {15.0, 25.0, 35.0}
    assert bbw_values == {35.0, 50.0, 65.0}
    assert prior_values == {20.0, 30.0, 40.0}


def test_label_format():
    """Every label contains key=value pairs for each grid parameter."""
    variants = _generate_grid_variants(BASELINE, GRID_A)
    for label, p in variants:
        assert "max_pullback=" in label
        assert "bbw_percentile=" in label
        assert "min_prior_move=" in label
```

**Step 2: Run test to verify it fails**

```bash
cd backtesting && python -m pytest tests/test_sweep.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.run_sweep'`

**Step 3: Implement `_generate_grid_variants` in run_sweep.py**

Create `backtesting/scripts/run_sweep.py`:

```python
"""
Rev4 Focused Grid Search Sweep
==============================
Design: docs/plans/2026-03-05-parameter-sweep-design.md

Runs Cartesian-product grid search over two parameter groups.
Data pipeline executes once; evaluate_setups + backtester re-run per variant.
All results appended to backtest_ledger.csv via append_to_ledger().
"""

import argparse
import itertools
import math
import sys
from pathlib import Path
from typing import Any

import polars as pl
from loguru import logger

sys.path.append(str(Path(__file__).parent.parent))

from src.strategy.rev4_rules import PARAMS, TRIAL_COUNTER

# ------------------------------------------------------------------
# Grid definitions — edit values here to change sweep scope
# ------------------------------------------------------------------
GROUP_A_GRID: dict[str, list[Any]] = {
    "max_pullback":   [15.0, 25.0, 35.0],   # baseline = 25.0
    "bbw_percentile": [35.0, 50.0, 65.0],   # baseline = 50.0
    "min_prior_move": [20.0, 30.0, 40.0],   # baseline = 30.0
}

GROUP_B_GRID: dict[str, list[Any]] = {
    "min_price":   [3.0,  5.0, 10.0],    # baseline = 5.0
    "min_dol_vol": [5.0, 10.0, 20.0],    # baseline = 10.0
    "min_adr":     [2.0,  3.0,  5.0],    # baseline = 3.0
}


def _is_finite(v: object) -> bool:
    """True if v is a non-None, finite number."""
    try:
        return v is not None and math.isfinite(float(v))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return False


def _generate_grid_variants(
    baseline: dict[str, Any],
    grid: dict[str, list[Any]],
) -> list[tuple[str, dict[str, Any]]]:
    """
    Cartesian product over `grid` values; all other params from `baseline`.

    Returns list of (label, params_dict).
    The variant that matches baseline values for all grid params is labeled
    with a "BASELINE_MATCH | ..." prefix.
    """
    param_names = list(grid.keys())
    value_lists = [grid[k] for k in param_names]

    variants: list[tuple[str, dict[str, Any]]] = []
    for combo in itertools.product(*value_lists):
        variant = dict(baseline)
        parts: list[str] = []
        for name, val in zip(param_names, combo):
            variant[name] = val
            parts.append(f"{name}={val}")

        is_baseline = all(baseline.get(k) == v for k, v in zip(param_names, combo))
        label = ("BASELINE_MATCH | " if is_baseline else "") + " | ".join(parts)
        variants.append((label, variant))

    return variants
```

**Step 4: Run tests to verify they pass**

```bash
cd backtesting && python -m pytest tests/test_sweep.py -v
```

Expected: `5 passed`

**Step 5: Commit**

```bash
git add backtesting/scripts/run_sweep.py backtesting/tests/test_sweep.py
git commit -m "feat: scaffold run_sweep.py with grid variant generator and tests"
```

---

### Task 2: Add single variant runner

**Files:**
- Modify: `backtesting/scripts/run_sweep.py`

**Step 1: Write failing test (smoke test only — full pipeline requires data)**

Add to `backtesting/tests/test_sweep.py`:

```python
from scripts.run_sweep import _run_sweep_variant


def test_run_sweep_variant_signature():
    """_run_sweep_variant is importable and has expected signature."""
    import inspect
    sig = inspect.signature(_run_sweep_variant)
    params = list(sig.parameters.keys())
    assert "equity_df" in params
    assert "oos_start" in params
    assert "params" in params
    assert "initial_capital" in params
```

**Step 2: Run test to verify it fails**

```bash
cd backtesting && python -m pytest tests/test_sweep.py::test_run_sweep_variant_signature -v
```

Expected: `ImportError` — `_run_sweep_variant` not yet defined

**Step 3: Implement `_run_sweep_variant`**

Append to `backtesting/scripts/run_sweep.py` (after the grid definitions):

```python
from src.strategy.rev4_rules import evaluate_setups
from src.execution.backtester import Backtester
from src.analysis.tearsheet import generate_report


def _run_sweep_variant(
    equity_df: pl.DataFrame,
    oos_start: str | None,
    params: dict[str, Any],
    initial_capital: float,
    min_score: int | None,
    max_holding_days: int | None,
    cost_multiplier: float = 1.0,
) -> tuple[dict[str, Any], pl.DataFrame]:
    """
    Runs evaluate_setups + IS backtester for one parameter variant.

    Returns (metrics_dict, is_equity_curve).
    metrics_dict is empty {} if no trades were generated.
    """
    sweep_df = evaluate_setups(equity_df, params=params)

    if oos_start:
        is_df = sweep_df.filter(
            pl.col("date") < pl.lit(oos_start).str.to_date()
        )
    else:
        is_df = sweep_df

    bt = Backtester(
        initial_capital=initial_capital,
        min_score=min_score,
        max_holding_days=max_holding_days,
    )
    trades, equity_curve = bt.run_vectorized(is_df, cost_multiplier=cost_multiplier)

    if len(trades) == 0:
        return {}, equity_curve

    metrics = generate_report(trades, equity_curve, initial_capital=initial_capital)
    return metrics, equity_curve
```

**Step 4: Run tests to verify they pass**

```bash
cd backtesting && python -m pytest tests/test_sweep.py -v
```

Expected: `6 passed`

**Step 5: Commit**

```bash
git add backtesting/scripts/run_sweep.py backtesting/tests/test_sweep.py
git commit -m "feat: add _run_sweep_variant to run_sweep.py"
```

---

### Task 3: Add main() — data pipeline + sweep loop + DSR + ledger

**Files:**
- Modify: `backtesting/scripts/run_sweep.py`

**Step 3: Append `main()` to run_sweep.py**

```python
from src.data.ingestion import DataPipeline
from src.features.metrics import apply_all_features, apply_index_features
from src.analysis.ledger import append_to_ledger
from src.analysis.significance import deflated_sharpe_ratio

INDEX_TICKERS = ["SPY", "QQQ"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Rev4 Focused Grid Search Sweep")
    parser.add_argument("--start",            type=str,   default="2016-01-01")
    parser.add_argument("--end",              type=str,   default="2026-12-31")
    parser.add_argument("--oos-start",        type=str,   default=None)
    parser.add_argument("--initial-capital",  type=float, default=100_000.0)
    parser.add_argument("--min-score",        type=int,   default=6)
    parser.add_argument("--time-stop",        type=int,   default=20)
    parser.add_argument(
        "--group", choices=["A", "B", "all"], default="all",
        help="Which grid group to run: A (setup quality), B (universe filters), all",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print all variants without executing backtests.",
    )
    args = parser.parse_args()

    BASE_DIR    = Path(__file__).parent.parent
    PARQUET_PATH = BASE_DIR / "data" / "processed" / "historical_bars.parquet"
    LEDGER_PATH  = BASE_DIR / "backtest_ledger.csv"

    # ------------------------------------------------------------------
    # 1. Assemble variant list
    # ------------------------------------------------------------------
    grids: list[tuple[str, dict[str, list[Any]]]] = []
    if args.group in ("A", "all"):
        grids.append(("A", GROUP_A_GRID))
    if args.group in ("B", "all"):
        grids.append(("B", GROUP_B_GRID))

    all_variants: list[tuple[str, str, dict[str, Any]]] = []
    for group_name, grid in grids:
        for label, params in _generate_grid_variants(PARAMS, grid):
            all_variants.append((group_name, label, params))

    total_variants      = len(all_variants)
    final_trial_counter = TRIAL_COUNTER + total_variants

    logger.info(f"Sweep: {total_variants} variants | groups: {[g for g, _ in grids]}")
    logger.info(f"TRIAL_COUNTER will advance: {TRIAL_COUNTER} → {final_trial_counter}")

    if args.dry_run:
        for i, (group, label, _) in enumerate(all_variants, start=1):
            logger.info(f"  [{i:>3}/{total_variants}] Group {group}: {label}")
        logger.info("Dry run complete — no backtests executed.")
        return

    # ------------------------------------------------------------------
    # 2. Load data — once
    # ------------------------------------------------------------------
    try:
        df = pl.read_parquet(PARQUET_PATH)
        logger.success(f"Loaded {len(df):,} rows from parquet.")
    except Exception as exc:
        logger.error(f"Failed to load parquet: {exc}")
        return

    df = df.with_columns(pl.col("date").cast(pl.Date))
    df = df.filter(
        (pl.col("date") >= pl.lit(args.start).str.to_date()) &
        (pl.col("date") <= pl.lit(args.end).str.to_date())
    )

    equity_df = df.filter(~pl.col("ticker").is_in(INDEX_TICKERS))
    index_df  = df.filter( pl.col("ticker").is_in(INDEX_TICKERS))

    if len(equity_df) == 0:
        logger.error("No equity data after index split.")
        return

    # ------------------------------------------------------------------
    # 3. Feature engineering — once
    # ------------------------------------------------------------------
    logger.info("Applying features (runs once for all variants)...")
    equity_df = equity_df.sort(["ticker", "date"])
    equity_df = apply_all_features(equity_df)
    index_df  = index_df.sort(["ticker", "date"])
    equity_df = apply_index_features(equity_df, index_df)

    price_cols = [c for c in ["open", "high", "low", "close", "volume"]
                  if c in equity_df.columns]
    equity_df = equity_df.with_columns([
        pl.col(c).forward_fill().over("ticker") for c in price_cols
    ])

    lookback_cols = [c for c in ["high_52w", "perf_6m_raw", "atr", "bbw_rank"]
                     if c in equity_df.columns]
    if lookback_cols:
        equity_df = equity_df.drop_nulls(subset=lookback_cols)

    logger.success(f"Feature engineering complete: {len(equity_df):,} rows.")

    # ------------------------------------------------------------------
    # 4. IS/OOS split — once
    # ------------------------------------------------------------------
    oos_start = args.oos_start
    if oos_start is None:
        all_dates = sorted(equity_df["date"].unique().to_list())
        if len(all_dates) >= 10:
            split_idx = int(len(all_dates) * 0.70)
            oos_start = str(all_dates[split_idx])
            logger.info(f"Auto IS/OOS split at 70%: OOS starts {oos_start}")

    min_score_arg = args.min_score if args.min_score > 0 else None
    time_stop_arg = args.time_stop if args.time_stop > 0 else None

    # ------------------------------------------------------------------
    # 5. Sweep loop
    # ------------------------------------------------------------------
    sweep_records: list[dict[str, Any]] = []
    grid_param_keys = list(GROUP_A_GRID.keys()) + list(GROUP_B_GRID.keys())

    for idx, (group_name, label, variant_params) in enumerate(all_variants, start=1):
        trial_num = TRIAL_COUNTER + idx
        logger.info(
            f"[{idx:>3}/{total_variants}] Trial #{trial_num}  "
            f"Group {group_name}: {label}"
        )

        try:
            metrics, equity_curve = _run_sweep_variant(
                equity_df=equity_df,
                oos_start=oos_start,
                params=variant_params,
                initial_capital=args.initial_capital,
                min_score=min_score_arg,
                max_holding_days=time_stop_arg,
            )
        except Exception as exc:
            logger.error(f"  Variant failed: {exc}")
            metrics, equity_curve = {}, pl.DataFrame()

        # Compute DSR per run using the honest trial_num as denominator
        dsr_passed: bool | None = None
        T    = len(equity_curve) if equity_curve is not None else 0
        sr   = metrics.get("sharpe")
        skew = metrics.get("skewness")
        kurt = metrics.get("kurtosis")

        if _is_finite(sr) and _is_finite(skew) and _is_finite(kurt) and T > 1:
            dsr_result = deflated_sharpe_ratio(
                observed_sr=float(sr),        # type: ignore[arg-type]
                n_trials=trial_num,
                T=T,
                skew=float(skew),             # type: ignore[arg-type]
                excess_kurtosis=float(kurt),  # type: ignore[arg-type]
            )
            dsr_passed = dsr_result.get("passes")

        append_to_ledger(
            params=variant_params,
            metrics=metrics,
            trial_number=trial_num,
            ledger_path=LEDGER_PATH,
            dsr_passed=dsr_passed,
            run_label=f"SWEEP-{group_name}",
        )

        sharpe_val = metrics.get("sharpe", float("nan"))
        cagr_val   = metrics.get("cagr_pct", float("nan"))
        mdd_val    = metrics.get("max_drawdown_pct", float("nan"))
        trades_val = metrics.get("total_trades", 0)
        logger.info(
            f"  → Sharpe={sharpe_val}  CAGR={cagr_val}%  "
            f"MaxDD={mdd_val}%  Trades={trades_val}  DSR={dsr_passed}"
        )

        sweep_records.append({
            "trial_number":      trial_num,
            "group":             group_name,
            "label":             label,
            "sharpe":            sharpe_val,
            "cagr_pct":          cagr_val,
            "max_drawdown_pct":  mdd_val,
            "total_trades":      trades_val,
            "dsr_passed":        dsr_passed,
            **{f"param_{k}": variant_params[k]
               for k in grid_param_keys if k in variant_params},
        })

    # ------------------------------------------------------------------
    # 6. Ranked summary
    # ------------------------------------------------------------------
    if sweep_records:
        results_df = pl.DataFrame(sweep_records).sort(
            "sharpe", descending=True, nulls_last=True
        )

        logger.info("=" * 80)
        logger.info(f"SWEEP COMPLETE — {total_variants} trials | ranked by IS Sharpe")
        logger.info("=" * 80)
        header = (
            f"{'Rank':>4} {'#Trial':>7} {'Sharpe':>8} {'CAGR%':>8} "
            f"{'MaxDD%':>8} {'Trades':>7} {'DSR':>6}  Label"
        )
        logger.info(header)
        logger.info("-" * 80)
        for rank, row in enumerate(results_df.iter_rows(named=True), start=1):
            logger.info(
                f"{rank:>4} {row['trial_number']:>7} "
                f"{row['sharpe']:>8.2f} {row['cagr_pct']:>8.2f} "
                f"{row['max_drawdown_pct']:>8.2f} {row['total_trades']:>7} "
                f"{str(row['dsr_passed']):>6}  {row['label']}"
            )

        sweep_out = BASE_DIR / "sweep_results.csv"
        results_df.write_csv(sweep_out)
        logger.success(f"Sweep results saved: {sweep_out}")

    # ------------------------------------------------------------------
    # 7. TRIAL_COUNTER update reminder
    # ------------------------------------------------------------------
    logger.warning(
        f"\n{'=' * 60}\n"
        f"  ACTION REQUIRED: update rev4_rules.py\n"
        f"  TRIAL_COUNTER: {TRIAL_COUNTER} → {final_trial_counter}\n"
        f"  If a DSR-passing variant is adopted as the new baseline,\n"
        f"  increment once more to {final_trial_counter + 1} (Rev4.next).\n"
        f"{'=' * 60}"
    )


if __name__ == "__main__":
    main()
```

**Step 4: Smoke-test dry run**

```bash
cd backtesting && python scripts/run_sweep.py --dry-run
```

Expected output (truncated):
```
Sweep: 54 variants | groups: ['A', 'B']
TRIAL_COUNTER will advance: 6 → 60
  [  1/54] Group A: max_pullback=15.0 | bbw_percentile=35.0 | min_prior_move=20.0
  [  2/54] Group A: max_pullback=15.0 | bbw_percentile=35.0 | min_prior_move=30.0
  ...
  [ 54/54] Group B: min_price=10.0 | min_dol_vol=20.0 | min_adr=5.0
Dry run complete — no backtests executed.
```

**Step 5: Run all tests**

```bash
cd backtesting && python -m pytest tests/test_sweep.py -v
```

Expected: `7 passed`

**Step 6: Commit**

```bash
git add backtesting/scripts/run_sweep.py
git commit -m "feat: add main() sweep loop with DSR, ledger integration, and ranked summary"
```

---

### Task 4: Final integration — run the sweep

**Step 1: Run Group A only first (27 trials) to verify end-to-end**

```bash
cd backtesting && python scripts/run_sweep.py --group A
```

Expected: 27 ledger rows appended to `backtest_ledger.csv`, ranked table printed, `sweep_results.csv` created.

**Step 2: Run Group B**

```bash
cd backtesting && python scripts/run_sweep.py --group B
```

Expected: 27 more ledger rows.

**Step 3: Inspect results**

```bash
python -c "
import polars as pl
df = pl.read_csv('backtest_ledger.csv')
print(df.select(['trial_number','run_label','metric_sharpe','metric_cagr_pct','dsr_passed']).sort('metric_sharpe', descending=True).head(10))
"
```

**Step 4: Update TRIAL_COUNTER in rev4_rules.py**

In `backtesting/src/strategy/rev4_rules.py`, line 29:
```python
TRIAL_COUNTER: int = 60  # was 6; updated after 54-trial grid sweep 2026-03-05
```

**Step 5: Commit final state**

```bash
git add backtesting/src/strategy/rev4_rules.py backtesting/sweep_results.csv backtesting/backtest_ledger.csv
git commit -m "run: complete 54-trial grid sweep; update TRIAL_COUNTER 6→60"
```

---

## Usage Reference

```bash
# Full sweep (54 trials)
python backtesting/scripts/run_sweep.py

# Single group only
python backtesting/scripts/run_sweep.py --group A
python backtesting/scripts/run_sweep.py --group B

# Preview variants without running
python backtesting/scripts/run_sweep.py --dry-run

# Custom date range / capital
python backtesting/scripts/run_sweep.py --start 2018-01-01 --end 2024-12-31 --initial-capital 250000

# Custom IS/OOS boundary
python backtesting/scripts/run_sweep.py --oos-start 2022-01-01
```
