import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { parseFarsideFlows } from "./farside";
import { stocks } from "./static-data";
import type { FarsideFlowRow, Stock, WatchlistDashboardData } from "./types";

const CACHE_PATH = join(process.cwd(), ".cache", "watchlist-dashboard.json");
const FARSIDE_URL = "https://farside.co.uk/bitcoin-etf-flow-all-data/";
const FARSIDE_READABLE_URL = "https://r.jina.ai/http://farside.co.uk/bitcoin-etf-flow-all-data/";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        fullExchangeName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketVolume?: number;
      };
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

function formatRefreshLabel(timestamp: string) {
  return `${new Date(timestamp).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "medium",
    timeStyle: "short",
  })} AEST`;
}

function numberOrFallback(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function compactNumbers(values: Array<number | null> | undefined) {
  return (values ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function lastNumber(values: number[]) {
  return values.at(-1) ?? 0;
}

function percentFromLookback(values: number[], lookback: number, fallback: number | null) {
  const current = values.at(-1);
  const prior = values.at(-lookback);

  if (!current || !prior) {
    return fallback;
  }

  return ((current - prior) / prior) * 100;
}

export async function refreshWatchlistData(refreshedAt = new Date().toISOString()): Promise<{ stocks: Stock[]; refreshedAt: string; label: string }> {
  const results = await Promise.all(stocks.map((stock) => fetchYahooChartStock(stock)));
  const refreshedStocks = results.map((stock, index) => stock ?? stocks[index]);

  if (!results.some(Boolean)) {
    throw new Error("Yahoo chart refresh returned no usable rows");
  }

  return {
    stocks: refreshedStocks,
    refreshedAt,
    label: formatRefreshLabel(refreshedAt),
  };
}

async function fetchYahooChartStock(fallback: Stock): Promise<Stock | null> {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(fallback.ticker)}?range=6mo&interval=1d`, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 StockDashboard/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as YahooChartResponse;
  const result = body.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];

  if (!meta || !quote) {
    return null;
  }

  const closes = compactNumbers(quote.close);
  const volumes = compactNumbers(quote.volume);
  const latestClose = lastNumber(closes);
  const previousClose = numberOrFallback(meta.previousClose, fallback.prevClose);
  const change = previousClose ? ((latestClose - previousClose) / previousClose) * 100 : fallback.change;

  return {
    ...fallback,
    exchange: meta.fullExchangeName ?? fallback.exchange,
    price: numberOrFallback(meta.regularMarketPrice, latestClose),
    change,
    prevClose: previousClose,
    open: numberOrFallback(lastNumber(compactNumbers(quote.open)), fallback.open),
    dayHigh: numberOrFallback(lastNumber(compactNumbers(quote.high)), fallback.dayHigh),
    dayLow: numberOrFallback(lastNumber(compactNumbers(quote.low)), fallback.dayLow),
    fiftyTwoHigh: numberOrFallback(meta.fiftyTwoWeekHigh, fallback.fiftyTwoHigh),
    fiftyTwoLow: numberOrFallback(meta.fiftyTwoWeekLow, fallback.fiftyTwoLow),
    volume: numberOrFallback(meta.regularMarketVolume, lastNumber(volumes)),
    avgVolume: volumes.length ? Math.round(volumes.slice(-30).reduce((sum, value) => sum + value, 0) / Math.min(volumes.length, 30)) : fallback.avgVolume,
    perf1M: percentFromLookback(closes, 21, fallback.perf1M),
    perf3M: percentFromLookback(closes, 63, fallback.perf3M),
    perf6M: percentFromLookback(closes, 126, fallback.perf6M),
  };
}

export async function refreshFarsideFlows(refreshedAt = new Date().toISOString()): Promise<{ flows: FarsideFlowRow[]; refreshedAt: string; label: string }> {
  const html = await fetchFarsideSource();
  const flows = parseFarsideFlows(html);

  if (!flows.length) {
    throw new Error("Farside refresh returned no flow rows");
  }

  return {
    flows,
    refreshedAt,
    label: formatRefreshLabel(refreshedAt),
  };
}

async function fetchFarsideSource() {
  const headers = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
  const primary = await fetch(FARSIDE_URL, {
    headers,
    cache: "no-store",
  });

  if (primary.ok) {
    return primary.text();
  }

  const readable = await fetch(FARSIDE_READABLE_URL, {
    headers: { accept: "text/plain", "user-agent": "Mozilla/5.0 StockDashboard/1.0" },
    cache: "no-store",
  });

  if (!readable.ok) {
    throw new Error(`Farside refresh failed with HTTP ${primary.status}; readable fallback HTTP ${readable.status}`);
  }

  return readable.text();
}

export async function refreshWatchlistDashboard(): Promise<WatchlistDashboardData> {
  const refreshedAt = new Date().toISOString();
  const [watchlist, farside] = await Promise.all([
    refreshWatchlistData(refreshedAt),
    refreshFarsideFlows(refreshedAt),
  ]);
  const dashboard = {
    refreshedAt,
    watchlistRefreshedAt: watchlist.refreshedAt,
    watchlistRefreshedAtLabel: watchlist.label,
    farsideRefreshedAt: farside.refreshedAt,
    farsideRefreshedAtLabel: farside.label,
    watchlist: watchlist.stocks,
    farsideFlows: farside.flows,
  };

  await writeDashboardCache(dashboard);
  revalidatePath("/watchlist");

  return dashboard;
}

export async function getWatchlistDashboardData(): Promise<WatchlistDashboardData> {
  const cached = await readDashboardCache();

  if (cached) {
    return cached;
  }

  try {
    return await refreshWatchlistDashboard();
  } catch {
    const refreshedAt = new Date().toISOString();

    return {
      refreshedAt,
      watchlistRefreshedAt: refreshedAt,
      watchlistRefreshedAtLabel: `Fallback snapshot from ${formatRefreshLabel(refreshedAt)}`,
      farsideRefreshedAt: refreshedAt,
      farsideRefreshedAtLabel: `Fallback snapshot from ${formatRefreshLabel(refreshedAt)}`,
      watchlist: [...stocks],
      farsideFlows: [],
    };
  }
}

async function readDashboardCache() {
  try {
    const file = await readFile(CACHE_PATH, "utf8");
    return JSON.parse(file) as WatchlistDashboardData;
  } catch {
    return null;
  }
}

async function writeDashboardCache(data: WatchlistDashboardData) {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(data, null, 2), "utf8");
}
