import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tweetsByAuthor as staticTweetsByAuthor } from "@/app/lib/static-data";
import type { Tweet } from "@/app/lib/types";
import { refreshFarsideBtcFlows } from "@/app/lib/watchlist/farside";
import { logDatabaseConfigOnce } from "@/lib/db-config";
import { createRequestId, logger, serializeError } from "@/lib/logger";
import { fetchAllTweetsWithDiagnostics, isXConfigured } from "@/lib/x/server";
import type { XRefreshDiagnostics } from "@/lib/x/server";
import { buildTickerMentionCounts, refreshTickerFacts } from "@/lib/stocks/account-tracker";

const SERENITY_AUTHOR_KEY = "a";

function getSerenityYahooRefreshTickers(tweetsByAuthor?: Record<string, Tweet[]>): {
  source: "live" | "static";
  tickers: string[];
} {
  const liveSerenityTweets = tweetsByAuthor?.[SERENITY_AUTHOR_KEY] ?? [];
  const sourceTweets = liveSerenityTweets.length
    ? liveSerenityTweets
    : staticTweetsByAuthor[SERENITY_AUTHOR_KEY];

  return {
    source: liveSerenityTweets.length ? "live" : "static",
    tickers: Object.keys(buildTickerMentionCounts(sourceTweets)),
  };
}

async function refreshSerenityYahooFacts(
  requestId: string,
  tweetsByAuthor?: Record<string, Tweet[]>,
): Promise<{ source: "live" | "static"; tickers: number }> {
  const { source, tickers } = getSerenityYahooRefreshTickers(tweetsByAuthor);

  if (!tickers.length) {
    logger.info("refresh.yahoo.serenity.skipped", { requestId, source, reason: "no_tickers" });
    return { source, tickers: 0 };
  }

  logger.info("refresh.yahoo.serenity.start", { requestId, source, tickers: tickers.length });
  await refreshTickerFacts(tickers);
  logger.info("refresh.yahoo.serenity.success", { requestId, source, tickers: tickers.length });

  return { source, tickers: tickers.length };
}

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const startedAt = Date.now();
  const route = "/api/refresh/all";

  logger.info("refresh.start", { requestId, route });

  try {
    const configuredSecret = process.env.REFRESH_SHARED_SECRET;

    if (configuredSecret) {
      const suppliedSecret = request.headers.get("x-refresh-secret");
      if (suppliedSecret !== configuredSecret) {
        logger.warn("refresh.auth.denied", {
          requestId,
          route,
          durationMs: Date.now() - startedAt,
          secretConfigured: true,
          secretSupplied: Boolean(suppliedSecret),
        });
        return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
      }
    }

    logger.info("refresh.auth.allowed", {
      requestId,
      route,
      secretConfigured: Boolean(configuredSecret),
    });

    logDatabaseConfigOnce({ requestId });

    const lastRefreshTime = new Date().toISOString();
    let mode = "static";
    let message = "X_BEARER_TOKEN is not configured; static fallback data is active.";
    let fetched: Record<string, number> | undefined;
    let diagnostics: XRefreshDiagnostics | undefined;
    let yahoo: { source: "live" | "static"; tickers: number } | undefined;

    logger.info("refresh.farside.start", { requestId });
    const farside = await refreshFarsideBtcFlows();
    logger.info("refresh.farside.success", {
      requestId,
      providerStatus: farside.status.status,
      rows: farside.rows.length,
    });

    if (isXConfigured()) {
      logger.info("refresh.x.start", { requestId });
      try {
        const { tweetsByAuthor, diagnostics: xDiagnostics } = await fetchAllTweetsWithDiagnostics();
        diagnostics = xDiagnostics;
        fetched = Object.fromEntries(
          Object.entries(tweetsByAuthor).map(([key, tweets]) => [key, tweets.length]),
        );
        yahoo = await refreshSerenityYahooFacts(requestId, tweetsByAuthor);
        mode = "live";
        message = "Feed cache revalidated after live X fetch.";
        logger.info("refresh.x.success", { requestId, fetched });
      } catch (err) {
        mode = "live-fallback";
        message = err instanceof Error ? err.message : "Live X refresh failed; feed cache was still revalidated.";
        logger.warn("refresh.x.failure", { requestId, error: serializeError(err) });
        yahoo = await refreshSerenityYahooFacts(requestId);
      }
    } else {
      logger.info("refresh.x.skipped", { requestId, reason: "not_configured" });
      yahoo = await refreshSerenityYahooFacts(requestId);
    }

    logger.info("refresh.revalidate.start", { requestId, paths: ["/feed", "/feed/accounts/serenity", "/watchlist"] });
    revalidatePath("/feed");
    revalidatePath("/feed/accounts/serenity");
    revalidatePath("/watchlist");
    logger.info("refresh.revalidate.success", { requestId });

    const durationMs = Date.now() - startedAt;
    logger.info("refresh.success", { requestId, route, mode, durationMs });

    return NextResponse.json({
      ok: true,
      refreshed: true,
      requestId,
      lastRefreshTime,
      mode,
      message,
      providers: {
        farside: farside.status,
      },
      ...(yahoo ? { yahoo } : {}),
      ...(fetched ? { fetched } : {}),
      ...(diagnostics ? { diagnostics } : {}),
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    logger.error("refresh.failure", {
      requestId,
      route,
      durationMs,
      error: serializeError(err),
    });

    return NextResponse.json(
      { ok: false, error: "refresh_failed", requestId },
      { status: 500 },
    );
  }
}
