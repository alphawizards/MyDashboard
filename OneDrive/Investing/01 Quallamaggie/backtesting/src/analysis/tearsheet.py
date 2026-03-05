"""
Institutional-Grade Tearsheet  (backtestprep.md §6.1–6.5)
==========================================================
Computes 25+ metrics from a trade log and daily equity curve.
Returns a structured dict for programmatic access and IS/OOS comparison.
"""

import math
from typing import Any

import polars as pl
from loguru import logger


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def _annualised_sharpe(returns: list[float], risk_free: float = 0.02) -> float:
    """Annualised Sharpe ratio from a list of period returns."""
    if len(returns) < 2:
        return float("nan")
    n = len(returns)
    mean = sum(returns) / n
    var = sum((r - mean) ** 2 for r in returns) / (n - 1)
    std = math.sqrt(var) if var > 0 else 0.0
    ann_mean = mean * 252
    ann_std = std * math.sqrt(252)
    return (ann_mean - risk_free) / ann_std if ann_std > 0 else float("nan")


def _downside_deviation(returns: list[float], target: float = 0.0) -> float:
    """Annualised downside deviation below target."""
    neg = [(r - target) for r in returns if r < target]
    if len(neg) < 2:
        return float("nan")
    var = sum(x ** 2 for x in neg) / len(neg)
    return math.sqrt(var * 252)


def _max_drawdown(equity: list[float]) -> tuple[float, int]:
    """
    Returns (max_drawdown_pct, max_drawdown_duration_days).
    Drawdown is expressed as a negative fraction (e.g. -0.25 = -25%).
    """
    if len(equity) < 2:
        return 0.0, 0

    peak = equity[0]
    max_dd = 0.0
    max_dur = 0
    drawdown_start = 0

    for i, val in enumerate(equity):
        if val > peak:
            peak = val
            drawdown_start = i
        dd = (val - peak) / peak if peak > 0 else 0.0
        if dd < max_dd:
            max_dd = dd
            max_dur = i - drawdown_start

    return max_dd, max_dur


def _cagr(initial: float, final: float, trading_days: int) -> float:
    if trading_days <= 0 or initial <= 0 or final <= 0:
        return float("nan")
    years = trading_days / 252.0
    return (final / initial) ** (1.0 / years) - 1.0


def _percentile(data: list[float], p: float) -> float:
    """p-th percentile of sorted data."""
    if not data:
        return float("nan")
    s = sorted(data)
    idx = (len(s) - 1) * p
    lo = int(idx)
    hi = lo + 1
    frac = idx - lo
    if hi >= len(s):
        return s[-1]
    return s[lo] * (1 - frac) + s[hi] * frac


def _skewness(data: list[float]) -> float:
    n = len(data)
    if n < 3:
        return float("nan")
    mean = sum(data) / n
    std = math.sqrt(sum((x - mean) ** 2 for x in data) / (n - 1))
    if std == 0:
        return 0.0
    return sum(((x - mean) / std) ** 3 for x in data) * n / ((n - 1) * (n - 2))


def _kurtosis(data: list[float]) -> float:
    """Excess kurtosis (Fisher definition, 0 for normal)."""
    n = len(data)
    if n < 4:
        return float("nan")
    mean = sum(data) / n
    std = math.sqrt(sum((x - mean) ** 2 for x in data) / (n - 1))
    if std == 0:
        return 0.0
    k = sum(((x - mean) / std) ** 4 for x in data)
    return k * n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)) - 3.0 * (n - 1) ** 2 / ((n - 2) * (n - 3))


def calculate_sharpe_ratio(returns: pl.Series, risk_free_rate: float = 0.02) -> float:
    """Annualised Sharpe Ratio (kept for backward compatibility)."""
    return _annualised_sharpe(returns.to_list(), risk_free_rate)


def calculate_kelly_fraction(win_rate: float, win_loss_ratio: float) -> float:
    """
    Kelly Criterion: f* = p - q/b
    p = win probability, q = 1-p, b = avg_win/avg_loss
    """
    if win_loss_ratio <= 0:
        return 0.0
    return win_rate - (1 - win_rate) / win_loss_ratio


# ---------------------------------------------------------------------------
# Main report generator
# ---------------------------------------------------------------------------

def generate_report(
    trade_log: pl.DataFrame,
    equity_curve: pl.DataFrame | None = None,
    risk_free: float = 0.02,
    initial_capital: float = 100_000.0,
    label: str = "FULL PERIOD",
) -> dict[str, Any]:
    """
    Generates an institutional-grade tearsheet (backtestprep.md §6.1–6.5).

    Parameters
    ----------
    trade_log : pl.DataFrame
        Output of Backtester.run_vectorized(). Must have columns:
        entry_date, exit_date, net_pnl, gross_pnl, pnl_pct, net_pnl_pct,
        shares, capital_required, total_costs.
    equity_curve : pl.DataFrame, optional
        Daily equity snapshots with columns: date, equity.
    risk_free : float
        Annual risk-free rate (default 2%).
    initial_capital : float
        Starting capital for CAGR computation.
    label : str
        Period label for logging (e.g. "IN-SAMPLE", "OUT-OF-SAMPLE").

    Returns
    -------
    dict
        All computed metrics, keyed for programmatic access and IS/OOS comparison.
    """
    logger.info(f"--- QULLAMAGGIE REV4 TEARSHEET [{label}] ---")

    metrics: dict[str, Any] = {}

    if trade_log is None or len(trade_log) == 0:
        logger.warning(f"[{label}] No trades generated.")
        return metrics

    # ------------------------------------------------------------------
    # Trade statistics  (backtestprep.md §6.4)
    # ------------------------------------------------------------------
    total_trades = len(trade_log)
    net_pnls = trade_log["net_pnl"].to_list() if "net_pnl" in trade_log.columns \
        else trade_log["pnl_pct"].to_list()

    winners = [p for p in net_pnls if p > 0]
    losers  = [p for p in net_pnls if p <= 0]
    win_rate = len(winners) / total_trades if total_trades > 0 else 0.0

    avg_win  = sum(winners) / len(winners) if winners else 0.0
    avg_loss = abs(sum(losers) / len(losers)) if losers else 0.0

    gross_profit = sum(winners)
    gross_loss   = abs(sum(losers))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    expectancy = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)
    kelly = calculate_kelly_fraction(win_rate, avg_win / avg_loss if avg_loss > 0 else 0.0)

    # Holding periods
    if "entry_date" in trade_log.columns and "exit_date" in trade_log.columns:
        holding_days_col = (
            pl.col("exit_date").cast(pl.Date) - pl.col("entry_date").cast(pl.Date)
        ).dt.total_days()
        holding_days = trade_log.with_columns(holding_days_col.alias("hd"))["hd"].to_list()
        avg_holding_days = sum(holding_days) / len(holding_days) if holding_days else 0.0
    else:
        avg_holding_days = float("nan")

    # Consecutive win/loss streaks
    max_win_streak = max_loss_streak = cur_w = cur_l = 0
    for p in net_pnls:
        if p > 0:
            cur_w += 1
            cur_l = 0
        else:
            cur_l += 1
            cur_w = 0
        max_win_streak  = max(max_win_streak, cur_w)
        max_loss_streak = max(max_loss_streak, cur_l)

    # Total costs
    total_costs_sum = trade_log["total_costs"].sum() if "total_costs" in trade_log.columns else 0.0

    # ------------------------------------------------------------------
    # Equity curve and return series  (backtestprep.md §6.1–6.3)
    # ------------------------------------------------------------------
    if equity_curve is not None and len(equity_curve) > 0:
        equity_vals = equity_curve["equity"].to_list()
    else:
        # Reconstruct running equity from trade log if no curve provided
        equity_vals = [initial_capital]
        running = initial_capital
        for pnl in net_pnls:
            running += pnl
            equity_vals.append(running)

    final_equity = equity_vals[-1] if equity_vals else initial_capital
    trading_days = len(equity_vals)
    total_return = (final_equity / initial_capital) - 1.0

    # Daily returns from equity curve
    daily_returns = [
        (equity_vals[i] - equity_vals[i - 1]) / equity_vals[i - 1]
        for i in range(1, len(equity_vals))
        if equity_vals[i - 1] > 0
    ]

    cagr = _cagr(initial_capital, final_equity, trading_days)
    ann_vol = math.sqrt(sum(r ** 2 for r in daily_returns) / max(len(daily_returns) - 1, 1)) * math.sqrt(252) \
        if len(daily_returns) > 1 else float("nan")

    sharpe  = _annualised_sharpe(daily_returns, risk_free)
    sortino_dd = _downside_deviation(daily_returns)
    sortino = (cagr - risk_free) / sortino_dd if sortino_dd and sortino_dd > 0 else float("nan")

    max_dd, max_dd_dur = _max_drawdown(equity_vals)
    calmar = cagr / abs(max_dd) if max_dd < 0 else float("nan")

    # VaR / CVaR  (historical simulation)
    var_95 = _percentile(daily_returns, 0.05) if daily_returns else float("nan")
    var_99 = _percentile(daily_returns, 0.01) if daily_returns else float("nan")
    cvar_95 = (sum(r for r in daily_returns if r <= var_95) / max(sum(1 for r in daily_returns if r <= var_95), 1)) \
        if daily_returns else float("nan")

    # Skewness, kurtosis, tail ratio
    skew = _skewness(daily_returns) if daily_returns else float("nan")
    kurt = _kurtosis(daily_returns) if daily_returns else float("nan")
    p95 = _percentile(daily_returns, 0.95) if daily_returns else float("nan")
    p05 = _percentile(daily_returns, 0.05) if daily_returns else float("nan")
    tail_ratio = abs(p95 / p05) if p05 and p05 != 0 else float("nan")

    # Turnover (total value traded / average equity)
    if "capital_required" in trade_log.columns:
        total_traded = float(trade_log["capital_required"].sum()) * 2  # entry + exit
        avg_equity = (initial_capital + final_equity) / 2
        turnover = total_traded / avg_equity if avg_equity > 0 else float("nan")
    else:
        turnover = float("nan")

    # ------------------------------------------------------------------
    # Assemble metrics dict
    # ------------------------------------------------------------------
    metrics = {
        # Returns
        "total_return_pct": round(total_return * 100, 2),
        "cagr_pct": round(cagr * 100, 2),
        "ann_vol_pct": round(ann_vol * 100, 2) if not math.isnan(ann_vol) else float("nan"),
        # Risk-adjusted
        "sharpe": round(sharpe, 2) if not math.isnan(sharpe) else float("nan"),
        "sortino": round(sortino, 2) if not math.isnan(sortino) else float("nan"),
        "calmar": round(calmar, 2) if not math.isnan(calmar) else float("nan"),
        # Drawdown
        "max_drawdown_pct": round(max_dd * 100, 2),
        "max_drawdown_duration_days": max_dd_dur,
        # Risk metrics
        "var_95_pct": round(var_95 * 100, 3) if not math.isnan(var_95) else float("nan"),
        "var_99_pct": round(var_99 * 100, 3) if not math.isnan(var_99) else float("nan"),
        "cvar_95_pct": round(cvar_95 * 100, 3) if not math.isnan(cvar_95) else float("nan"),
        "skewness": round(skew, 3) if not math.isnan(skew) else float("nan"),
        "kurtosis": round(kurt, 3) if not math.isnan(kurt) else float("nan"),
        "tail_ratio": round(tail_ratio, 3) if not math.isnan(tail_ratio) else float("nan"),
        # Trade statistics
        "total_trades": total_trades,
        "win_rate_pct": round(win_rate * 100, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "profit_factor": round(profit_factor, 2),
        "expectancy": round(expectancy, 2),
        "kelly_fraction": round(kelly, 4),
        "avg_holding_days": round(avg_holding_days, 1),
        "max_win_streak": max_win_streak,
        "max_loss_streak": max_loss_streak,
        "total_costs": round(total_costs_sum, 2),
        # Execution feasibility
        "turnover": round(turnover, 2) if not math.isnan(turnover) else float("nan"),
        "final_equity": round(final_equity, 2),
        "initial_capital": initial_capital,
    }

    # ------------------------------------------------------------------
    # Print summary
    # ------------------------------------------------------------------
    logger.info(f"{'='*50}")
    logger.info(f"TOTAL TRADES:        {total_trades}")
    logger.info(f"WIN RATE:            {win_rate:.2%}")
    logger.info(f"PROFIT FACTOR:       {profit_factor:.2f}")
    logger.info(f"EXPECTANCY:          ${expectancy:,.2f}")
    logger.info(f"{'─'*50}")
    logger.info(f"TOTAL RETURN:        {total_return:.2%}")
    logger.info(f"CAGR:                {cagr:.2%}")
    logger.info(f"ANN. VOLATILITY:     {ann_vol:.2%}" if not math.isnan(ann_vol) else "ANN. VOLATILITY:     N/A")
    logger.info(f"SHARPE RATIO:        {sharpe:.2f}" if not math.isnan(sharpe) else "SHARPE RATIO:        N/A")
    logger.info(f"SORTINO RATIO:       {sortino:.2f}" if not math.isnan(sortino) else "SORTINO RATIO:       N/A")
    logger.info(f"CALMAR RATIO:        {calmar:.2f}" if not math.isnan(calmar) else "CALMAR RATIO:        N/A")
    logger.info(f"{'─'*50}")
    logger.info(f"MAX DRAWDOWN:        {max_dd:.2%}")
    logger.info(f"MAX DD DURATION:     {max_dd_dur} days")
    logger.info(f"{'─'*50}")
    logger.info(f"VaR (95%):           {var_95:.3%}" if not math.isnan(var_95) else "VaR (95%):           N/A")
    logger.info(f"CVaR (95%):          {cvar_95:.3%}" if not math.isnan(cvar_95) else "CVaR (95%):          N/A")
    logger.info(f"SKEWNESS:            {skew:.3f}" if not math.isnan(skew) else "SKEWNESS:            N/A")
    logger.info(f"KURTOSIS (excess):   {kurt:.3f}" if not math.isnan(kurt) else "KURTOSIS:            N/A")
    logger.info(f"TAIL RATIO:          {tail_ratio:.3f}" if not math.isnan(tail_ratio) else "TAIL RATIO:          N/A")
    logger.info(f"{'─'*50}")
    logger.info(f"AVG HOLDING (days):  {avg_holding_days:.1f}")
    logger.info(f"MAX WIN STREAK:      {max_win_streak}")
    logger.info(f"MAX LOSS STREAK:     {max_loss_streak}")
    logger.info(f"TOTAL COSTS:         ${total_costs_sum:,.2f}")
    logger.info(f"KELLY FRACTION:      {kelly:.4f}")
    logger.info(f"FINAL EQUITY:        ${final_equity:,.2f}")

    # Sharpe sanity check
    if not math.isnan(sharpe) and sharpe > 2.5:
        logger.warning(
            f"Sharpe {sharpe:.2f} > 2.5 — verify for look-ahead bias or overfitting "
            f"(backtestprep.md §15 red flags)."
        )

    return metrics
