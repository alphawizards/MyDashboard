"use client";

import { useState } from "react";
import Link from "next/link";
import type { FarsideFlowRow, Stock, WatchlistDashboardData, WatchlistRefreshResponse } from "../lib/types";

const FARSIDE_COLUMNS = ["IBIT", "FBTC", "BITB", "ARKB", "BTCO", "EZBC", "BRRR", "HODL", "BTCW", "MSBT", "GBTC", "BTC", "Total"];

function fmtCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function fmtCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function pct(value: number | null) {
  if (value === null) return "n/a";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function valueClass(value: string, isTotal = false) {
  if (value.startsWith("(") || value.startsWith("-")) return isTotal ? "total neg" : "neg";
  if (value === "-" || value === "0.0" || value === "0") return isTotal ? "total zero" : "zero";
  return isTotal ? "total pos" : "pos";
}

export function WatchlistDashboard({ initialData }: { initialData: WatchlistDashboardData }) {
  const [dashboard, setDashboard] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshData() {
    if (refreshing) return;

    setRefreshing(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/watchlist/refresh", { method: "POST" });
      const data = (await response.json()) as WatchlistRefreshResponse | { ok?: false; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error("error" in data && data.error ? data.error : `Refresh failed with HTTP ${response.status}`);
      }

      setDashboard(data);
      setStatus(`Refresh complete at ${data.watchlistRefreshedAtLabel}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <header className="page-header watchlist-header">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h1>Morning Stock Watchlist</h1>
          <p className="subtitle">Last yfinance refresh: {dashboard.watchlistRefreshedAtLabel}.</p>
        </div>
        <div className="header-actions">
          <nav className="nav-actions" aria-label="Dashboard navigation">
            <Link className="nav-btn" href="/">
              Home
            </Link>
            <Link className="nav-btn" href="/feed">
              X Tracker
            </Link>
            <Link className="nav-btn" href="/portfolios">
              Portfolios
            </Link>
          </nav>
          <button className="primary-action" disabled={refreshing} onClick={refreshData} type="button">
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
          <div aria-live="polite" className="refresh-state">
            {status ? <span className="pos">{status}</span> : null}
            {error ? <span className="neg">{error}</span> : null}
          </div>
        </div>
      </header>

      <PlaceholderPredictionPanels />
      <WatchlistCards stocks={dashboard.watchlist} />
      <FarsideFlows flows={dashboard.farsideFlows} fetchedLabel={dashboard.farsideRefreshedAtLabel} />
    </>
  );
}

function PlaceholderPredictionPanels() {
  return (
    <section className="market-grid placeholder-market-grid" aria-label="Placeholder market context">
      <article className="market-card placeholder-panel">
        <h2>NASDAQ 100 - Today Up or Down?</h2>
        <p>Placeholder: Polymarket live odds provider is not wired yet.</p>
      </article>
      <article className="market-card placeholder-panel">
        <h2>US Recession by End of 2026?</h2>
        <p>Placeholder: macro prediction market data will connect through the future provider layer.</p>
      </article>
      <article className="market-card placeholder-panel">
        <h2>S&amp;P 500 - Year-End 2026 Close</h2>
        <p>Placeholder: future live CLOB polling belongs behind the prediction panel boundary.</p>
      </article>
    </section>
  );
}

function WatchlistCards({ stocks }: { stocks: Stock[] }) {
  return (
    <section className="watchlist-grid" aria-label="Stock watchlist">
      {stocks.map((stock) => (
        <article className="stock-card" key={stock.ticker}>
          <div className="stock-row">
            <div>
              <div className="stock-symbol">{stock.ticker}</div>
              <div className="stock-company">
                {stock.company} - {stock.exchange}
              </div>
            </div>
            <div className="stock-price">
              <strong>{fmtCurrency(stock.price)}</strong>
              <span className={stock.change > 0 ? "pos" : stock.change < 0 ? "neg" : "zero"}>
                {pct(stock.change)}
              </span>
            </div>
          </div>
          <div className="stock-metrics">
            <span className="metric">Open {fmtCurrency(stock.open)}</span>
            <span className="metric">High {fmtCurrency(stock.dayHigh)}</span>
            <span className="metric">Low {fmtCurrency(stock.dayLow)}</span>
            <span className="metric">Vol {fmtCompact(stock.volume)}</span>
            <span className="metric">Avg {fmtCompact(stock.avgVolume)}</span>
            <span className="metric">MCap {fmtCompact(stock.marketCap)}</span>
            <span className="metric">1M {pct(stock.perf1M)}</span>
            <span className="metric">3M {pct(stock.perf3M)}</span>
          </div>
          <div className="catalyst">{stock.catalyst || "No catalyst note yet."}</div>
          <span className="priority">Priority: {stock.priority}</span>
        </article>
      ))}
    </section>
  );
}

function FarsideFlows({ flows, fetchedLabel }: { flows: FarsideFlowRow[]; fetchedLabel: string }) {
  return (
    <section className="farside-section-panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Farside</p>
          <h1>Bitcoin ETF Net Flows</h1>
        </div>
      </div>
      <div className="farside-prototype">
        <div className="farside-section">
          <div className="farside-section-header">
            <span className="farside-logo">FARSIDE</span>
            <h3>Bitcoin ETF Net Flows - Last 10 Days (US$ millions)</h3>
            <span className="farside-fetched">Fetched {fetchedLabel}</span>
            <a className="farside-link" href="https://farside.co.uk/bitcoin-etf-flow-all-data/" rel="noopener noreferrer" target="_blank">
              farside.co.uk
            </a>
          </div>
          <div className="farside-wrap">
            <table className="farside">
              <thead>
                <tr>
                  <th>Date</th>
                  {FARSIDE_COLUMNS.map((column) => (
                    <th className={column === "Total" ? "total" : undefined} key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flows.length ? (
                  flows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      {FARSIDE_COLUMNS.map((column) => (
                        <td className={valueClass(row.values[column] ?? "-", column === "Total")} key={column}>
                          {row.values[column] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={FARSIDE_COLUMNS.length + 1}>No Farside flow data available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
