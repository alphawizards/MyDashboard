import Link from "next/link";
import { farsideHtml, lastRefresh, stocks } from "../lib/static-data";

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

export default function WatchlistPage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h1>Morning Stock Watchlist</h1>
          <p className="subtitle">Static prototype port. Last yfinance refresh: {lastRefresh}.</p>
        </div>
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
      </header>

      <section className="market-grid" aria-label="Market context">
        <article className="market-card">
          <h2>NASDAQ 100 · Today Up or Down?</h2>
          <p>Prototype placeholder for the Polymarket live odds panel.</p>
        </article>
        <article className="market-card">
          <h2>US Recession by End of 2026?</h2>
          <p>Server refresh wiring will replace this static placeholder.</p>
        </article>
        <article className="market-card">
          <h2>S&amp;P 500 · Year-End 2026 Close</h2>
          <p>Static UI parity first; live CLOB polling comes after data provider wiring.</p>
        </article>
      </section>

      <section className="watchlist-grid" aria-label="Stock watchlist">
        {stocks.map((stock) => (
          <article className="stock-card" key={stock.ticker}>
            <div className="stock-row">
              <div>
                <div className="stock-symbol">{stock.ticker}</div>
                <div className="stock-company">
                  {stock.company} · {stock.exchange}
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

      <section style={{ marginTop: 20 }}>
        <div className="page-header">
          <div>
            <p className="eyebrow">Farside</p>
            <h1>Bitcoin ETF Net Flows</h1>
          </div>
        </div>
        <div className="farside-prototype" dangerouslySetInnerHTML={{ __html: farsideHtml }} />
      </section>
    </main>
  );
}
