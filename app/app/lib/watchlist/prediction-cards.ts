import type { PredictionCard, PredictionCardsSnapshot } from "@/app/lib/types";

type PredictionCardConfig = Omit<PredictionCard, "status" | "marketUrl"> & {
  status: "link_only";
  marketUrl: string | ((now: Date) => string);
};

function formatSlugDate(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "America/New_York",
    year: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const month = parts.find((part) => part.type === "month")?.value.toLowerCase();
  const day = parts.find((part) => part.type === "day")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!month || !day || !year) return "may-5-2026";
  return `${month}-${day}-${year}`;
}

const predictionCardConfig = [
  {
    key: "ndx-daily",
    title: "NASDAQ 100 - Today Up or Down?",
    provider: "Polymarket",
    marketUrl: (now: Date) => `https://polymarket.com/event/ndx-up-or-down-on-${formatSlugDate(now)}`,
    status: "link_only",
    description: "Daily NDX direction market. Live odds wiring is still pending.",
  },
  {
    key: "us-recession-2026",
    title: "US Recession by End of 2026?",
    provider: "Polymarket",
    marketUrl: "https://polymarket.com/event/us-recession-by-end-of-2026",
    status: "link_only",
    description: "Macro recession market link. Live odds wiring is still pending.",
  },
  {
    key: "spx-close-2026",
    title: "S&P 500 - Year-End 2026 Close",
    provider: "Polymarket",
    marketUrl: "https://polymarket.com/event/spx-close-dec-2026",
    status: "link_only",
    description: "SPX end-of-2026 bracket market. Live odds wiring is still pending.",
  },
] as const satisfies readonly PredictionCardConfig[];

export function getPredictionCards(now = new Date()): PredictionCardsSnapshot {
  const cards = predictionCardConfig.map((card) => ({
    ...card,
    marketUrl: typeof card.marketUrl === "function" ? card.marketUrl(now) : card.marketUrl,
  }));

  return {
    cards,
    status: {
      provider: "predictionMarkets",
      status: "link_only",
      message: "Polymarket cards are link-only until live odds are wired.",
      updatedAt: null,
    },
  };
}
