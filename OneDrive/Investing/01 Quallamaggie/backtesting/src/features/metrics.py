import polars as pl

# ---------------------------------------------------------------------------
# Rev4 Feature Engineering — Pine Script Parity Layer
# ---------------------------------------------------------------------------
# Every formula here maps 1:1 to the Rev4 Pine Script source of truth.
# All rolling/window operations use .over("ticker") for multi-ticker safety.
# Pine line references are annotated inline for audit traceability.
# ---------------------------------------------------------------------------


def apply_all_features(df: pl.DataFrame) -> pl.DataFrame:
    """
    Applies all Rev4 indicator math to the dataframe.
    Assumes df has columns: 'date', 'ticker', 'open', 'high', 'low', 'close', 'volume'
    And is already sorted by ['ticker', 'date'].

    Returns df with ~30 feature columns appended.
    """

    # ------------------------------------------------------------------
    # 1. ADR% & Dollar Volume  (Pine lines 130-133)
    # ------------------------------------------------------------------
    # ADR = 100 * (SMA(high/low, 20) - 1)
    # ADR always uses SMA regardless of global MA toggle (by definition).
    df = df.with_columns([
        (pl.col('volume') * pl.col('close') / 1_000_000)
            .rolling_mean(20).over('ticker').alias('avg_dol_vol_20'),
        (((pl.col('high') / pl.col('low'))
            .rolling_mean(20).over('ticker') - 1.0) * 100).alias('adr'),
    ])

    # safe_adr: floor at 0.1 to prevent division-by-zero (Pine line 176)
    df = df.with_columns(
        pl.max_horizontal(pl.col('adr'), pl.lit(0.1)).alias('safe_adr')
    )

    # ------------------------------------------------------------------
    # 2. Moving Averages — SMA default  (Pine lines 136, 219-220, 257-258)
    # ------------------------------------------------------------------
    df = df.with_columns([
        pl.col('close').rolling_mean(10).over('ticker').alias('ma10'),
        pl.col('close').rolling_mean(20).over('ticker').alias('ma20'),
        pl.col('close').rolling_mean(50).over('ticker').alias('ma50'),
        pl.col('volume').rolling_mean(5).over('ticker').alias('avg_vol_5'),
        pl.col('volume').rolling_mean(20).over('ticker').alias('avg_vol_20'),
    ])

    # ------------------------------------------------------------------
    # 3. Momentum — raw returns  (Pine lines 171-173)
    # ------------------------------------------------------------------
    df = df.with_columns([
        ((pl.col('close') - pl.col('close').shift(21).over('ticker'))
         / pl.col('close').shift(21).over('ticker') * 100).alias('perf_1m_raw'),
        ((pl.col('close') - pl.col('close').shift(63).over('ticker'))
         / pl.col('close').shift(63).over('ticker') * 100).alias('perf_3m_raw'),
        ((pl.col('close') - pl.col('close').shift(126).over('ticker'))
         / pl.col('close').shift(126).over('ticker') * 100).alias('perf_6m_raw'),
    ])

    # ADR-normalized momentum  (Pine lines 178-180)
    # perf_Xm = perf_Xm_raw / safe_adr
    df = df.with_columns([
        (pl.col('perf_1m_raw') / pl.col('safe_adr')).alias('perf_1m'),
        (pl.col('perf_3m_raw') / pl.col('safe_adr')).alias('perf_3m'),
        (pl.col('perf_6m_raw') / pl.col('safe_adr')).alias('perf_6m'),
    ])

    # ------------------------------------------------------------------
    # 4. 52-Week High Proximity  (Pine lines 195-197)
    # ------------------------------------------------------------------
    df = df.with_columns(
        pl.col('high').rolling_max(252).over('ticker').alias('high_52w')
    )
    df = df.with_columns(
        (pl.col('close') / pl.col('high_52w') * 100).alias('pct_52w_high')
    )

    # ------------------------------------------------------------------
    # 5. BBW Compression  (Pine lines 227-233)
    # ------------------------------------------------------------------
    # bb_dev = 2 * stdev(close, 20);  bbw = (2 * bb_dev) / basis = 4*std/sma20
    df = df.with_columns(
        (pl.col('close').rolling_std(20).over('ticker') * 2.0).alias('bb_dev')
    )
    df = df.with_columns(
        (pl.col('bb_dev') * 2.0 / pl.col('ma20')).alias('bbw')
    )

    # BBW Percent Rank (100-day lookback)  (Pine line 233)
    # Pine ta.percentrank(src, len) = (count of values strictly below current / len) * 100.
    # We use rolling_map to implement this exactly: for each 100-bar window, count how
    # many of the prior 99 values are strictly below the current (last) value.
    def _pine_percentrank(s: pl.Series) -> float:
        if len(s) == 0:
            return 0.0
        current = s[-1]
        window = s[:-1]  # exclude current bar, matching Pine's window
        if len(window) == 0:
            return 0.0
        return float((window < current).sum()) / len(window) * 100.0

    df = df.with_columns(
        pl.col('bbw')
            .rolling_map(_pine_percentrank, window_size=100, min_samples=2)
            .over('ticker')
            .alias('bbw_rank')
    )

    # ------------------------------------------------------------------
    # 6. Prior Move & Pullback  (Pine lines 243-247)
    # ------------------------------------------------------------------
    df = df.with_columns([
        pl.col('high').rolling_max(60).over('ticker').alias('highest_60d'),
        pl.col('low').rolling_min(60).over('ticker').alias('lowest_60d'),
    ])
    df = df.with_columns([
        ((pl.col('highest_60d') - pl.col('lowest_60d'))
         / pl.col('lowest_60d') * 100).alias('prior_move_calc'),
        ((pl.col('highest_60d') - pl.col('close'))
         / pl.col('highest_60d') * 100).alias('pullback_from_high'),
    ])

    # ------------------------------------------------------------------
    # 7. True ATR  (Pine line 377: ta.atr(20))
    # ------------------------------------------------------------------
    # ATR = RMA(true_range, 20) where true_range = max(H-L, |H-prevC|, |L-prevC|)
    # Pine's RMA is an exponential moving average with alpha = 1/length.
    # We approximate with EMA(span=20) which uses alpha = 2/(20+1) ≈ 0.095.
    # For exact parity, use ewm(alpha=1/20). Polars ewm_mean supports alpha.
    prev_close = pl.col('close').shift(1).over('ticker')
    true_range = pl.max_horizontal(
        pl.col('high') - pl.col('low'),
        (pl.col('high') - prev_close).abs(),
        (pl.col('low') - prev_close).abs(),
    )
    df = df.with_columns(true_range.alias('true_range'))
    df = df.with_columns(
        pl.col('true_range')
            .ewm_mean(alpha=1.0/20.0, adjust=False, min_samples=20)
            .over('ticker')
            .alias('atr')
    )

    # ------------------------------------------------------------------
    # 8. Volume Quality — Up/Down Volume Ratio  (Pine lines 154-159)
    # ------------------------------------------------------------------
    # upVol = close > close[1] ? volume : 0
    # dnVol = close < close[1] ? volume : 0
    # volRatio = sum(upVol, 50) / sum(dnVol, 50)
    df = df.with_columns([
        pl.when(pl.col('close') > pl.col('close').shift(1).over('ticker'))
          .then(pl.col('volume')).otherwise(0.0).alias('up_vol'),
        pl.when(pl.col('close') < pl.col('close').shift(1).over('ticker'))
          .then(pl.col('volume')).otherwise(0.0).alias('dn_vol'),
    ])
    df = df.with_columns([
        pl.col('up_vol').rolling_sum(50).over('ticker').alias('sum_up_vol_50'),
        pl.col('dn_vol').rolling_sum(50).over('ticker').alias('sum_dn_vol_50'),
    ])
    df = df.with_columns(
        pl.when(pl.col('sum_dn_vol_50') > 0)
          .then(pl.col('sum_up_vol_50') / pl.col('sum_dn_vol_50'))
          .otherwise(1.0)
          .alias('vol_ratio')
    )

    # ------------------------------------------------------------------
    # 9. Phase 4: Entry Signal Features  (Pine lines 295-318)
    # ------------------------------------------------------------------
    # Day change %
    df = df.with_columns(
        ((pl.col('close') - pl.col('close').shift(1).over('ticker'))
         / pl.col('close').shift(1).over('ticker') * 100).alias('day_change_pct')
    )

    # Above previous 2 highs:  high > max(high[1], high[2])
    df = df.with_columns(
        (pl.col('high') > pl.max_horizontal(
            pl.col('high').shift(1).over('ticker'),
            pl.col('high').shift(2).over('ticker'),
        )).alias('above_prev_2_highs')
    )

    # Range expansion:  todayRange >= avg5Range * 0.5  (Pine i_rangeExpMin default = 0.5)
    today_range = pl.col('high') - pl.col('low')
    avg_5_range = (pl.col('high') - pl.col('low')).rolling_mean(5).over('ticker')
    avg_20_range = (pl.col('high') - pl.col('low')).rolling_mean(20).over('ticker')
    df = df.with_columns([
        today_range.alias('today_range'),
        avg_5_range.alias('avg_5_range'),
        avg_20_range.alias('avg_20_range'),
    ])
    df = df.with_columns([
        (pl.col('today_range') >= pl.col('avg_5_range') * 0.5).alias('range_expansion'),
        # Not over-extended:  (close - low) < avg20Range * 1.5  (Pine i_rangeExpMax default = 1.5)
        ((pl.col('close') - pl.col('low')) < pl.col('avg_20_range') * 1.5).alias('not_over_extended'),
    ])

    # Volume surge:  volume >= avg_vol_20 * 1.5  (Pine i_volMultiple default = 1.5)
    # For daily bars (EOD backtest), no RVOL time-of-day adjustment needed.
    df = df.with_columns([
        (pl.col('volume') >= pl.col('avg_vol_20') * 1.5).alias('vol_surge_strict'),
        (pl.col('volume') >= pl.col('avg_vol_20') * 0.75).alias('vol_surge_early'),
    ])

    # ADR tradeable check  (Pine lines 325-326)
    # (close - low) < close * adr / 100
    df = df.with_columns(
        ((pl.col('close') - pl.col('low')) < (pl.col('close') * pl.col('adr') / 100))
            .alias('tradeable')
    )

    # ------------------------------------------------------------------
    # 10. Dynamic Slippage Heuristic  (backtestprep.md §4.2)
    # ------------------------------------------------------------------
    # Estimate bid-ask half-spread as a function of liquidity (avg_dol_vol_20)
    # and volatility (adr).  Less liquid + more volatile → higher slippage.
    # Backtester uses this column if present; falls back to flat rate otherwise.
    #
    # Tier thresholds (avg_dol_vol_20 in $M):
    #   >= $500M ADV  →  2 bps base   (mega-cap, tight spread)
    #   >= $100M ADV  →  5 bps base   (large-cap)
    #   >= $20M  ADV  → 10 bps base   (mid-cap)
    #   <  $20M  ADV  → 20 bps base   (small-cap, wide spread)
    # Volatility scalar: (adr / 5.0).clip(0.5, 3.0)
    #   ADR = 5%  → scalar = 1.0 (no change)
    #   ADR = 10% → scalar = 2.0 (double)
    #   ADR = 2%  → scalar = 0.5 (floor)
    df = df.with_columns(
        (
            pl.when(pl.col('avg_dol_vol_20') >= 500).then(pl.lit(2.0))
              .when(pl.col('avg_dol_vol_20') >= 100).then(pl.lit(5.0))
              .when(pl.col('avg_dol_vol_20') >= 20).then(pl.lit(10.0))
              .otherwise(pl.lit(20.0))
            * (pl.col('adr') / 5.0).clip(0.5, 3.0)
        ).alias('est_slippage_bps')
    )

    return df


def apply_index_features(df: pl.DataFrame, index_df: pl.DataFrame) -> pl.DataFrame:
    """
    Joins index (SPY/QQQ) data and computes:
      - Regime filter: SPY > MA50 OR QQQ > MA50  (Pine line 150)
      - RS vs SPY: stock raw return - SPY raw return  (Pine lines 207-211)

    Parameters:
        df: main equity DataFrame with 'date', 'ticker', and all features
        index_df: DataFrame with 'date', 'ticker', 'close' for SPY and QQQ

    Returns:
        df with 'pass_regime', 'rs_vs_index_1m', 'rs_vs_index_3m', 'strong_rs' appended.
    """
    # --- Compute index MAs and momentum ---
    index_df = index_df.sort(['ticker', 'date'])
    index_df = index_df.with_columns([
        pl.col('close').rolling_mean(50).over('ticker').alias('index_ma50'),
        ((pl.col('close') - pl.col('close').shift(21).over('ticker'))
         / pl.col('close').shift(21).over('ticker') * 100).alias('index_perf_1m'),
        ((pl.col('close') - pl.col('close').shift(63).over('ticker'))
         / pl.col('close').shift(63).over('ticker') * 100).alias('index_perf_3m'),
    ])

    # --- Regime: SPY > MA50 OR QQQ > MA50 ---
    spy = (index_df
           .filter(pl.col('ticker') == 'SPY')
           .select(['date',
                    (pl.col('close') > pl.col('index_ma50')).alias('spy_bullish'),
                    pl.col('index_perf_1m').alias('spy_perf_1m'),
                    pl.col('index_perf_3m').alias('spy_perf_3m')]))

    qqq = (index_df
           .filter(pl.col('ticker') == 'QQQ')
           .select(['date',
                    (pl.col('close') > pl.col('index_ma50')).alias('qqq_bullish')]))

    regime = spy.join(qqq, on='date', how='left')
    regime = regime.with_columns(
        (pl.col('spy_bullish').fill_null(False) | pl.col('qqq_bullish').fill_null(False))
            .alias('pass_regime')
    )

    # --- Join regime + SPY momentum onto main df ---
    df = df.join(
        regime.select(['date', 'pass_regime', 'spy_perf_1m', 'spy_perf_3m']),
        on='date',
        how='left',
    )
    df = df.with_columns([
        pl.col('pass_regime').fill_null(False),
        pl.col('spy_perf_1m').fill_null(0.0),
        pl.col('spy_perf_3m').fill_null(0.0),
    ])

    # --- RS vs SPY  (Pine lines 209-211) ---
    # Computed from RAW (non-normalized) returns for dimensional consistency.
    df = df.with_columns([
        (pl.col('perf_1m_raw') - pl.col('spy_perf_1m')).alias('rs_vs_index_1m'),
        (pl.col('perf_3m_raw') - pl.col('spy_perf_3m')).alias('rs_vs_index_3m'),
    ])
    df = df.with_columns(
        ((pl.col('rs_vs_index_1m') > 0) & (pl.col('rs_vs_index_3m') > 0))
            .alias('strong_rs')
    )

    return df
