# Implementation Plan: Backtesting Engine Alignment with `backtestprep.md`

> **Date:** 2026-03-05
> **Status:** Draft — Pending Approval
> **Scope:** Phases 0–2 detailed, Phases 3–4 outlined
> **Reference:** `backtestprep.md` (Sections 1–15), `qullamaggie_rev4_criteria.md`

---

## Executive Summary

The backtesting engine is structurally sound — modular, vectorized with Polars, and well-organized across `src/data`, `src/features`, `src/strategy`, `src/execution`, and `src/analysis`. The architecture supports the Rev4 Pine Script strategy with ~30 feature columns, boolean gate pipelines, and a Chandelier trailing stop exit.

However, the engine fails to meet the institutional standards defined in `backtestprep.md` across three dimensions:

1. **Correctness** — Critical strategy gates are computed but never enforced. The ATR fallback in the backtester computes average range, not true ATR. The test suite is non-functional.
2. **Realism** — Zero transaction costs. No cash tracking. Position sizing function exists but is disconnected from the execution loop.
3. **Validation** — No IS/OOS split. Tearsheet reports only trade count and win rate. No statistical significance testing.

This plan addresses all three dimensions in priority order.

---

## Current State Assessment

### What Works

| Component | File | Status |
|---|---|---|
| Data ingestion (Alpaca API) | `src/data/ingestion.py` | Functional |
| Feature engineering (30+ cols) | `src/features/metrics.py` | Functional, minor bugs |
| Index features (regime, RS) | `src/features/metrics.py` | Functional |
| Setup detection (A/B/C) | `src/strategy/rev4_rules.py` | Functional |
| Scoring system (0–10) | `src/strategy/rev4_rules.py` | Computes correctly |
| Chandelier exit (tiered lookback) | `src/execution/portfolio.py` | Functional |
| Entry signal with breakout confirmation | `src/execution/backtester.py` | Functional |
| Trade simulation loop | `src/execution/backtester.py` | Functional, needs enhancement |

### What's Broken or Missing

| Issue | File | Lines | backtestprep.md Section |
|---|---|---|---|
| ATR fallback uses `(H-L).rolling_mean(20)` | `backtester.py` | 100–103 | §3.2 Order of Operations |
| No transaction costs (zero slippage, zero commission) | `backtester.py` | 145 | §4.1–4.6 |
| No cash tracking or capital allocation | `backtester.py` | 30–31 | §3.3 |
| Position sizing disconnected from execution | `portfolio.py` | 13–35 | §3.3 |
| Tearsheet: only win rate and count | `tearsheet.py` | 28–46 | §6.1–6.5 |
| No IS/OOS split mechanism | `run_backtest.py` | — | §5.2 |
| Test suite non-functional (broken import, empty bodies) | `test_rules.py` | 3, 21, 29, 36 | §11.2 |
| No statistical significance tests | — | — | §7.1–7.3 |
| No parameter sensitivity analysis | — | — | §8.1 |
| No sub-period or regime analysis | — | — | §8.2–8.3 |
| BBW percentile: ordinal rank vs percent-below | `metrics.py` | 93–96 | — |
| Missing data: silent `drop_nulls()` | `run_backtest.py` | 72 | §2.6 |
| Hardcoded API credentials | `ingestion.py` | 26–27 | §11.2 |
| 3-ticker toy universe | `run_backtest.py` | 21 | §2.1 |

---

## Phase 0: Fix Critical Bugs

> **Goal:** Make the existing engine produce correct, trustworthy results.
> **backtestprep.md alignment:** §2.3 (look-ahead), §3.2 (order of operations), §9 (pitfalls checklist)

### 0.1 Fix ATR Fallback in Backtester

**File:** `src/execution/backtester.py` lines 98–103

**Problem:** When the `atr` column is missing, the backtester computes `(high - low).rolling_mean(20)` — this is average range, not ATR. True ATR accounts for overnight gaps via `max(H-L, |H-prevC|, |L-prevC|)`. The correct ATR is already computed in `metrics.py` (lines 119–131), so this fallback should never trigger in normal operation, but when it does, the output is wrong.

**Fix:** Replace the fallback with the same true ATR formula used in `metrics.py`:
```python
if "atr" not in data.columns:
    logger.warning("ATR column missing — computing true ATR.")
    prev_close = pl.col("close").shift(1).over("ticker")
    true_range = pl.max_horizontal(
        pl.col("high") - pl.col("low"),
        (pl.col("high") - prev_close).abs(),
        (pl.col("low") - prev_close).abs(),
    )
    data = data.with_columns(
        true_range.ewm_mean(alpha=1.0/20.0, adjust=False, min_periods=20)
            .over("ticker").alias("atr")
    )
```

**Acceptance:** ATR values in the backtester match `metrics.py` output to 6 decimal places.

### 0.2 Fix BBW Percentile Rank

**File:** `src/features/metrics.py` lines 93–96

**Problem:** Pine's `ta.percentrank(src, len)` returns the percentage of values in the lookback window that are strictly below the current value: `(count_below / window) * 100`. Polars' `rolling_rank` returns ordinal rank (1..N). The current approximation `(rank - 1) / 99 * 100` diverges from Pine when there are ties or non-uniform distributions.

**Fix:** Implement a proper percent-rank using a rolling map expression or a UDF that counts values strictly below the current value within the 100-bar window. If Polars doesn't support this natively, use `rolling_map` with a lambda:
```python
# Option A: Polars expression (preferred if supported)
# Option B: Rolling map with explicit percent-rank logic
def percent_rank(s: pl.Series) -> float:
    current = s[-1]
    window = s[:-1]
    if len(window) == 0:
        return 0.0
    return (window < current).sum() / len(window) * 100

df = df.with_columns(
    pl.col("bbw").rolling_map(percent_rank, window_size=100)
        .over("ticker").alias("bbw_rank")
)
```

**Acceptance:** On synthetic data with known rank distribution, output matches Pine `ta.percentrank` to within 1%.

### 0.3 Fix Test Suite

**File:** `tests/test_rules.py`

**Problem:** Line 3 imports `calc_adr` which doesn't exist in `metrics.py`. All test bodies are `pass`. Zero test coverage on core logic.

**Fix:** Rewrite the test suite with functional tests covering:

| Test | What It Validates |
|---|---|
| `test_adr_formula_parity` | ADR = `100 * (SMA(H/L, 20) - 1)` matches Pine output |
| `test_bbw_percentile_lag` | BBW rank uses 1-bar lag (`shift(1)`) in setup detection |
| `test_pullback_no_floor` | Pullback of 11.4% passes `max_pullback=25%` (Rev4 fix) |
| `test_true_atr_vs_average_range` | ATR with gaps > `(H-L).rolling_mean()` by the gap amount |
| `test_setup_a_boolean_gate` | Setup A fires only when all conditions AND pass_universe are true |
| `test_setup_c_ep_entry` | EP entry triggers on gap day itself, not next bar |
| `test_entry_signal_next_day_open` | Entry price = next day's open, not signal day's close |
| `test_chandelier_exit_tiered` | Flag=20bar, HTF=30bar, EP=10bar lookback windows |
| `test_regime_filter_enforcement` | Trades only occur when SPY > MA50 OR QQQ > MA50 |
| `test_momentum_gate_enforcement` | Trades require at least one momentum timeframe to pass |

Each test constructs synthetic data with known expected outcomes. No external data dependencies.

**Acceptance:** `pytest tests/` passes with 10+ tests, zero failures.

### 0.4 Document Missing Data Policy

**File:** `scripts/run_backtest.py` line 72

**Problem:** `equity_df.drop_nulls()` silently removes all rows with any null value. This changes the effective trading calendar and biases results (backtestprep.md §2.6).

**Fix:**
1. Replace blanket `drop_nulls()` with targeted null handling:
   - Forward-fill price columns (`open`, `high`, `low`, `close`) within each ticker — simulates "no trade occurred" (backtestprep.md §2.6).
   - Drop rows only where critical feature columns are null due to insufficient lookback history (first 252 rows per ticker for 52-week high).
2. Add a log statement reporting how many rows were dropped and why.
3. Add a comment block documenting the missing data policy.

**Acceptance:** The pipeline logs `"Dropped {N} rows for {ticker}: insufficient lookback history (< 252 bars)"` instead of silent bulk deletion.

---

## Phase 1: Add Realism

> **Goal:** Model the friction that exists between backtest and live trading.
> **backtestprep.md alignment:** §3.3 (cash management), §4.1–4.6 (transaction costs), §4.6 (sensitivity)

### 1.1 Transaction Cost Model

**File:** `src/execution/backtester.py`

**Changes to `Backtester.__init__`:**
```python
COST_PARAMS = {
    "commission_per_share": 0.005,   # $0.005/share (IBKR tiered)
    "min_commission": 1.00,          # $1.00 minimum per order
    "slippage_bps": 5.0,             # 5 bps half-spread for liquid large-caps
    "sec_fee_per_million": 8.00,     # SEC fee on sells
}
```

**Changes to trade simulation loop (line 145):**

For each trade:
```
adjusted_entry   = entry_price * (1 + slippage_bps / 10_000)
adjusted_exit    = exit_price  * (1 - slippage_bps / 10_000)
commission_entry = max(shares * commission_per_share, min_commission)
commission_exit  = max(shares * commission_per_share, min_commission)
sec_fee          = (adjusted_exit * shares / 1_000_000) * sec_fee_per_million
gross_pnl        = (adjusted_exit - adjusted_entry) * shares
net_pnl          = gross_pnl - commission_entry - commission_exit - sec_fee
```

**Trade record additions:**
```
"shares", "gross_pnl", "net_pnl", "total_costs", "slippage_cost", "commission_cost"
```

**Acceptance:** A trade with entry=$100, exit=$110, 100 shares produces:
- `slippage_cost = 100 * 0.0005 * 100 + 100 * 110 * 0.0005 = $10.50`
- `commission_cost = 2 * max(100 * 0.005, 1.00) = $1.00`
- `net_pnl < gross_pnl` by exactly the sum of costs.

### 1.2 Dynamic Slippage Heuristic

**File:** `src/features/metrics.py`

**New feature column:** `est_slippage_bps`

Estimate half-spread as a function of liquidity and volatility (backtestprep.md §4.2):
```python
# Heuristic: less liquid and more volatile → higher slippage
# Base: 5 bps for mega-cap ($1B+ ADV), scaling up for smaller names
est_slippage_bps = (
    pl.when(pl.col("avg_dol_vol_20") >= 500)  # $500M+ ADV
        .then(pl.lit(2.0))
    .when(pl.col("avg_dol_vol_20") >= 100)     # $100M+ ADV
        .then(pl.lit(5.0))
    .when(pl.col("avg_dol_vol_20") >= 20)      # $20M+ ADV
        .then(pl.lit(10.0))
    .otherwise(pl.lit(20.0))                    # < $20M ADV
) * (pl.col("adr") / 5.0).clip(0.5, 3.0)      # Scale by volatility
```

When `est_slippage_bps` is available, the backtester should use it instead of the flat `slippage_bps` parameter. Fall back to the flat rate when the column is absent.

**Acceptance:** A $10M ADV stock with 8% ADR receives ~16 bps slippage. A $500M ADV stock with 3% ADR receives ~1.2 bps.

### 1.3 Cash Tracking and Capital Allocation

**File:** `src/execution/backtester.py`

**Problem:** The backtester computes PnL as a percentage of entry price per trade but never tracks available capital. This means:
- The strategy can simultaneously enter unlimited positions with unlimited capital.
- Position sizing is disconnected — `portfolio.py`'s `calculate_position_size` is never called.
- No concept of "can we afford this trade?" (backtestprep.md §3.3).

**Changes:**

1. **Add portfolio state to `Backtester`:**
```python
self.capital = initial_capital
self.open_positions: dict[str, dict] = {}   # ticker → {shares, entry_price, stop}
self.max_open_positions = 10                 # Concentration limit
```

2. **Before entering a trade, check:**
   - `len(self.open_positions) < self.max_open_positions`
   - Sufficient capital: `required_capital = shares * adjusted_entry_price`
   - No duplicate: ticker not already in `self.open_positions`

3. **Wire `calculate_position_size`:**
   - Compute `stop_price = chandelier_exit` at entry bar.
   - Pass `entry_price`, `stop_price`, and `current_capital` to `calculate_position_size`.
   - Use the returned `final_shares` for the trade.

4. **Update capital on exit:**
   - `self.capital += net_pnl` (net of all costs).

5. **Track equity curve:**
   - At each bar, compute `equity = capital + sum(open_position_mark_to_market)`.
   - Store as a time series for drawdown analysis.

**Changes to `portfolio.py`:**

Update `calculate_position_size` to accept scalar inputs (not DataFrame columns) since it's called per-trade in the loop:
```python
def calculate_position_size(
    entry_price: float,
    stop_price: float,
    capital: float,
    adr: float,
    config: dict = PORTFOLIO_CONFIG,
) -> dict:
    """Returns {"shares": int, "risk_dollars": float, "capital_required": float}"""
```

**Acceptance:**
- Starting capital $100K. After a $2K loss, next trade sizes from $98K.
- With 10 open positions, the 11th candidate is skipped.
- Trade log includes `shares`, `capital_at_entry`, `capital_required`.

### 1.4 Transaction Cost Sensitivity Runs

**File:** `scripts/run_backtest.py`

backtestprep.md §4.6: *"Run the backtest at 1x, 2x, and 3x estimated costs. If unprofitable at 2x, the strategy is fragile."*

**Changes:**
- Add `--cost-multiplier` CLI argument (default: `[1.0, 2.0, 3.0]`).
- Run the backtest once per multiplier, scaling `commission_per_share` and `slippage_bps` by the multiplier.
- Output a comparison table:

```
Cost Multiplier | Net CAGR | Net Sharpe | Max DD | Profit Factor
      1.0x      |  12.3%   |    1.05    | -18.2% |     1.82
      2.0x      |   8.1%   |    0.72    | -18.2% |     1.54
      3.0x      |   4.0%   |    0.38    | -18.2% |     1.27
```

**Acceptance:** Three separate tearsheets produced. If 2x costs yield negative CAGR, a `FRAGILE STRATEGY` warning is logged.

---

## Phase 2: Validate

> **Goal:** Establish statistical confidence that the strategy's edge is real, not noise.
> **backtestprep.md alignment:** §5.2 (IS/OOS), §6.1–6.5 (metrics), §7.1–7.3 (significance)

### 2.1 In-Sample / Out-of-Sample Split

**File:** `scripts/run_backtest.py`

**Changes:**
- Add `--oos-start` CLI argument. Default: 70% of the date range.
- Split the data after feature computation but before `evaluate_setups`:
  ```
  is_data = equity_df.filter(pl.col("date") < oos_start_date)
  oos_data = equity_df.filter(pl.col("date") >= oos_start_date)
  ```
- Run `evaluate_setups` and `Backtester.run_vectorized` separately on each split.
- Generate separate tearsheets for IS and OOS periods.
- Log a degradation warning if OOS Sharpe < 50% of IS Sharpe.

**Critical rule (backtestprep.md §5.2):** *"You get one shot at the OOS period."* The plan does NOT support iterating on OOS results. The IS period is for development; the OOS period is a final exam.

**Output format:**
```
| Metric            | In-Sample    | Out-of-Sample | Degradation |
|-------------------|-------------|---------------|-------------|
| CAGR              | 18.4%       | 11.2%         | -39%        |
| Sharpe            | 1.32        | 0.87          | -34%        |
| Max Drawdown      | -15.3%      | -22.1%        | +44%        |
| Win Rate          | 48.2%       | 42.7%         | -11%        |
| Profit Factor     | 2.14        | 1.68          | -21%        |
```

**Acceptance:** IS and OOS tearsheets generated with zero data leakage between periods.

### 2.2 Full Performance Tearsheet

**File:** `src/analysis/tearsheet.py` (complete rewrite)

**Required metrics (backtestprep.md §6.1–6.4):**

**Core Return Metrics:**
| Metric | Formula | Notes |
|---|---|---|
| Total Return | `(final_equity / initial_equity) - 1` | Net of all costs |
| CAGR | `(final/initial)^(252/trading_days) - 1` | Annualized |
| Annualized Volatility | `daily_returns.std() * sqrt(252)` | Net returns |
| Sharpe Ratio | `(CAGR - Rf) / ann_vol` | Rf from 10Y Treasury or param |
| Sortino Ratio | `(CAGR - Rf) / downside_vol` | Downside deviation only |
| Calmar Ratio | `CAGR / abs(max_drawdown)` | — |

**Drawdown Analysis:**
| Metric | Implementation |
|---|---|
| Maximum Drawdown | Peak-to-trough on equity curve |
| Max Drawdown Duration | Trading days from peak to recovery |
| Top 5 Drawdowns | Table: start, trough, end, depth, duration |

**Risk Metrics:**
| Metric | Implementation |
|---|---|
| VaR (95%, 99%) | Historical simulation on daily returns |
| CVaR / Expected Shortfall | Mean of returns below VaR threshold |
| Skewness | `scipy.stats.skew` or Polars equivalent |
| Kurtosis | Excess kurtosis (Fisher definition) |
| Tail Ratio | `abs(percentile_95 / percentile_05)` |

**Trade Statistics:**
| Metric | Implementation |
|---|---|
| Total Trades | Count of trade records |
| Win Rate | Winning trades / total |
| Average Win / Average Loss | Mean of positive / negative PnL |
| Profit Factor | Gross profits / gross losses |
| Expectancy | `(win_rate * avg_win) - (loss_rate * avg_loss)` |
| Kelly Fraction | Already implemented, wire it in |
| Average Holding Period | `(exit_date - entry_date).mean()` |
| Max Consecutive Wins/Losses | Streak analysis |

**Execution Feasibility (backtestprep.md §6.4):**
| Metric | Implementation |
|---|---|
| Average Turnover | Total traded value / average equity per period |
| Average Position Size | Mean `capital_required / equity` across trades |
| Peak Gross Leverage | Max sum of open position values / equity |

**Benchmarking (backtestprep.md §6.5):**
| Metric | Implementation |
|---|---|
| Beta to SPY | `cov(strategy, SPY) / var(SPY)` on daily returns |
| Alpha | `strategy_return - beta * SPY_return` annualized |
| Information Ratio | `alpha / tracking_error` |
| Correlation to SPY | Pearson on daily returns |

**Output:** Both printed summary (logger) and a structured dictionary for programmatic access. The dictionary format enables the IS/OOS comparison table in §2.1.

**Acceptance:** `generate_report(trade_log, equity_curve, benchmark_returns)` produces all metrics above. Sharpe matches a manual calculation on the same data to 2 decimal places.

### 2.3 Statistical Significance Testing

**File:** `src/analysis/significance.py` (new file)

**Required tests (backtestprep.md §7.1–7.3):**

**t-Test for Mean Excess Return (§7.1):**
```python
def t_test_returns(daily_returns: pl.Series) -> dict:
    """
    H0: mean excess return = 0.
    Returns: t_stat, p_value, effective_N (Newey-West adjusted).
    """
```
- Use Newey-West standard errors (lag = `int(4 * (N/100)^(2/9))`) to correct for serial correlation in returns.
- Threshold: `t > 2.0` minimum, `t > 3.0` preferred (backtestprep.md §7.1).

**Bootstrap Confidence Intervals (§7.2):**
```python
def bootstrap_sharpe(daily_returns: pl.Series, n_bootstrap: int = 10_000, block_size: int = 21) -> dict:
    """
    Block bootstrap (21-day blocks to preserve serial correlation).
    Returns: sharpe_mean, sharpe_std, ci_95_lower, ci_95_upper.
    """
```

**Permutation Test (§7.2):**
```python
def permutation_test(signals: pl.Series, returns: pl.Series, n_permutations: int = 10_000) -> dict:
    """
    Shuffle signal-return mapping to test if strategy outperforms random.
    Returns: observed_sharpe, p_value (fraction of permutations >= observed).
    """
```

**Deflated Sharpe Ratio (backtestprep.md Appendix A):**
```python
def deflated_sharpe_ratio(observed_sr: float, n_trials: int, T: int, skew: float, kurtosis: float) -> dict:
    """
    DSR adjusts observed Sharpe for number of strategy variants tested.
    Returns: dsr, p_value.
    """
```

**Acceptance:** On synthetic data with known Sharpe = 0, the t-test returns p > 0.05 at least 95% of the time. On data with known Sharpe = 1.5, the bootstrap CI excludes zero.

### 2.4 Degrees of Freedom Audit

**File:** `src/strategy/rev4_rules.py` (documentation addition)

backtestprep.md §5.1: *"List every parameter. Count them. If a strategy has 15 tunable parameters and you optimized all of them, you have almost certainly overfit."*

**Current PARAMS dict has 17 parameters.** Add a docstring audit:

```python
PARAMS = {
    # --- 17 Parameters ---
    # Optimized: 0 (all set from economic reasoning / Pine Script defaults)
    # Fixed from domain knowledge: 17
    #
    # AUDIT (backtestprep.md §5.1):
    # These parameters replicate the Qullamaggie discretionary criteria
    # translated into quantitative thresholds. None were optimized on
    # backtest data. If any parameter is changed based on backtest results,
    # increment the trial counter and apply DSR correction.
    #
    # Trial Counter: 0 (initial implementation, no optimization performed)
    ...
}
```

**Acceptance:** Every parameter has a comment justifying its value. A `TRIAL_COUNTER` variable is added at module level.

---

## Phase 3: Robustness Testing (Outlined)

> **backtestprep.md alignment:** §8.1–8.6
> **Priority:** After Phases 0–2 are validated and merged.

### 3.1 Parameter Sensitivity Analysis (§8.1)

- Vary each of the top 5 parameters individually: `min_price`, `min_adr`, `mom_threshold_1m`, `bbw_percentile`, `ep_gap_min`.
- Plot Sharpe ratio as a function of each parameter.
- Flag any parameter where a 10% change reduces Sharpe by > 30%.

### 3.2 Sub-Period Analysis (§8.2)

- Split data into non-overlapping 2-year windows.
- Run backtest on each. Require positive Sharpe in > 50% of windows.

### 3.3 Regime Analysis (§8.3)

- Condition performance on: bull/bear (SPY drawdown > 20%), high/low VIX (above/below 20), rising/falling rates.
- Report Sharpe, win rate, and max drawdown per regime.

### 3.4 Monte Carlo Simulation (§8.4)

- Block bootstrap (21-day blocks) on daily strategy returns.
- Generate 10,000 synthetic equity curves.
- Report 5th/50th/95th percentile of terminal wealth, max drawdown, and Sharpe.

### 3.5 Historical Stress Tests (§8.5)

- Run through: 2020 COVID crash, 2022 rate hiking cycle, 2018 Q4 selloff.
- Report peak drawdown and recovery time in each.

---

## Phase 4: Production Readiness (Outlined)

> **backtestprep.md alignment:** §10–11
> **Priority:** After Phase 3. Prerequisite to any live or paper trading.

### 4.1 Walk-Forward Optimization (§5.3)

- Implement rolling walk-forward with configurable train/test windows.
- Default: 2-year train, 6-month test, rolling forward by 6 months.
- Concatenate OOS segments to build synthetic forward-test equity curve.

### 4.2 Backtest Report Template (§11.1)

- Auto-generate a markdown report containing all 10 items from §11.1:
  strategy description, universe, data sources, parameters, methodology, results, robustness, trial count, known risks, version history.

### 4.3 Paper Trading Protocol (§10.2)

- Document minimum 3–6 month paper trading requirement.
- Define comparison metrics: actual fills vs. backtest fills, realized vs. expected volatility, realized vs. expected drawdown.

### 4.4 Credential Security

- Move Alpaca API keys from hardcoded strings (`ingestion.py` lines 26–27) to environment variables.
- Add `.env.example` with placeholder keys.

### 4.5 Universe Expansion

- Replace 3-ticker default with full Alpaca universe (already fetched in `data/raw/alpaca_chunks/`).
- Add `--universe` CLI flag: `top100` (by ADV), `sp500`, `full`, or custom ticker file.

---

## Dependency Map

```
Phase 0.1 (ATR fix) ──────────────┐
Phase 0.2 (BBW fix) ──────────────┤
Phase 0.3 (Test suite) ───────────┤──→ Phase 1.1 (Transaction costs)
Phase 0.4 (Missing data policy) ──┘         │
                                            ├──→ Phase 1.2 (Dynamic slippage)
                                            ├──→ Phase 1.3 (Cash tracking) ──→ Phase 1.4 (Cost sensitivity)
                                            │
                                            └──→ Phase 2.1 (IS/OOS split)
                                                      │
                                                      ├──→ Phase 2.2 (Full tearsheet)
                                                      ├──→ Phase 2.3 (Statistical significance)
                                                      └──→ Phase 2.4 (DoF audit)
                                                               │
                                                               └──→ Phase 3 (Robustness) ──→ Phase 4 (Production)
```

**Phase 0 items are independent and can be parallelized.**
**Phase 1 items depend on Phase 0 completion.**
**Phase 2 items depend on Phase 1.3 (cash tracking produces the equity curve needed for metrics).**

---

## Verification Protocol

### Per-Phase Gate Criteria

| Phase | Gate | How to Verify |
|---|---|---|
| 0 | All tests pass | `pytest tests/ -v` — 10+ tests, 0 failures |
| 0 | ATR parity | Unit test: backtester ATR == metrics.py ATR on same data |
| 1 | Costs degrade returns | `net_pnl < gross_pnl` for every trade in the log |
| 1 | Capital constraints bind | At least one trade skipped due to insufficient capital in a sample run |
| 2 | IS/OOS separation | OOS start date > max IS date. Zero overlapping rows. |
| 2 | Tearsheet completeness | All 25+ metrics computed and non-null |
| 2 | Statistical rigor | t-stat and bootstrap CI reported. If t < 2.0, strategy flagged. |

### Manual Verification Checkpoints

1. **After Phase 0:** Run on TSLA 2020–2023. Compare trade log entry prices to raw data — every entry price must equal the next bar's open price.
2. **After Phase 1:** Take a single trade from the log. Manually compute gross PnL, slippage, commissions, and net PnL. Verify they match the trade record.
3. **After Phase 2:** Run IS (2020–2022) and OOS (2023). Verify OOS tearsheet was generated from OOS data only — spot-check 3 trade dates fall within the OOS window.

---

## Files Modified (Summary)

| File | Phase | Change Type |
|---|---|---|
| `src/execution/backtester.py` | 0.1, 1.1, 1.3 | Modify |
| `src/features/metrics.py` | 0.2, 1.2 | Modify |
| `tests/test_rules.py` | 0.3 | Rewrite |
| `scripts/run_backtest.py` | 0.4, 1.4, 2.1 | Modify |
| `src/execution/portfolio.py` | 1.3 | Modify |
| `src/analysis/tearsheet.py` | 2.2 | Rewrite |
| `src/analysis/significance.py` | 2.3 | New |
| `src/strategy/rev4_rules.py` | 2.4 | Documentation |

---

## Appendix: backtestprep.md Section Coverage Matrix

| backtestprep.md Section | Phase | Status |
|---|---|---|
| §1 Philosophy & Mindset | — | Embedded in all phases |
| §2.1 Source Selection | 4.5 | Outlined |
| §2.2 Survivorship Bias | 4.5 | Outlined (requires PIT data) |
| §2.3 Look-Ahead Bias | 0.1, 0.3 | Phase 0 |
| §2.4 Corporate Actions | — | Handled by Alpaca "all" adjustment |
| §2.5 Timestamp Alignment | — | Single data source, daily bars, no conflict |
| §2.6 Missing Data | 0.4 | Phase 0 |
| §3.1 Engine Architecture | — | Vectorized (appropriate for current stage) |
| §3.2 Order of Operations | 0.1 | Phase 0 |
| §3.3 Cash & Position Mgmt | 1.3 | Phase 1 |
| §4.1 Commission & Fees | 1.1 | Phase 1 |
| §4.2 Bid-Ask Spread | 1.1, 1.2 | Phase 1 |
| §4.3 Market Impact | 3.x | Phase 3 (future) |
| §4.4 Short-Selling Costs | — | N/A (long-only strategy) |
| §4.5 Financing Costs | — | N/A (no leverage modeled) |
| §4.6 Cost Sensitivity | 1.4 | Phase 1 |
| §5.1 DoF Audit | 2.4 | Phase 2 |
| §5.2 IS/OOS Split | 2.1 | Phase 2 |
| §5.3 Walk-Forward | 4.1 | Phase 4 (outlined) |
| §5.4 Cross-Validation | — | N/A (time-series, not cross-sectional ranking) |
| §5.5 Multiple Testing | 2.3 | Phase 2 (DSR) |
| §5.6 Economic Intuition | 2.4 | Phase 2 (parameter justification) |
| §6.1 Core Return Metrics | 2.2 | Phase 2 |
| §6.2 Drawdown Analysis | 2.2 | Phase 2 |
| §6.3 Risk Metrics | 2.2 | Phase 2 |
| §6.4 Execution Feasibility | 2.2 | Phase 2 |
| §6.5 Benchmarking | 2.2 | Phase 2 |
| §7.1 t-Test | 2.3 | Phase 2 |
| §7.2 Bootstrap & Permutation | 2.3 | Phase 2 |
| §7.3 Bayesian | — | Deferred (optional enhancement) |
| §8.1 Parameter Sensitivity | 3.1 | Phase 3 (outlined) |
| §8.2 Sub-Period Analysis | 3.2 | Phase 3 (outlined) |
| §8.3 Regime Analysis | 3.3 | Phase 3 (outlined) |
| §8.4 Monte Carlo | 3.4 | Phase 3 (outlined) |
| §8.5 Historical Stress Tests | 3.5 | Phase 3 (outlined) |
| §8.6 Hypothetical Stress | — | Deferred |
| §9 Pitfalls Checklist | 0.3 | Tests encode the checklist |
| §10 Walk-Forward & Paper | 4.1, 4.3 | Phase 4 (outlined) |
| §11 Documentation | 4.2 | Phase 4 (outlined) |
| §13 Asset Class (Equities) | 0.4, 1.1 | Addressed throughout |
