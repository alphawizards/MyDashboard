import "server-only";
import { stocks } from "@/app/lib/static-data";
import type { Stock, Tweet } from "@/app/lib/types";
import { queryRows } from "@/lib/db/postgres";

export type AccountTickerPerformanceRow = {
  ticker: string;
  yahooUrl: string;
  company: string;
  theme: string;
  perf1M: number | null;
  perf12M: number | null;
  mentions: number;
};

export type TickerFact = {
  ticker: string;
  company: string;
  sector: string | null;
  industry: string | null;
  theme: string;
  perf1M: number | null;
  perf12M: number | null;
  profileFetchedAt?: string | null;
  performanceFetchedAt?: string | null;
};

type TickerProfileRow = {
  ticker: string;
  company: string;
  sector: string | null;
  industry: string | null;
  theme: string;
  perf_1m: string | number | null;
  perf_12m: string | number | null;
  profile_fetched_at: string | Date | null;
  performance_fetched_at: string | Date | null;
};

type YahooQuoteSummary = {
  quoteSummary?: {
    result?: Array<{
      price?: {
        longName?: string;
        shortName?: string;
      };
      assetProfile?: {
        sector?: string;
        industry?: string;
      };
    }>;
  };
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        longName?: string;
        shortName?: string;
        symbol?: string;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type YahooSearchResponse = {
  quotes?: Array<{
    symbol?: string;
    longname?: string;
    shortname?: string;
    sector?: string;
    sectorDisp?: string;
    industry?: string;
    industryDisp?: string;
  }>;
};

const YAHOO_SYMBOL_ALIASES: Record<string, readonly string[]> = {
  "HPS.A": ["HPS-A.TO"],
  IQE: ["IQE.L"],
  LPK: ["LPK.DE"],
  LPKF: ["LPK.DE"],
  SIVE: ["SIVE.ST"],
  SOI: ["SOI.PA"],
};

const PROFILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PERFORMANCE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeTicker(ticker: string): string {
  return ticker.trim().replace(/^\$/, "").toUpperCase();
}

export function resolveYahooSymbolCandidates(ticker: string): string[] {
  const normalized = normalizeTicker(ticker);
  const candidates = [
    normalized,
    ...(YAHOO_SYMBOL_ALIASES[normalized] ?? []),
  ];

  if (normalized.includes(".")) {
    candidates.push(normalized.replace(".", "-"));
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function getYahooFinanceUrl(ticker: string): string {
  const yahooSymbol = resolveYahooSymbolCandidates(ticker)[1] ?? resolveYahooSymbolCandidates(ticker)[0] ?? normalizeTicker(ticker);
  return `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}`;
}

function toNumber(value: string | number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function staticFact(stock: Stock): TickerFact {
  return {
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    industry: null,
    theme: stock.sector || "Unknown",
    perf1M: stock.perf1M,
    perf12M: null,
    profileFetchedAt: null,
    performanceFetchedAt: null,
  };
}

function compactNumbers(values: Array<number | null> | undefined): number[] {
  return (values ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function percentFromLookback(values: number[], lookback: number): number | null {
  if (values.length <= lookback) return null;
  const current = values.at(-1);
  const prior = values.at(-lookback);
  if (!current || !prior) return null;
  return ((current - prior) / prior) * 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function timestampToMs(value: string | Date | null | undefined): number | null {
  if (value instanceof Date) return value.getTime();
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFresh(value: string | Date | null | undefined, ttlMs: number, nowMs = Date.now()): boolean {
  const fetchedMs = timestampToMs(value);
  return fetchedMs !== null && nowMs - fetchedMs >= 0 && nowMs - fetchedMs < ttlMs;
}

export function shouldRefreshTickerFact(fact: TickerFact | undefined, nowMs = Date.now()): boolean {
  if (!fact) return true;

  const profileIncomplete = fact.company === "Unknown" || fact.theme === "Unknown";
  const performanceIncomplete = fact.perf1M === null || fact.perf12M === null;
  const profileStale = !isFresh(fact.profileFetchedAt, PROFILE_TTL_MS, nowMs);
  const performanceStale = !isFresh(fact.performanceFetchedAt, PERFORMANCE_TTL_MS, nowMs);

  return profileIncomplete || performanceIncomplete || profileStale || performanceStale;
}

export function buildTickerMentionCounts(tweets: readonly Tweet[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tweet of tweets) {
    for (const rawTag of tweet.cashtags ?? []) {
      const ticker = normalizeTicker(rawTag);
      if (!ticker) continue;
      counts[ticker] = (counts[ticker] ?? 0) + 1;
    }
  }
  return counts;
}

export function buildAccountTickerPerformanceRows(
  tweets: readonly Tweet[],
  factsByTicker: Record<string, TickerFact | undefined>,
): AccountTickerPerformanceRow[] {
  return Object.entries(buildTickerMentionCounts(tweets))
    .map(([ticker, mentions]) => {
      const fact = factsByTicker[ticker];
      return {
        ticker,
        yahooUrl: getYahooFinanceUrl(ticker),
        company: fact?.company ?? "Unknown",
        theme: fact?.theme ?? "Unknown",
        perf1M: fact?.perf1M ?? null,
        perf12M: fact?.perf12M ?? null,
        mentions,
      };
    })
    .sort(
      (a, b) =>
        b.mentions - a.mentions ||
        (b.perf1M ?? Number.NEGATIVE_INFINITY) - (a.perf1M ?? Number.NEGATIVE_INFINITY) ||
        a.ticker.localeCompare(b.ticker),
    );
}

export async function getAccountTickerPerformanceRows(
  tweets: readonly Tweet[],
): Promise<AccountTickerPerformanceRow[]> {
  const tickers = Object.keys(buildTickerMentionCounts(tweets));
  let facts = await getCachedTickerFacts(tickers);
  const tickersNeedingYahoo = tickers.filter((ticker) => shouldRefreshTickerFact(facts[ticker]));

  if (tickersNeedingYahoo.length) {
    const refreshedFacts = await refreshTickerFacts(tickersNeedingYahoo);
    facts = { ...facts, ...refreshedFacts };
  }

  return buildAccountTickerPerformanceRows(tweets, facts);
}

export async function getCachedTickerFacts(tickers: readonly string[]): Promise<Record<string, TickerFact>> {
  const normalized = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const staticFacts = Object.fromEntries(
    stocks.map((stock) => [stock.ticker, staticFact(stock)]),
  ) as Record<string, TickerFact>;

  if (!normalized.length) return {};

  try {
    const rows = await queryRows<TickerProfileRow>(
      `
        select
          p.ticker,
          p.company,
          p.sector,
          p.industry,
          p.theme,
          p.fetched_at as profile_fetched_at,
          s.perf_1m,
          s.perf_12m,
          s.fetched_at as performance_fetched_at
        from ticker_profiles p
        left join ticker_performance_snapshots s on s.ticker = p.ticker
        where p.ticker = any($1::text[])
      `,
      [normalized],
    );

    const cached = Object.fromEntries(
      (rows ?? []).map((row) => [
        row.ticker,
        {
          ticker: row.ticker,
          company: row.company,
          sector: row.sector,
          industry: row.industry,
          theme: row.theme || row.industry || row.sector || "Unknown",
          perf1M: toNumber(row.perf_1m),
          perf12M: toNumber(row.perf_12m),
          profileFetchedAt: row.profile_fetched_at instanceof Date ? row.profile_fetched_at.toISOString() : row.profile_fetched_at,
          performanceFetchedAt: row.performance_fetched_at instanceof Date ? row.performance_fetched_at.toISOString() : row.performance_fetched_at,
        },
      ]),
    ) as Record<string, TickerFact>;

    return Object.fromEntries(
      normalized.map((ticker) => [ticker, cached[ticker] ?? staticFacts[ticker] ?? unknownFact(ticker)]),
    );
  } catch {
    return Object.fromEntries(
      normalized.map((ticker) => [ticker, staticFacts[ticker] ?? unknownFact(ticker)]),
    );
  }
}

export async function refreshTickerFacts(tickers: readonly string[]): Promise<Record<string, TickerFact>> {
  const normalized = [...new Set(tickers.map(normalizeTicker).filter(Boolean))];
  const facts: Record<string, TickerFact> = {};
  const fetchedFacts: TickerFact[] = [];

  for (const ticker of normalized) {
    const fact = await fetchYahooTickerFact(ticker);
    facts[ticker] = fact ?? unknownFact(ticker);
    if (fact) {
      fetchedFacts.push(fact);
    }

    if (normalized.length > 1) {
      await sleep(100);
    }
  }

  await Promise.all(fetchedFacts.map(upsertTickerFact));
  return facts;
}

async function fetchYahooTickerFact(ticker: string): Promise<TickerFact | null> {
  const candidates = resolveYahooSymbolCandidates(ticker);
  for (const yahooSymbol of candidates) {
    const fact = await fetchYahooTickerFactBySymbol(ticker, yahooSymbol);
    if (fact) {
      return fact;
    }
  }

  return null;
}

async function fetchYahooTickerFactBySymbol(ticker: string, yahooSymbol: string): Promise<TickerFact | null> {
  const [summary, chart] = await Promise.all([
    fetchYahooSummary(yahooSymbol),
    fetchYahooChart(yahooSymbol),
  ]);

  if (
    !summary.company &&
    !summary.sector &&
    !summary.industry &&
    !chart.company &&
    chart.perf1M === null &&
    chart.perf12M === null
  ) {
    return null;
  }

  const fallback = stocks.find((stock) => stock.ticker === ticker);
  const company =
    summary.company ??
    chart.company ??
    fallback?.company ??
    ticker;
  const sector = summary.sector ?? fallback?.sector ?? null;
  const industry = summary.industry ?? null;

  return {
    ticker,
    company,
    sector,
    industry,
    theme: industry ?? sector ?? "Unknown",
    perf1M: chart.perf1M ?? fallback?.perf1M ?? null,
    perf12M: chart.perf12M,
  };
}

async function fetchYahooSummary(ticker: string): Promise<{
  company: string | null;
  sector: string | null;
  industry: string | null;
}> {
  const search = await fetchYahooSearchSummary(ticker);
  if (search.company || search.sector || search.industry) {
    return search;
  }

  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price,assetProfile`,
      {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 StockDashboard/1.0" },
        cache: "no-store",
      },
    );
    if (!res.ok) return { company: null, sector: null, industry: null };
    const body = (await res.json()) as YahooQuoteSummary;
    const result = body.quoteSummary?.result?.[0];
    return {
      company: result?.price?.longName ?? result?.price?.shortName ?? null,
      sector: result?.assetProfile?.sector ?? null,
      industry: result?.assetProfile?.industry ?? null,
    };
  } catch {
    return { company: null, sector: null, industry: null };
  }
}

async function fetchYahooSearchSummary(ticker: string): Promise<{
  company: string | null;
  sector: string | null;
  industry: string | null;
}> {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=5&newsCount=0`,
      {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 StockDashboard/1.0" },
        cache: "no-store",
      },
    );
    if (!res.ok) return { company: null, sector: null, industry: null };
    const body = (await res.json()) as YahooSearchResponse;
    const normalizedTicker = ticker.toUpperCase();
    const quote = body.quotes?.find((item) => item.symbol?.toUpperCase() === normalizedTicker);

    return {
      company: quote?.longname ?? quote?.shortname ?? null,
      sector: quote?.sector ?? quote?.sectorDisp ?? null,
      industry: quote?.industry ?? quote?.industryDisp ?? null,
    };
  } catch {
    return { company: null, sector: null, industry: null };
  }
}

async function fetchYahooChart(ticker: string): Promise<{
  company: string | null;
  perf1M: number | null;
  perf12M: number | null;
}> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`,
      {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 StockDashboard/1.0" },
        cache: "no-store",
      },
    );
    if (!res.ok) return { company: null, perf1M: null, perf12M: null };
    const body = (await res.json()) as YahooChartResponse;
    const result = body.chart?.result?.[0];
    const closes = compactNumbers(result?.indicators?.quote?.[0]?.close);
    return {
      company: result?.meta?.longName ?? result?.meta?.shortName ?? null,
      perf1M: percentFromLookback(closes, 21),
      perf12M: percentFromLookback(closes, Math.min(252, closes.length - 1)),
    };
  } catch {
    return { company: null, perf1M: null, perf12M: null };
  }
}

async function upsertTickerFact(fact: TickerFact): Promise<void> {
  try {
    await queryRows(
      `
        insert into ticker_profiles (ticker, company, sector, industry, theme, fetched_at)
        values ($1,$2,$3,$4,$5,now())
        on conflict (ticker) do update set
          company = excluded.company,
          sector = excluded.sector,
          industry = excluded.industry,
          theme = excluded.theme,
          fetched_at = now()
      `,
      [fact.ticker, fact.company, fact.sector, fact.industry, fact.theme],
    );

    await queryRows(
      `
        insert into ticker_performance_snapshots (ticker, perf_1m, perf_12m, fetched_at)
        values ($1,$2,$3,now())
        on conflict (ticker) do update set
          perf_1m = excluded.perf_1m,
          perf_12m = excluded.perf_12m,
          fetched_at = now()
      `,
      [fact.ticker, fact.perf1M, fact.perf12M],
    );
  } catch {
    // Profile cache writes are best-effort.
  }
}

function unknownFact(ticker: string): TickerFact {
  return {
    ticker,
    company: "Unknown",
    sector: null,
    industry: null,
    theme: "Unknown",
    perf1M: null,
    perf12M: null,
    profileFetchedAt: null,
    performanceFetchedAt: null,
  };
}
