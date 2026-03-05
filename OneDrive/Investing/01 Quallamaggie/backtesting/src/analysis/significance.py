"""
Statistical Significance Testing  (backtestprep.md §7.1–7.3)
=============================================================
Functions:
  - t_test_returns        : t-test with Newey-West autocorrelation correction
  - bootstrap_sharpe      : Block bootstrap 95% CI for Sharpe ratio
  - permutation_test      : Signal-return shuffle test
  - deflated_sharpe_ratio : DSR adjusting for number of trials

Usage example:
    from src.analysis.significance import t_test_returns, bootstrap_sharpe

    daily = equity_curve["equity"].pct_change().drop_nulls().to_list()
    print(t_test_returns(daily))
    print(bootstrap_sharpe(daily))
"""

import math
import random
from typing import Any


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _mean(data: list[float]) -> float:
    return sum(data) / len(data) if data else float("nan")


def _std(data: list[float]) -> float:
    n = len(data)
    if n < 2:
        return float("nan")
    m = _mean(data)
    return math.sqrt(sum((x - m) ** 2 for x in data) / (n - 1))


def _sharpe(data: list[float], rf: float = 0.02) -> float:
    """Annualised Sharpe from a list of daily returns."""
    if len(data) < 2:
        return float("nan")
    ann_ret = _mean(data) * 252
    ann_vol = _std(data) * math.sqrt(252)
    return (ann_ret - rf) / ann_vol if ann_vol > 0 else float("nan")


def _normal_cdf(z: float) -> float:
    """Standard normal CDF via error function approximation."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


# ---------------------------------------------------------------------------
# 1. t-Test with Newey-West Standard Errors  (backtestprep.md §7.1)
# ---------------------------------------------------------------------------

def t_test_returns(
    daily_returns: list[float],
    risk_free_daily: float = 0.02 / 252,
) -> dict[str, Any]:
    """
    Tests H0: mean excess return = 0.

    Uses Newey-West HAC standard errors to correct for serial correlation
    in returns (backtestprep.md §7.1).  The optimal lag is:
        lag = int(4 * (N / 100) ^ (2/9))

    Returns
    -------
    dict with keys:
        t_stat         : Newey-West t-statistic
        p_value        : two-tailed p-value
        mean_excess    : mean daily excess return
        se_ols         : naive OLS standard error
        se_nw          : Newey-West standard error
        effective_N    : N used in computation
        significant    : True if |t| > 2.0
        highly_sig     : True if |t| > 3.0
    """
    excess = [r - risk_free_daily for r in daily_returns]
    n = len(excess)
    if n < 10:
        return {"error": "Insufficient observations (< 10)"}

    mean_e = _mean(excess)

    # OLS variance
    ols_var = sum((e - mean_e) ** 2 for e in excess) / (n - 1) / n

    # Newey-West HAC: lag = int(4 * (N/100)^(2/9))
    nw_lag = max(1, int(4 * (n / 100) ** (2.0 / 9.0)))

    # Compute autocovariances
    centered = [e - mean_e for e in excess]
    nw_var = sum(c ** 2 for c in centered) / n  # lag-0
    for k in range(1, nw_lag + 1):
        w = 1.0 - k / (nw_lag + 1.0)  # Bartlett kernel
        gamma_k = sum(centered[i] * centered[i - k] for i in range(k, n)) / n
        nw_var += 2 * w * gamma_k

    se_nw = math.sqrt(max(nw_var / n, 1e-30))
    se_ols = math.sqrt(max(ols_var, 1e-30))

    t_stat = mean_e / se_nw if se_nw > 0 else float("nan")

    # Two-tailed p-value via normal approximation (valid for large N)
    p_value = 2.0 * (1.0 - _normal_cdf(abs(t_stat))) if not math.isnan(t_stat) else float("nan")

    return {
        "t_stat": round(t_stat, 4),
        "p_value": round(p_value, 6),
        "mean_excess_daily": round(mean_e, 8),
        "mean_excess_annual": round(mean_e * 252, 6),
        "se_ols": round(se_ols, 8),
        "se_nw": round(se_nw, 8),
        "nw_lag": nw_lag,
        "effective_N": n,
        "significant": not math.isnan(t_stat) and abs(t_stat) > 2.0,
        "highly_significant": not math.isnan(t_stat) and abs(t_stat) > 3.0,
    }


# ---------------------------------------------------------------------------
# 2. Block Bootstrap Sharpe CI  (backtestprep.md §7.2)
# ---------------------------------------------------------------------------

def bootstrap_sharpe(
    daily_returns: list[float],
    n_bootstrap: int = 10_000,
    block_size: int = 21,
    rf: float = 0.02,
    seed: int = 42,
) -> dict[str, Any]:
    """
    Block bootstrap confidence interval for the Sharpe ratio.

    Uses non-overlapping blocks of length `block_size` (default 21 trading
    days ≈ 1 month) to preserve temporal autocorrelation structure
    (backtestprep.md §7.2).

    Returns
    -------
    dict with keys:
        observed_sharpe : Sharpe on original data
        bootstrap_mean  : Mean of bootstrap distribution
        bootstrap_std   : Std of bootstrap distribution
        ci_95_lower     : 2.5th percentile
        ci_95_upper     : 97.5th percentile
        ci_excludes_zero: True if CI does not contain zero
    """
    rng = random.Random(seed)
    n = len(daily_returns)
    if n < block_size * 2:
        return {"error": "Too few observations for block bootstrap"}

    observed_sr = _sharpe(daily_returns, rf)

    # Build list of blocks
    blocks = [daily_returns[i: i + block_size] for i in range(0, n - block_size + 1, block_size)]
    if not blocks:
        return {"error": "No complete blocks available"}

    boot_sharpes: list[float] = []
    for _ in range(n_bootstrap):
        n_blocks = math.ceil(n / block_size)
        sampled_blocks = rng.choices(blocks, k=n_blocks)
        sample = [r for b in sampled_blocks for r in b][:n]
        sr = _sharpe(sample, rf)
        if not math.isnan(sr):
            boot_sharpes.append(sr)

    if not boot_sharpes:
        return {"error": "All bootstrap samples produced NaN Sharpe"}

    boot_sharpes.sort()
    lo_idx = int(len(boot_sharpes) * 0.025)
    hi_idx = int(len(boot_sharpes) * 0.975)
    ci_lo = boot_sharpes[lo_idx]
    ci_hi = boot_sharpes[hi_idx]
    bmean = _mean(boot_sharpes)
    bstd = _std(boot_sharpes)

    return {
        "observed_sharpe": round(observed_sr, 4),
        "bootstrap_mean": round(bmean, 4),
        "bootstrap_std": round(bstd, 4),
        "ci_95_lower": round(ci_lo, 4),
        "ci_95_upper": round(ci_hi, 4),
        "ci_excludes_zero": ci_lo > 0.0,
        "n_bootstrap": len(boot_sharpes),
    }


# ---------------------------------------------------------------------------
# 3. Permutation Test  (backtestprep.md §7.2)
# ---------------------------------------------------------------------------

def permutation_test(
    signals: list[int],
    returns: list[float],
    n_permutations: int = 10_000,
    rf: float = 0.02,
    seed: int = 42,
) -> dict[str, Any]:
    """
    Tests whether the strategy's signal-return alignment is better than random.

    Shuffles the mapping between signals and next-period returns n_permutations
    times and measures how often the random strategy outperforms the actual one
    on Sharpe ratio (backtestprep.md §7.2).

    Parameters
    ----------
    signals  : list[int]  — 1 (long) or 0 (flat) per bar
    returns  : list[float] — next-bar return per bar
    n_permutations : int  — number of random shuffles

    Returns
    -------
    dict with keys:
        observed_sharpe : Sharpe of actual signal-return alignment
        p_value         : fraction of permutations >= observed Sharpe
        significant     : True if p_value < 0.05
    """
    rng = random.Random(seed)
    if len(signals) != len(returns):
        return {"error": "signals and returns must have the same length"}

    # Observed Sharpe: returns weighted by signal
    strategy_returns = [s * r for s, r in zip(signals, returns)]
    observed_sr = _sharpe(strategy_returns, rf)

    # Permutation distribution
    beat_count = 0
    perm_returns = returns[:]
    for _ in range(n_permutations):
        rng.shuffle(perm_returns)
        perm_strategy = [s * r for s, r in zip(signals, perm_returns)]
        perm_sr = _sharpe(perm_strategy, rf)
        if not math.isnan(perm_sr) and perm_sr >= observed_sr:
            beat_count += 1

    p_value = beat_count / n_permutations

    return {
        "observed_sharpe": round(observed_sr, 4),
        "p_value": round(p_value, 4),
        "n_permutations": n_permutations,
        "significant": p_value < 0.05,
        "beat_count": beat_count,
    }


# ---------------------------------------------------------------------------
# 4. Deflated Sharpe Ratio  (backtestprep.md Appendix A)
# ---------------------------------------------------------------------------

def deflated_sharpe_ratio(
    observed_sr: float,
    n_trials: int,
    T: int,
    skew: float,
    excess_kurtosis: float,
    sr_benchmark: float | None = None,
) -> dict[str, Any]:
    """
    Deflated Sharpe Ratio (Bailey & López de Prado, 2012).

    Adjusts the observed Sharpe ratio for the number of strategy trials,
    the length of the track record, and the non-normality of returns.

    Formula (backtestprep.md Appendix A):
        DSR = Φ( (SR_obs - SR_max_expected) * √(T-1) /
                  √(1 - γ₃·SR + (γ₄-1)/4 · SR²) )

    where SR_max_expected is the expected maximum Sharpe from n_trials IID
    draws from a standard normal distribution.

    Parameters
    ----------
    observed_sr       : Annualised Sharpe of the best strategy found
    n_trials          : Total number of strategy variants tested (incl. dead ends)
    T                 : Number of independent return observations
    skew              : Skewness of the strategy's return distribution (γ₃)
    excess_kurtosis   : Excess kurtosis (Fisher, γ₄)
    sr_benchmark      : Optional SR benchmark (default: E[max of n_trials])

    Returns
    -------
    dict with keys:
        dsr             : Deflated Sharpe Ratio (probability that SR > 0)
        p_value         : 1 - DSR (probability of false discovery)
        sr_expected_max : Expected maximum Sharpe from n_trials trials
        passes          : True if DSR > 0.95
    """
    if n_trials <= 0 or T <= 1:
        return {"error": "n_trials and T must be > 1"}

    # Expected maximum Sharpe from n_trials IID draws (approximation)
    # E[max_SR] ≈ (1 - γ)·Z(1-1/N) + γ·Z(1-1/(N·e))  [Bailey & López de Prado]
    # Simpler: use Euler–Mascheroni + normal quantile approximation
    euler_mascheroni = 0.5772156649
    if n_trials > 1:
        inv_norm_approx = math.sqrt(2.0 * math.log(n_trials)) - (
            math.log(math.log(n_trials)) + math.log(4 * math.pi)
        ) / (2.0 * math.sqrt(2.0 * math.log(n_trials)))
        sr_expected_max = inv_norm_approx
    else:
        sr_expected_max = 0.0

    if sr_benchmark is not None:
        sr_expected_max = sr_benchmark

    # Variance of SR estimator accounting for non-normality
    # Var(SR_hat) ≈ (1 - γ₃·SR + (γ₄-1)/4·SR²) / (T-1)
    var_sr = (1.0 - skew * observed_sr + (excess_kurtosis - 1.0) / 4.0 * observed_sr ** 2)
    var_sr = max(var_sr, 1e-8)

    z = (observed_sr - sr_expected_max) * math.sqrt(T - 1) / math.sqrt(var_sr)
    dsr = _normal_cdf(z)
    p_value = 1.0 - dsr

    return {
        "dsr": round(dsr, 6),
        "p_value": round(p_value, 6),
        "sr_expected_max": round(sr_expected_max, 4),
        "z_score": round(z, 4),
        "n_trials": n_trials,
        "T": T,
        "passes": dsr > 0.95,
    }
