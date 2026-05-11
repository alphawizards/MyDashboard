export type AuthorKey = string;

export type AuthorProfile = {
  key: AuthorKey;
  slug: string;
  name: string;
  shortName: string;
  handle: string;
  color: string;
  bio: string;
  followers: string;
  avatar: string | null;
  platform?: "X" | string;
  winRate?: number;
  shadowScore?: number;
  rankSource?: string;
};

export type Tweet = {
  id: string;
  text: string;
  created_at: string;
  posted_at_iso?: string;
  likes: number;
  retweets: number;
  replies: number;
  cashtags: string[];
  url: string;
};

export type Stock = {
  ticker: string;
  company: string;
  exchange: string;
  price: number;
  change: number;
  prevClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoHigh: number;
  fiftyTwoLow: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  sector: string;
  target: number;
  perf1M: number | null;
  perf3M: number | null;
  perf6M: number | null;
  catalyst: string;
  priority: "low" | "medium" | "high" | string;
};

export type ProviderStatusKind = "ok" | "stale" | "failed" | "link_only";

export type ProviderStatus = {
  provider: "yfinance" | "farside" | "predictionMarkets";
  status: ProviderStatusKind;
  message: string;
  updatedAt: string | null;
  error?: string;
};

export type EquitySnapshot = {
  rows: Stock[];
  status: ProviderStatus;
};

export const BTC_ETF_FLOW_COLUMNS = [
  "IBIT",
  "FBTC",
  "BITB",
  "ARKB",
  "BTCO",
  "EZBC",
  "BRRR",
  "HODL",
  "BTCW",
  "MSBT",
  "GBTC",
  "BTC",
  "Total",
] as const;

export type BtcEtfFlowColumn = (typeof BTC_ETF_FLOW_COLUMNS)[number];

export type BtcEtfFlowRow = {
  date: string;
  dateLabel: string;
  values: Record<BtcEtfFlowColumn, number | null>;
};

export type BtcEtfFlowsSnapshot = {
  rows: BtcEtfFlowRow[];
  sourceUrl: string;
  status: ProviderStatus;
};

export type PredictionCard = {
  key: string;
  title: string;
  provider: "Polymarket";
  marketUrl: string;
  status: "link_only" | "ok" | "stale" | "failed";
  description: string;
};

export type PredictionCardsSnapshot = {
  cards: PredictionCard[];
  status: ProviderStatus;
};

export type WatchlistPageSnapshot = {
  equities: EquitySnapshot;
  farside: BtcEtfFlowsSnapshot;
  predictionMarkets: PredictionCardsSnapshot;
  };
export type FarsideFlowRow = {
  date: string;
  values: Record<string, string>;
};

export type WatchlistDashboardData = {
  refreshedAt: string;
  watchlistRefreshedAt: string;
  watchlistRefreshedAtLabel: string;
  farsideRefreshedAt: string;
  farsideRefreshedAtLabel: string;
  watchlist: Stock[];
  farsideFlows: FarsideFlowRow[];
};

export type WatchlistRefreshResponse = WatchlistDashboardData & {
  ok: true;
};

export type TickerAuthorCount = {
  who: AuthorKey;
  count: number;
};

export type TickerOverlap = {
  ticker: string;
  authors: TickerAuthorCount[];
  total: number;
  shared: boolean;
  color: string;
};

export type UniqueTickerMention = {
  ticker: string;
  who: AuthorKey;
  count: number;
  color: string;
};

export type AccountUniqueTickerGroup = {
  who: AuthorKey;
  tickers: UniqueTickerMention[];
};

export type TickerMentionGroups = {
  shared: TickerOverlap[];
  uniqueByAuthor: AccountUniqueTickerGroup[];
};

export type PortfolioHolding = {
  ticker: string;
  weight: number;
  company?: string;
  note?: string;
};

export type AutopilotPortfolio = {
  id: string;
  ownerKey: "sikand" | "wolff";
  ownerName: string;
  title: string;
  status: "tracked" | "pending";
  returnAllTime: number | null;
  source: string;
  updatedAt: string;
  holdings: PortfolioHolding[];
};
