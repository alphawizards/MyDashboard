import Link from "next/link";
import { BTC_ETF_FLOW_COLUMNS, type BtcEtfFlowColumn, type ProviderStatus } from "@/app/lib/types";
import { getWatchlistSnapshot } from "@/app/lib/watchlist/snapshot";

export const dynamic = "force-dynamic";

function fmtAest(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Brisbane",
    timeZoneName: "short",
  }).format(new Date(value));
}

function fmtFlow(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);
}

function flowClass(value: number | null, column?: BtcEtfFlowColumn) {
  const classes = ["flow-value"];
  if (column === "Total") classes.push("total");
  if (value === null || value === 0) classes.push("zero");
  if (typeof value === "number" && value > 0) classes.push("pos");
  if (typeof value === "number" && value < 0) classes.push("neg");
  return classes.join(" ");
}

function ProviderStatusPill({ status }: { status: ProviderStatus }) {
  const detail =
    status.status === "stale" && status.updatedAt
      ? `Using cached Farside data from ${fmtAest(status.updatedAt)}; latest fetch failed.`
      : status.message;

  return (
    <p className={`provider-status provider-status-${status.status}`}>
      <strong>{status.provider}</strong>
      <span>{status.status.replace("_", " ")}</span>
      <small>{detail}</small>
    </p>
  );
}

export default async function WatchlistPage() {
  const snapshot = await getWatchlistSnapshot();
  const { equities, farside, predictionMarkets } = snapshot;

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h1>Morning Stock Watchlist</h1>
          <p className="subtitle">Provider-aware snapshot. Last yfinance refresh: {fmtAest(equities.status.updatedAt)}.</p>
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
        {predictionMarkets.cards.map((card) => (
          <article className="market-card" key={card.key}>
            <div className="market-card-topline">
              <span>{card.provider}</span>
              <span>{card.status.replace("_", " ")}</span>
            </div>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <a className="external-market-link" href={card.marketUrl} target="_blank" rel="noopener noreferrer">
              Open market
            </a>
          </article>
        ))}
      </section>
      <ProviderStatusPill status={predictionMarkets.status} />

      <section className="watchlist-grid" aria-label="Stock watchlist">
        {equities.rows.map((stock) => (
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
      <ProviderStatusPill status={equities.status} />

      <section style={{ marginTop: 20 }}>
        <div className="page-header">
          <div>
            <p className="eyebrow">Farside</p>
            <h1>Bitcoin ETF Net Flows</h1>
            <p className="subtitle">
              Last 10 trading rows from{" "}
              <a href={farside.sourceUrl} target="_blank" rel="noopener noreferrer">
                farside.co.uk
              </a>
              .
            </p>
          </div>
        </div>
        <ProviderStatusPill status={farside.status} />
        <div className="farside-prototype">
          <table className="farside-flow-table">
            <thead>
              <tr>
                <th>Date</th>
                {BTC_ETF_FLOW_COLUMNS.map((column) => (
                  <th key={column} className={column === "Total" ? "total" : undefined}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {farside.rows.map((row) => (
                <tr key={row.date}>
                  <td>{row.dateLabel}</td>
                  {BTC_ETF_FLOW_COLUMNS.map((column) => (
                    <td className={flowClass(row.values[column], column)} key={column}>
                      {fmtFlow(row.values[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {farside.rows.length === 0 ? <p className="section-empty">No Farside flow data available yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
