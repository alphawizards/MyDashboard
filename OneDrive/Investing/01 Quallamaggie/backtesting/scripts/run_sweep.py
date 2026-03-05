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
        prefix = "BASELINE_MATCH" if is_baseline else ""
        body = " | ".join(parts)
        if prefix and body:
            label = f"{prefix} | {body}"
        elif prefix:
            label = prefix
        else:
            label = body
        variants.append((label, variant))

    return variants
