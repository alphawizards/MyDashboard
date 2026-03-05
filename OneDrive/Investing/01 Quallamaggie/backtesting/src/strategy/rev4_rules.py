import polars as pl

# ---------------------------------------------------------------------------
# Degrees-of-Freedom Audit  (backtestprep.md §5.1)
# ---------------------------------------------------------------------------
# Total parameters: 17
# Parameters optimized on backtest data: 0
# Parameters fixed from domain knowledge / Pine Script defaults: 17
#
# AUDIT STATEMENT:
#   Every threshold below replicates Kristjan Qullamaggie's published
#   discretionary criteria, translated into quantitative thresholds.
#   None of these values were derived by optimizing historical backtest
#   performance. All originate from the Pine Script Rev4 source of truth
#   (pine scripts/qullamaggie_tradingview_rev4.pine) or documented
#   practitioner consensus.
#
#   If any parameter is subsequently changed based on backtest results,
#   increment TRIAL_COUNTER and apply Deflated Sharpe Ratio correction
#   (see src/analysis/significance.py::deflated_sharpe_ratio).
#
# TRIAL_COUNTER records how many strategy variants have been backtested,
# including dead ends. Honest trial tracking is mandatory for DSR
# correction and multiple-testing control (backtestprep.md §5.5).
# ---------------------------------------------------------------------------

#: Total number of strategy variants tested (including dead ends).
#: Increment this manually whenever PARAMS is changed and re-backtested.
TRIAL_COUNTER: int = 0

# ---------------------------------------------------------------------------
# Rev4 Strategy Parameters — mirrors Pine Script inputs exactly
# ---------------------------------------------------------------------------
# Pine line references annotated for audit traceability.
# ---------------------------------------------------------------------------

PARAMS = {
    # -------------------------------------------------------------------------
    # Phase 1: Universe  (Pine lines 60-64)
    # -------------------------------------------------------------------------

    # Minimum price filter: eliminates sub-penny and micro-cap illiquid names.
    # Justification: Qullamaggie's discretionary minimum; matching IBKR margin
    # eligibility floor. Not derived from backtest optimization.
    "min_price": 5.0,

    # Minimum 20-day average dollar volume (millions).
    # Justification: $10M ADV provides sufficient liquidity for 0.5% risk
    # position sizes on a $100K account without meaningful market impact.
    "min_dol_vol": 10.0,

    # Minimum Average Daily Range (%).
    # Justification: 5% ADR ensures meaningful intraday movement for
    # momentum entries. Below this level, slippage erodes edge.
    "min_adr": 5.0,

    # -------------------------------------------------------------------------
    # Phase 2: Momentum  (Pine lines 68-72)
    # -------------------------------------------------------------------------

    # Momentum normalization mode.
    # "ADR-Normalized": performance / ADR (dimensionless, apples-to-apples
    # across low and high volatility names). Qullamaggie's preferred mode.
    "mom_mode": "ADR-Normalized",

    # 1-month ADR-normalized momentum threshold.
    # Justification: 20/ADR requires ~20% raw return for a 5% ADR stock.
    # Screens for stocks already outperforming on a short-term basis.
    "mom_threshold_1m": 20.0,

    # 3-month ADR-normalized momentum threshold.
    # Justification: 40/ADR. Captures intermediate-term relative strength.
    "mom_threshold_3m": 40.0,

    # 6-month ADR-normalized momentum threshold.
    # Justification: 50/ADR. Screens for names with sustained accumulation.
    "mom_threshold_6m": 50.0,

    # Minimum proximity to 52-week high (%).
    # Justification: Qullamaggie's rule — only trade stocks making or near
    # new highs. 90% ensures the setup is in a leading position, not a
    # recovering laggard with overhead resistance.
    "min_52w_high_pct": 90.0,

    # -------------------------------------------------------------------------
    # Phase 3: Setup Detection  (Pine lines 76-82)
    # -------------------------------------------------------------------------

    # Minimum prior move (%) for Flag/HTF boundary.
    # Justification: 30% prior move is the lower bound for a stock that has
    # built enough momentum to attract institutional interest.
    "min_prior_move": 30.0,

    # Prior move (%) threshold that distinguishes HTF from Flag.
    # Justification: 90%+ prior move defines a "High-Tight Flag" — a more
    # explosive setup that warrants a wider Chandelier lookback (30 vs 20 bars).
    "htf_prior_move": 90.0,

    # Maximum pullback from 60-day high (%) for Flag setups.
    # Justification: 25% allows a moderate consolidation while retaining
    # momentum. Rev4 removed the prior 2% floor (no minimum pullback required).
    "max_pullback": 25.0,

    # Maximum pullback from 60-day high (%) for HTF setups.
    # Justification: Same 25% ceiling. HTF setups typically pull back less
    # but the ceiling is kept equal to avoid over-constraining the filter.
    "htf_max_pullback": 25.0,

    # BBW Bollinger Band Width percentile threshold (%).
    # Justification: 20th percentile (bottom quintile of width over 100 days)
    # identifies maximum compression — the spring coiling before release.
    # Evaluated on prior bar (shift(1)) to avoid breakout bar inflating BBW.
    "bbw_percentile": 20.0,

    # Minimum gap-up (%) for Episodic Pivot (EP) setup.
    # Justification: 10% gap ensures the catalyst (earnings, news, guidance)
    # is large enough to signal a genuine change in market perception.
    "ep_gap_min": 10.0,

    # -------------------------------------------------------------------------
    # Phase 7: Robustness Filters  (Pine lines 106-107)
    # -------------------------------------------------------------------------

    # Regime filter toggle.
    # Justification: Only trade when SPY or QQQ is above its 50-day MA.
    # Prevents long exposure during confirmed downtrends in the broad market.
    "use_regime": True,

    # Minimum up-volume to down-volume ratio (50-day).
    # Justification: 1.2 ratio ensures institutional accumulation dominates
    # distribution over the prior 50 trading days.
    "min_up_vol_ratio": 1.2,
}


def evaluate_setups(df: pl.DataFrame, params: dict | None = None) -> pl.DataFrame:
    """
    Applies the full Rev4 Boolean mask pipeline.

    Returns df with appended columns:
        pass_universe, pass_momentum, pass_52w_high, pass_vol_quality,
        setup_a, setup_b, setup_c, setup_label, pass_universe_full,
        score, grade
    """
    p = params or PARAMS

    # ==================================================================
    # Phase 1: Universe Base  (Pine lines 140-161)
    # ==================================================================
    pass_base_universe = (
        (pl.col("close") >= p["min_price"]) &
        (pl.col("avg_dol_vol_20") >= p["min_dol_vol"]) &
        (pl.col("adr") >= p["min_adr"]) &
        (pl.col("close") > pl.col("ma50"))
    )

    # Volume quality  (Pine lines 154-159)
    pass_vol_quality = pl.col("vol_ratio") >= p["min_up_vol_ratio"]

    # Regime  (Pine line 150) — requires pass_regime from apply_index_features()
    # If pass_regime column doesn't exist yet, default to True (regime disabled).
    if "pass_regime" not in df.columns:
        df = df.with_columns(pl.lit(True).alias("pass_regime"))

    # Full universe = base + regime + vol quality  (Pine line 162)
    pass_universe = pass_base_universe & pl.col("pass_regime") & pass_vol_quality

    # ==================================================================
    # Phase 2: Momentum Gates  (Pine lines 186-200)
    # ==================================================================
    mom_norm = max(p["min_adr"], 1.0)
    use_norm = p["mom_mode"] == "ADR-Normalized"

    if use_norm:
        # ADR-normalized: perf_Xm >= threshold / momNorm
        pass_1m = pl.col("perf_1m") >= (p["mom_threshold_1m"] / mom_norm)
        pass_3m = pl.col("perf_3m") >= (p["mom_threshold_3m"] / mom_norm)
        pass_6m = pl.col("perf_6m") >= (p["mom_threshold_6m"] / mom_norm)
    else:
        # Raw %: perf_Xm_raw >= threshold
        pass_1m = pl.col("perf_1m_raw") >= p["mom_threshold_1m"]
        pass_3m = pl.col("perf_3m_raw") >= p["mom_threshold_3m"]
        pass_6m = pl.col("perf_6m_raw") >= p["mom_threshold_6m"]

    # pass_momentum = at least one timeframe passes  (Pine line 200)
    pass_momentum = pass_1m | pass_3m | pass_6m

    # 52-Week High Proximity  (Pine line 197)
    pass_52w_high = pl.col("pct_52w_high") >= p["min_52w_high_pct"]

    # RS vs SPY  (Pine line 211) — if strong_rs column exists
    if "strong_rs" not in df.columns:
        df = df.with_columns(pl.lit(False).alias("strong_rs"))

    # ==================================================================
    # Phase 3: Setup Detection  (Pine lines 252-283)
    # ==================================================================

    # Price Surfing MAs  (Pine lines 252-254)
    surf_band_lo = pl.max_horizontal(pl.col("adr") * 0.5, pl.lit(3.0)) / 100.0
    surf_band_hi = pl.max_horizontal(pl.col("adr") * 0.75, pl.lit(5.0)) / 100.0
    surfing_mas = (
        (pl.col("close") >= pl.col("ma10") * (1.0 - surf_band_lo)) &
        (pl.col("close") <= pl.col("ma10") * (1.0 + surf_band_hi)) &
        (pl.col("ma10") >= pl.col("ma20"))
    )

    # Vol Dry Up  (Pine line 259)
    vol_dry_up = pl.col("avg_vol_5") < (pl.col("avg_vol_20") * 0.85)

    # BBW Compression — 1-bar lag  (Pine line 240)
    is_consolidating = (
        pl.col("bbw_rank").shift(1).over("ticker") <= p["bbw_percentile"]
    )

    # Pullback Depth — NO FLOOR  (Pine lines 267-268, Rev4 fix)
    # Pass: 0% to ceiling. Evaluated on prior bar [1].
    pullback_lag = pl.col("pullback_from_high").shift(1).over("ticker")
    pass_pullback_a = pullback_lag <= p["max_pullback"]
    pass_pullback_b = pullback_lag <= p["htf_max_pullback"]

    # Setup A (Flag)  (Pine line 272)
    setup_a = (
        (pl.col("prior_move_calc") >= p["min_prior_move"]) &
        (pl.col("prior_move_calc") < p["htf_prior_move"]) &
        is_consolidating &
        pass_pullback_a &
        surfing_mas &
        vol_dry_up &
        pass_universe
    )

    # Setup B (HTF)  (Pine line 273)
    setup_b = (
        (pl.col("prior_move_calc") >= p["htf_prior_move"]) &
        is_consolidating &
        pass_pullback_b &
        surfing_mas &
        vol_dry_up &
        pass_universe
    )

    # Setup C (EP)  (Pine lines 276-280)
    gap_pct = (
        (pl.col("open") - pl.col("close").shift(1).over("ticker"))
        / pl.col("close").shift(1).over("ticker")
        * 100
    )
    is_gap_up = gap_pct >= p["ep_gap_min"]
    gap_volume = pl.col("volume") > (pl.col("avg_vol_20") * 2.0)
    setup_c = is_gap_up & gap_volume & pass_universe

    any_setup = setup_a | setup_b | setup_c

    # Setup label  (Pine line 285)
    setup_label = (
        pl.when(setup_c).then(pl.lit("EP"))
          .when(setup_b).then(pl.lit("HTF"))
          .when(setup_a).then(pl.lit("FLAG"))
          .otherwise(pl.lit("NONE"))
    )

    # ==================================================================
    # 10-Point Scoring System  (Pine lines 589-603)
    # ==================================================================
    # Momentum: +2 if ALL three timeframes pass, +1 if at least one, +0 if none
    all_mom_pass = pass_1m & pass_3m & pass_6m
    mom_points = (
        pl.when(all_mom_pass).then(pl.lit(2))
          .when(pass_momentum).then(pl.lit(1))
          .otherwise(pl.lit(0))
    )

    # Binary gates (1 each)
    has_breakout_or_ep = (
        pl.col("entry_signal").fill_null(False) if "entry_signal" in df.columns
        else pl.lit(False)
    )
    # tradeable + stop valid (simplified — stop validation requires entry context)
    has_tradeable = pl.col("tradeable").fill_null(False) if "tradeable" in df.columns else pl.lit(False)

    score = (
        pl.when(pass_base_universe).then(pl.lit(1)).otherwise(pl.lit(0)) +
        mom_points +
        pl.when(pass_52w_high).then(pl.lit(1)).otherwise(pl.lit(0)) +
        pl.when(pl.col("strong_rs")).then(pl.lit(1)).otherwise(pl.lit(0)) +
        pl.when(any_setup).then(pl.lit(1)).otherwise(pl.lit(0)) +
        pl.when(has_breakout_or_ep).then(pl.lit(1)).otherwise(pl.lit(0)) +
        pl.when(has_tradeable).then(pl.lit(1)).otherwise(pl.lit(0)) +
        pl.when(pl.col("pass_regime")).then(pl.lit(1)).otherwise(pl.lit(0)) +
        pl.when(pass_vol_quality).then(pl.lit(1)).otherwise(pl.lit(0))
    )

    grade = (
        pl.when(score >= 10).then(pl.lit("BUY AGGRESSIVE"))
          .when(score >= 9).then(pl.lit("BUY NOW"))
          .when(score >= 7).then(pl.lit("WATCHLIST"))
          .when(score >= 5).then(pl.lit("STALK"))
          .otherwise(pl.lit("SKIP"))
    )

    # ==================================================================
    # Append all columns
    # ==================================================================
    df = df.with_columns([
        pass_base_universe.alias("pass_base_universe"),
        pass_universe.alias("pass_universe"),
        pass_1m.alias("pass_1m"),
        pass_3m.alias("pass_3m"),
        pass_6m.alias("pass_6m"),
        pass_momentum.alias("pass_momentum"),
        pass_52w_high.alias("pass_52w_high"),
        pass_vol_quality.alias("pass_vol_quality"),
        setup_a.fill_null(False).alias("setup_a"),
        setup_b.fill_null(False).alias("setup_b"),
        setup_c.fill_null(False).alias("setup_c"),
        any_setup.fill_null(False).alias("any_setup"),
        setup_label.alias("setup_label"),
        score.alias("score"),
        grade.alias("grade"),
    ])

    return df
