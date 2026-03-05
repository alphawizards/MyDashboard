# Parameter Sweep Design — 2026-03-05

## Objective

Systematically explore two parameter groups (setup quality, universe filters) via focused grid search. All results logged to `backtest_ledger.csv` with DSR-honest trial counting.

## Search Strategy

**Focused grid search** — Cartesian product within each group. Baseline values included in each grid so every point is contextualized against the reference run. Total: 54 new trials. `TRIAL_COUNTER: 6 → 60`.

## Parameter Grids

### Group A — Setup Quality (3 × 3 × 3 = 27 runs)

| Parameter | Values | Baseline |
|---|---|---|
| `max_pullback` | `15.0`, `25.0`, `35.0` | `25.0` |
| `bbw_percentile` | `35.0`, `50.0`, `65.0` | `50.0` |
| `min_prior_move` | `20.0`, `30.0`, `40.0` | `30.0` |

Note: `40.0` max_pullback was previously tested and reverted (Rev4.3/4.5). It reappears here for completeness; DSR correction absorbs it correctly.

### Group B — Universe Filters (3 × 3 × 3 = 27 runs)

| Parameter | Values | Baseline |
|---|---|---|
| `min_price` | `3.0`, `5.0`, `10.0` | `5.0` |
| `min_dol_vol` | `5.0`, `10.0`, `20.0` | `10.0` |
| `min_adr` | `2.0`, `3.0`, `5.0` | `3.0` |

## Script Architecture

**New file:** `backtesting/scripts/run_sweep.py`

```
main()
├── 1. Parse args (--start, --end, --oos-start, --initial-capital, --group)
├── 2. Parquet load + date filter                              [ONCE]
├── 3. apply_all_features + apply_index_features               [ONCE]
├── 4. Missing data policy (forward-fill + drop_nulls)         [ONCE]
├── 5. IS/OOS split (auto 70/30 or --oos-start)                [ONCE]
├── 6. Generate variants via itertools.product per group
└── 7. For each variant (trial_num = TRIAL_COUNTER + 1..N):
    ├── evaluate_setups(equity_df, params=variant)
    ├── Backtester.run_vectorized(is_df, cost_multiplier=1.0)
    ├── generate_report(trades, equity_curve)
    ├── append_to_ledger(variant_params, metrics, trial_num, ...)
    └── Progress: "Trial 7/60 [group=A max_pullback=15.0] Sharpe=X"
```

**Outputs:**
- `backtest_ledger.csv` — append-only master ledger (all runs)
- `sweep_results.csv` — this sweep's runs only, ranked by Sharpe
- Terminal: ranked summary table + `TRIAL_COUNTER` update instruction

**Efficiency:** Feature engineering runs once. Each trial re-runs only `evaluate_setups()` + backtester (~seconds). 54 trials completes in ~2–5 minutes.

## DSR Implications

$$SR^*_{max}(60) \approx \sqrt{2 \ln(60)} - \frac{\ln(\ln(60)) + \ln(4\pi)}{2\sqrt{2 \ln(60)}} \approx 2.81$$

DSR passes (`dsr > 0.95`) only if the winning set's IS Sharpe exceeds ~2.81 after non-normality correction. Each ledger row stores the exact `trial_number` denominator used — DSR is recomputable at any time from the honest trial count.

The baseline params are included in both grids (`"BASELINE_MATCH"` label). If no variant passes DSR, the conclusion is that current params are near-optimal within these dimensions.

## Post-Sweep Action

After the sweep completes, manually update `rev4_rules.py`:
```python
TRIAL_COUNTER: int = 60  # was 6
```
If a DSR-passing variant is adopted as the new baseline, increment once more:
```python
TRIAL_COUNTER: int = 61  # Rev4.6
```
