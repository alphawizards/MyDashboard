"use client";

import { useMemo, useState } from "react";
import type { AutopilotPortfolio } from "../lib/types";

type PortfolioTabsProps = {
  portfolios: readonly AutopilotPortfolio[];
};

export function PortfolioTabs({ portfolios }: PortfolioTabsProps) {
  const [activeId, setActiveId] = useState(portfolios[0]?.id ?? "");
  const activePortfolio = portfolios.find((portfolio) => portfolio.id === activeId) ?? portfolios[0];
  const totalWeight = useMemo(
    () => activePortfolio.holdings.reduce((sum, holding) => sum + holding.weight, 0),
    [activePortfolio],
  );

  return (
    <>
      <nav className="tab-bar" aria-label="Portfolio tabs">
        {portfolios.map((portfolio) => (
          <button
            className={`tab-btn ${portfolio.id === activePortfolio.id ? "active" : ""}`}
            key={portfolio.id}
            onClick={() => setActiveId(portfolio.id)}
          >
            {portfolio.ownerName}
            <span className="count">{portfolio.status === "tracked" ? portfolio.holdings.length : "pending"}</span>
          </button>
        ))}
      </nav>

      <section className="portfolio-layout">
        <article className="portfolio-hero-card">
          <div className="portfolio-visual">
            <div className="portfolio-visual-gradient" />
            <div>
              <p className="eyebrow">Tracked account</p>
              <h2>{activePortfolio.title}</h2>
              <p>by {activePortfolio.ownerName}</p>
            </div>
          </div>
          <div className="portfolio-summary">
            {activePortfolio.returnAllTime === null ? (
              <div>
                <strong className="portfolio-pending">
                  {activePortfolio.holdings.length ? "Holdings captured" : "Awaiting data"}
                </strong>
                <span>
                  {activePortfolio.holdings.length
                    ? activePortfolio.source
                    : "Send the portfolio screenshots and I&apos;ll add holdings, weights, performance, and notes here."}
                </span>
              </div>
            ) : (
              <div>
                <strong className="portfolio-return">▲ {activePortfolio.returnAllTime.toFixed(1)}%</strong>
                <span>all time</span>
              </div>
            )}
            <div className="portfolio-meta-grid">
              <span>Source: {activePortfolio.source}</span>
              <span>Updated: {activePortfolio.updatedAt}</span>
              <span>Holdings: {activePortfolio.holdings.length || "pending"}</span>
              <span>Weight captured: {totalWeight || 0}%</span>
            </div>
          </div>
        </article>

        <article className="portfolio-holdings-card">
          <div className="portfolio-section-header">
            <div>
              <p className="eyebrow">Current holdings</p>
              <h2>{activePortfolio.status === "tracked" ? activePortfolio.title : "Waiting for portfolio data"}</h2>
            </div>
          </div>

          {activePortfolio.holdings.length ? (
            <div className="portfolio-holdings-list">
              {activePortfolio.holdings.map((holding) => (
                <div className="portfolio-holding-row" key={holding.ticker}>
                  <div>
                    <strong>{holding.ticker}</strong>
                    {holding.company ? <span>{holding.company}</span> : null}
                  </div>
                  <div className="portfolio-weight">
                    <span>{holding.weight}%</span>
                    <div className="portfolio-weight-track">
                      <div style={{ width: `${holding.weight}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="portfolio-empty">
              <strong>Wolff tab ready</strong>
              <span>Send the portfolio screenshots and I&apos;ll add holdings, weights, performance, and notes here.</span>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
