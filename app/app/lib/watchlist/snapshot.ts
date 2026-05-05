import { lastRefresh, stocks } from "@/app/lib/static-data";
import type { EquitySnapshot, WatchlistPageSnapshot } from "@/app/lib/types";
import { getFarsideBtcFlows } from "@/app/lib/watchlist/farside";
import { getPredictionCards } from "@/app/lib/watchlist/prediction-cards";

function parseStaticRefresh(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})\s+AEST$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+10:00`;
}

export function getEquityData(): EquitySnapshot {
  return {
    rows: [...stocks],
    status: {
      provider: "yfinance",
      status: "ok",
      message: `Loaded ${stocks.length} static watchlist equities.`,
      updatedAt: parseStaticRefresh(lastRefresh),
    },
  };
}

export async function getWatchlistSnapshot(): Promise<WatchlistPageSnapshot> {
  const equities = getEquityData();
  const predictionMarkets = getPredictionCards();
  const farside = await getFarsideBtcFlows();

  return {
    equities,
    farside,
    predictionMarkets,
  };
}
