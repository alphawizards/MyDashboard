import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = process.cwd();

function readAppFile(path: string) {
  return readFileSync(join(appRoot, "app", path), "utf8");
}

describe("prototype route source", () => {
  it("removes the default Next starter page", () => {
    const home = readAppFile("page.tsx");

    expect(home).not.toContain("To get started");
    expect(home).not.toContain("Deploy Now");
    expect(home).toContain("Morning Stock Dashboard");
  });

  it("has feed and watchlist routes with parity anchors", () => {
    const feed = readAppFile("feed/page.tsx");
    const feedClient = readAppFile("feed/feed-client.tsx");
    const watchlist = readAppFile("watchlist/watchlist-dashboard.tsx");
    const portfolios = readAppFile("portfolios/page.tsx");
    const portfolioTabs = readAppFile("portfolios/portfolio-tabs.tsx");

    expect(feed).toContain("X tracker");
    expect(feedClient).toContain("Ticker Mention Map");
    expect(watchlist).toContain("Morning Stock Watchlist");
    expect(portfolios).toContain("Portfolio Tracker");
    expect(portfolioTabs).toContain("Current holdings");
  });
});
