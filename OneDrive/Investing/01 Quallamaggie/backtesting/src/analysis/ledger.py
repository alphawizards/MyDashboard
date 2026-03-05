"""
Append-Only Experiment Ledger  (backtestprep.md §5.5)
=====================================================
Every backtest run appends one row to backtest_ledger.csv.

Schema evolution is handled transparently via Polars ``diagonal_relaxed``
concat: new columns fill all older rows with null; removed columns retain
their last-known values.  The ledger is the authoritative trial log for
Deflated Sharpe Ratio trial counting.
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import polars as pl
from loguru import logger


def append_to_ledger(
    params: dict[str, Any],
    metrics: dict[str, Any],
    trial_number: int,
    ledger_path: str | Path,
    dsr_passed: bool | None = None,
    run_label: str = "",
) -> None:
    """
    Appends one row to the master backtest ledger CSV.

    Parameters
    ----------
    params        : PARAMS dict from rev4_rules — each key prefixed ``param_``.
    metrics       : Scalar metrics from tearsheet.generate_report().
                    Nested structures (score_breakdown, wf_window_results, etc.)
                    are silently dropped — only scalars survive.
    trial_number  : TRIAL_COUNTER from rev4_rules (DSR denominator).
    ledger_path   : Destination CSV (created on first call; parent dirs created).
    dsr_passed    : deflated_sharpe_ratio()["passes"], or None if not computed.
    run_label     : e.g. "IN-SAMPLE", "WALK-FORWARD", "FULL_PERIOD".
    """
    ledger_path = Path(ledger_path)
    tmp_path = ledger_path.with_suffix(".ledger_tmp")

    # ------------------------------------------------------------------
    # 1. Assemble the row dict — metadata, then params, then metrics
    # ------------------------------------------------------------------
    row: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "trial_number": trial_number,
        "dsr_passed": dsr_passed,
        "run_label": run_label,
    }

    for k, v in params.items():
        row[f"param_{k}"] = v

    for k, v in metrics.items():
        # Drop nested structures (score_breakdown, wf_window_results, etc.)
        if isinstance(v, (int, float, str, bool)) or v is None:
            row[f"metric_{k}"] = v

    # ------------------------------------------------------------------
    # 2. Single-row Polars DataFrame — one column per key
    # ------------------------------------------------------------------
    new_row = pl.DataFrame({k: [v] for k, v in row.items()})

    # ------------------------------------------------------------------
    # 3. Schema-evolving atomic append
    #    diagonal_relaxed: missing columns → null; type conflicts → supertype
    # ------------------------------------------------------------------
    try:
        if ledger_path.exists():
            existing = pl.read_csv(
                ledger_path,
                infer_schema_length=None,  # scan all rows for type inference
                null_values=["", "null", "NULL", "None"],
            )
            combined = pl.concat([existing, new_row], how="diagonal_relaxed")
        else:
            ledger_path.parent.mkdir(parents=True, exist_ok=True)
            combined = new_row

        combined.write_csv(tmp_path)
        os.replace(tmp_path, ledger_path)  # atomic on both POSIX and Win32
        logger.success(
            f"Ledger [{run_label}] trial #{trial_number} appended → "
            f"{ledger_path.name}  ({len(combined)} total runs)"
        )

    except Exception as exc:
        logger.error(f"Ledger append failed — trial #{trial_number}: {exc}")
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise
