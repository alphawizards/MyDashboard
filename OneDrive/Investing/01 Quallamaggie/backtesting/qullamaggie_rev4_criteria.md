# Qullamaggie Rev4 Backtest Strategy Checklist

This document details the exact functional criteria the backtesting engine uses off the `rev4_rules.py`, `metrics.py`, and `backtester.py` logic to evaluate, trigger, and exit trades. The Python implementation matches the Pine script logic (Phase 1-6) identically.

## Trade Entry Criteria

To successfully trigger a trade entry, a stock must pass through sequence of gating phases on a specific day (Day T). If triggered, the backtester executes the trade on the **OPEN of the following day (Day T+1)**.

### Phase 1: Universe Filters
The stock must be structurally tradeable and in an uptrend:
- [ ] **Minimum Price**: Close >= $5.00
- [ ] **Liquidity**: Average Daily Dollar Volume (20-day) >= $10 Million
- [ ] **Volatility**: Average Daily Range (ADR%, 20-day) >= 5.0%
- [ ] **Primary Trend**: Close > 50-day Simple Moving Average (SMA)
- [ ] **Market Regime**: SPY Close > SPY 50-day SMA **OR** QQQ Close > QQQ 50-day SMA
- [ ] **Institutional Accumulation**: 50-day Up-Volume / 50-day Down-Volume >= 1.2x

### Phase 2: Momentum Ranking
The stock must have proven, recent relative strength:
- [ ] **Momentum Hurdle** (Needs to pass at least **ONE** of the three, ADR-normalized):
  - 1-Month (21d) Return >= (20.0% / ADR)
  - 3-Month (63d) Return >= (40.0% / ADR)
  - 6-Month (126d) Return >= (50.0% / ADR)
- [ ] **52-Week High Proximity**: Close is within 90% of its 252-day High

### Phase 3: Setup Detection (The Base)
At least one pattern setup must be formed. For Flag and HTF, the following pre-conditions must be matched **on the day prior (Day T-1) to the breakout**:
- [ ] **Price Surfing**: Close is sandwiched near the 10-day SMA (between -0.5x ADR to +0.75x ADR) AND 10-day SMA >= 20-day SMA
- [ ] **Volume Dry Up**: 5-day Avg Volume < (20-day Avg Volume * 0.85)
- [ ] **Volatility Compression**: 20-day Bollinger Band Width (BBW) is in the bottom 20th percentile over the last 100 days

**Setup Conditions:**
- [ ] **Setup A (Flag)**: Prior 60-day Move between 30% and 90%, AND Pullback from 60d High <= 25%, AND Pre-conditions met.
- [ ] **Setup B (HTF)**: Prior 60-day Move >= 90%, AND Pullback from 60d High <= 25%, AND Pre-conditions met.
- [ ] **Setup C (Episodic Pivot)**: Gap Up (Open >= 10% above prev close) AND Volume Surge (Today's Vol > 20-day Avg Vol * 2.0). *(Evaluated on Day T itself)*.

### Phase 4: Breakout Confirmation (The Trigger)
On Day T, if Setup A or Setup B were active on Day T-1, the breakout must be confirmed to trigger the entry signal:
- [ ] **Strong Push**: Day Change (Close vs Prev Close) >= 3.0%
- [ ] **Range Expansion**: Today's Range (High - Low) >= (5-day Avg Range * 0.5)
- [ ] **High Clearing**: Today's High > Highest High of the previous 2 days
- [ ] **Not Overextended**: (Close - Low) < (20-day Avg Range * 1.5)
- [ ] **Early Volume Surge**: Today's Volume >= (20-day Avg Volume * 0.75)
- [ ] **ADR Tradeable Risk Check**: (Close - Low) < (Close * ADR% / 100)

*(Note: If Setup C fires, it bypasses the Phase 4 Breakout rules and triggers an entry directly, provided Phase 1 and 2 pass).*

---

## Trade Exit Criteria

Exits are passively managed using a volatility-adjusted trailing stop (Chandelier Exit). The backtester evaluates the exit condition daily and will close the trade at the **Chandelier Exit Price** on the day the condition is violated (modeling a limit-stop execution).

### Phase 6: Trade Management Exits
A trade is exited when **Low < Chandelier Exit Level**.

The Chandelier Exit Level is dynamically calculated as: 
`[Highest High over Lookback Window] - (3.0 * 20-day ATR)`

The lookback window scales depending on which setup triggered the entry:
- [ ] **Flag (Setup A) Lookback**: 20 bars
- [ ] **HTF (Setup B) Lookback**: 30 bars (wider leash for higher timeframe moves)
- [ ] **Episodic Pivot (Setup C) Lookback**: 10 bars (quicker cutoff for news-driven momentum)
