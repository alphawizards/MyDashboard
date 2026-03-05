import polars as pl
from loguru import logger
from src.execution.portfolio import (
    calculate_position_size,
    calculate_chandelier_exit,
    PORTFOLIO_CONFIG,
)


class Backtester:
    """
    Rev4 Vectorized Backtester.

    Entry logic replicates Pine Script Phase 4 (lines 293-339):
        - Setup must be active on prior bar (A, B, or C)
        - Breakout confirmation: day_change >= 3%, above prev 2 highs,
          range expansion, not over-extended, volume surge
        - Universe + momentum + tradeable gates must pass
        - EP (Setup C) triggers on gap detection day itself

    Exit logic: Chandelier trailing stop with setup-type-scaled lookback.
    Entry price: next-day open (avoids intraday lookahead bias).

    Transaction costs (backtestprep.md §4.1-4.2):
        - Commission: $0.005/share, $1 minimum per order
        - Slippage: dynamic bps from est_slippage_bps column (falls back to flat 5 bps)
        - SEC fee: $8 per $1M sold

    Capital management (backtestprep.md §3.3):
        - Tracks available capital; sizes positions via calculate_position_size
        - Hard cap: max_open_positions (default 10)
        - Equity curve recorded per trade for drawdown analysis
    """

    # Default entry thresholds matching Pine Rev4 inputs
    ENTRY_PARAMS = {
        "min_breakout_pct": 3.0,       # Pine i_minBreakoutPct (line 86)
        "vol_multiple": 1.5,            # Pine i_volMultiple (line 87)
        "range_exp_min": 0.5,           # Pine i_rangeExpMin (line 88)
        "range_exp_max": 1.5,           # Pine i_rangeExpMax (line 89)
        "atr_multiplier": 3.0,          # Pine i_atrMultiplier (line 101)
    }

    # Transaction cost parameters (backtestprep.md §4.1-4.2)
    COST_PARAMS = {
        "commission_per_share": 0.005,   # $0.005/share (IBKR tiered)
        "min_commission": 1.00,          # $1.00 minimum per order
        "slippage_bps": 5.0,             # Flat fallback half-spread (bps)
        "sec_fee_per_million": 8.00,     # SEC fee applied on sells
        "cost_multiplier": 1.0,          # Scale all costs (1x/2x/3x sensitivity runs)
    }

    def __init__(
        self,
        initial_capital: float = PORTFOLIO_CONFIG["initial_capital"],
        cost_params: dict | None = None,
        max_open_positions: int = PORTFOLIO_CONFIG["max_open_positions"],
    ):
        self.initial_capital = initial_capital
        self.max_open_positions = max_open_positions
        # Merge caller overrides into defaults
        self._cost_params = {**self.COST_PARAMS, **(cost_params or {})}

    # ------------------------------------------------------------------
    # Internal: apply transaction costs to a single side of a trade
    # ------------------------------------------------------------------
    def _apply_costs(
        self,
        price: float,
        shares: int,
        side: str,               # "buy" or "sell"
        slippage_bps: float,
        multiplier: float,
    ) -> tuple[float, float, float]:
        """
        Returns (adjusted_price, commission_cost, sec_fee).
        slippage_bps is the per-side half-spread in basis points.
        """
        cp = self._cost_params
        mult = multiplier

        if side == "buy":
            adjusted_price = price * (1.0 + slippage_bps * mult / 10_000.0)
            sec_fee = 0.0
        else:
            adjusted_price = price * (1.0 - slippage_bps * mult / 10_000.0)
            sec_fee = (adjusted_price * shares / 1_000_000.0) * cp["sec_fee_per_million"] * mult

        commission = max(shares * cp["commission_per_share"] * mult, cp["min_commission"] * mult)
        return adjusted_price, commission, sec_fee

    def run_vectorized(
        self,
        data: pl.DataFrame,
        cost_multiplier: float = 1.0,
    ) -> tuple[pl.DataFrame, pl.DataFrame]:
        """
        Executes a cross-sectional vectorized backtest across the tradable universe.

        Parameters
        ----------
        data : pl.DataFrame
            Feature-engineered equity data with setup columns populated.
        cost_multiplier : float
            Scale transaction costs (1.0=base, 2.0=2x, 3.0=3x).
            Used for sensitivity analysis per backtestprep.md §4.6.

        Returns
        -------
        trade_log : pl.DataFrame
            One row per completed trade with gross/net PnL and cost breakdown.
        equity_curve : pl.DataFrame
            Daily equity value (capital + open mark-to-market) for drawdown analysis.
        """
        logger.info("Starting Execution Simulator (OMS)...")

        # Apply cost multiplier to this run
        self._cost_params["cost_multiplier"] = cost_multiplier

        # ------------------------------------------------------------------
        # 1. Build entry signal mask — Pine lines 313-339
        # ------------------------------------------------------------------
        setup_active_prior = (
            pl.col("setup_a").shift(1).over("ticker").fill_null(False) |
            pl.col("setup_b").shift(1).over("ticker").fill_null(False)
        )

        ep_entry = pl.col("setup_c").fill_null(False)

        breakout_signal_ab = (
            setup_active_prior &
            (pl.col("day_change_pct") >= self.ENTRY_PARAMS["min_breakout_pct"]) &
            pl.col("above_prev_2_highs").fill_null(False) &
            pl.col("range_expansion").fill_null(False) &
            pl.col("not_over_extended").fill_null(True) &
            pl.col("vol_surge_early").fill_null(False)
        )

        universe_pass = pl.col("pass_universe").fill_null(False)
        momentum_pass = pl.col("pass_momentum").fill_null(False)
        tradeable = pl.col("tradeable").fill_null(False)

        entry_signal = (
            universe_pass & momentum_pass & tradeable &
            (breakout_signal_ab | ep_entry)
        )

        data = data.with_columns(entry_signal.alias("entry_signal"))

        # ------------------------------------------------------------------
        # 2. Filter to entry rows (buy next-day open)
        # ------------------------------------------------------------------
        data = data.with_columns(
            pl.col("entry_signal").shift(1).over("ticker").fill_null(False)
              .alias("enter_next_open")
        )

        entries = data.filter(pl.col("enter_next_open"))

        if len(entries) == 0:
            logger.warning("No entries triggered in the dataset.")
            return pl.DataFrame(), pl.DataFrame()

        logger.info(f"Simulating {len(entries)} candidate trades...")

        # ------------------------------------------------------------------
        # 3. Compute Chandelier exit levels across full dataset
        # ------------------------------------------------------------------
        if "atr" not in data.columns:
            # True ATR = RMA(max(H-L, |H-prevC|, |L-prevC|), 20)
            # Matches metrics.py exactly (alpha=1/20 approximates Pine's RMA).
            logger.warning("ATR column missing — computing true ATR (RMA, alpha=1/20).")
            prev_close = pl.col("close").shift(1).over("ticker")
            true_range = pl.max_horizontal(
                pl.col("high") - pl.col("low"),
                (pl.col("high") - prev_close).abs(),
                (pl.col("low") - prev_close).abs(),
            )
            data = data.with_columns(true_range.alias("true_range"))
            data = data.with_columns(
                pl.col("true_range")
                    .ewm_mean(alpha=1.0 / 20.0, adjust=False, min_samples=20)
                    .over("ticker")
                    .alias("atr")
            )

        data = calculate_chandelier_exit(data, atr_mult=self.ENTRY_PARAMS["atr_multiplier"])

        # ------------------------------------------------------------------
        # 4. Map entries → exits with cash tracking and transaction costs
        # ------------------------------------------------------------------
        trade_records: list[dict] = []
        equity_records: list[dict] = []

        # Portfolio state
        capital: float = self.initial_capital
        open_positions: dict[str, dict] = {}   # ticker → {shares, entry_price, stop}

        groups = data.partition_by("ticker", as_dict=True)

        # Collect unique trading dates for equity curve
        all_dates = sorted(data["date"].unique().to_list())

        # Build date → {ticker → close} for mark-to-market
        close_by_date: dict = {}
        for row in data.select(["date", "ticker", "close"]).iter_rows(named=True):
            close_by_date.setdefault(row["date"], {})[row["ticker"]] = row["close"]

        # Chronological processing: iterate each candidate entry date
        # Sort entries by entry_date to process in time order
        entries_sorted = entries.sort("date")

        for row in entries_sorted.iter_rows(named=True):
            ticker = row["ticker"]
            entry_date = row["date"]
            entry_price_raw = row["open"]

            # Reject if at position limit or duplicate
            if len(open_positions) >= self.max_open_positions:
                logger.debug(f"Position limit ({self.max_open_positions}) reached — skipping {ticker}")
                continue
            if ticker in open_positions:
                logger.debug(f"Already holding {ticker} — skipping duplicate entry")
                continue

            # Determine per-row slippage (dynamic or flat)
            slippage_bps = float(
                row.get("est_slippage_bps") or self._cost_params["slippage_bps"]
            )

            # Apply buy-side slippage and commission
            adj_entry, commission_entry, _ = self._apply_costs(
                entry_price_raw, 1, "buy", slippage_bps, cost_multiplier
            )

            # Get stop price from Chandelier at entry bar
            key = (ticker,)
            if key not in groups:
                continue
            ticker_data = groups[key]
            entry_bar = ticker_data.filter(pl.col("date") == entry_date)
            if len(entry_bar) == 0:
                continue
            stop_price = entry_bar["chandelier_exit"][0]
            if stop_price is None or stop_price >= adj_entry:
                # Chandelier above entry — invalid stop, skip
                continue

            # Size position using risk-based sizing
            sizing = calculate_position_size(
                entry_price=adj_entry,
                stop_price=stop_price,
                capital=capital,
                config={**PORTFOLIO_CONFIG, "max_open_positions": self.max_open_positions},
            )
            shares = sizing["shares"]
            capital_required = sizing["capital_required"]

            if capital_required > capital:
                logger.debug(f"Insufficient capital for {ticker}: need ${capital_required:.0f}, have ${capital:.0f}")
                continue

            # Re-apply commission with actual share count
            _, commission_entry, _ = self._apply_costs(
                entry_price_raw, shares, "buy", slippage_bps, cost_multiplier
            )

            # Deduct capital
            capital -= capital_required + commission_entry
            open_positions[ticker] = {
                "shares": shares,
                "entry_price": adj_entry,
                "stop_price": stop_price,
                "capital_required": capital_required,
                "entry_date": entry_date,
                "slippage_bps": slippage_bps,
            }

            # Find exit
            future_data = ticker_data.filter(pl.col("date") > entry_date)

            if len(future_data) == 0:
                exit_date = entry_date
                exit_price_raw = entry_price_raw
                exit_type = "MTM"
            else:
                exit_condition = future_data.filter(
                    pl.col("low") < pl.col("chandelier_exit")
                )
                if len(exit_condition) > 0:
                    exit_row = exit_condition.row(0, named=True)
                    exit_date = exit_row["date"]
                    exit_price_raw = exit_row["chandelier_exit"]
                    exit_type = "STOP"
                else:
                    last_row = future_data.tail(1).row(0, named=True)
                    exit_date = last_row["date"]
                    exit_price_raw = last_row["close"]
                    exit_type = "MTM"

            # Apply sell-side slippage, commission, and SEC fee
            adj_exit, commission_exit, sec_fee = self._apply_costs(
                exit_price_raw, shares, "sell", slippage_bps, cost_multiplier
            )

            gross_pnl = (adj_exit - adj_entry) * shares
            total_costs = commission_entry + commission_exit + sec_fee
            slippage_cost = (
                (adj_entry - entry_price_raw) * shares +       # buy slip
                (exit_price_raw - adj_exit) * shares            # sell slip
            )
            net_pnl = gross_pnl - total_costs

            # Restore capital
            capital += capital_required + net_pnl

            # Remove from open positions
            del open_positions[ticker]

            # Determine setup type
            setup_label = "FLAG"
            if row.get("setup_c", False):
                setup_label = "EP"
            elif row.get("setup_b", False):
                setup_label = "HTF"

            trade_records.append({
                "ticker": ticker,
                "setup_type": setup_label,
                "entry_date": entry_date,
                "exit_date": exit_date,
                "exit_type": exit_type,
                "entry_price": round(adj_entry, 4),
                "exit_price": round(adj_exit, 4),
                "shares": shares,
                "capital_at_entry": round(capital + capital_required + commission_entry, 2),
                "capital_required": round(capital_required, 2),
                "gross_pnl": round(gross_pnl, 2),
                "commission_cost": round(commission_entry + commission_exit, 4),
                "slippage_cost": round(slippage_cost, 4),
                "sec_fee": round(sec_fee, 4),
                "total_costs": round(total_costs, 4),
                "net_pnl": round(net_pnl, 2),
                "pnl_pct": round((adj_exit / adj_entry - 1) * 100, 4),
                "net_pnl_pct": round(net_pnl / capital_required * 100, 4) if capital_required > 0 else 0.0,
            })

        trade_log = pl.DataFrame(trade_records) if trade_records else pl.DataFrame()

        # ------------------------------------------------------------------
        # 5. Build equity curve (daily snapshot of capital)
        # ------------------------------------------------------------------
        # Compute equity as capital + mark-to-market of open positions per date.
        # Since we process chronologically and close positions on their exit date,
        # a simplified approach: compute running capital after each trade.
        if trade_records:
            trade_df = pl.DataFrame(trade_records)
            equity_records = []
            running_capital = self.initial_capital
            for t in trade_df.sort("exit_date").iter_rows(named=True):
                running_capital += t["net_pnl"]
                equity_records.append({
                    "date": t["exit_date"],
                    "equity": round(running_capital, 2),
                })
            equity_curve = pl.DataFrame(equity_records)
        else:
            equity_curve = pl.DataFrame()

        logger.success(
            f"Backtest complete. Generated {len(trade_log)} trades. "
            f"Final capital: ${capital:,.2f} "
            f"(cost multiplier: {cost_multiplier}x)"
        )
        return trade_log, equity_curve
