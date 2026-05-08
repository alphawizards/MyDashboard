import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { buildAccountCompleteTweetMap } from "@/app/lib/accounts";
import { tweetsByAuthor as staticTweetsByAuthor } from "@/app/lib/static-data";
import type { Tweet } from "@/app/lib/types";
import { refreshFarsideBtcFlows } from "@/app/lib/watchlist/farside";
import { getTrackedAuthors } from "@/lib/accounts/server";
import { logDatabaseConfigOnce } from "@/lib/db-config";
import { createRequestId, logger, serializeError } from "@/lib/logger";
import { fetchAllTweetsWithDiagnostics, isXConfigured } from "@/lib/x/server";
import type { XRefreshDiagnostics } from "@/lib/x/server";
import { buildTickerMentionCounts, refreshTickerFacts } from "@/lib/stocks/account-tracker";

function getAccountTickerRefreshPlan(tweetsByAuthor?: Record<string, Tweet[]>): {
  accounts: number;
  source: "live" | "mixed" | "static";
  tickers: string[];
} {
  const authors = getTrackedAuthors();
  const completeTweetsByAuthor = buildAccountCompleteTweetMap(
    authors,
    tweetsByAuthor ? { ...staticTweetsByAuthor, ...tweetsByAuthor } : staticTweetsByAuthor,
  );
  const tickers = new Set<string>();
  let accountsWithLiveTweets = 0;
  let accountsWithTickers = 0;

  for (const author of authors) {
    const liveTweets = tweetsByAuthor?.[author.key] ?? [];
    const accountTweets = completeTweetsByAuthor[author.key] ?? [];
    const accountTickers = Object.keys(buildTickerMentionCounts(accountTweets));
    if (liveTweets.length) accountsWithLiveTweets += 1;
    if (accountTickers.length) accountsWithTickers += 1;
    accountTickers.forEach((ticker) => tickers.add(ticker));
  }

  return {
    accounts: accountsWithTickers,
    source: !tweetsByAuthor ? "static" : accountsWithLiveTweets === authors.length ? "live" : "mixed",
    tickers: [...tickers],
  };
}

async function refreshAccountTickerFacts(
  requestId: string,
  tweetsByAuthor?: Record<string, Tweet[]>,
): Promise<{ accounts: number; source: "live" | "mixed" | "static"; tickers: number }> {
  const { accounts, source, tickers } = getAccountTickerRefreshPlan(tweetsByAuthor);

  if (!tickers.length) {
    logger.info("refresh.yahoo.accounts.skipped", { requestId, accounts, source, reason: "no_tickers" });
    return { accounts, source, tickers: 0 };
  }

  logger.info("refresh.yahoo.accounts.start", { requestId, accounts, source, tickers: tickers.length });
  await refreshTickerFacts(tickers);
  logger.info("refresh.yahoo.accounts.success", { requestId, accounts, source, tickers: tickers.length });

  return { accounts, source, tickers: tickers.length };
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
    let yahoo: { accounts: number; source: "live" | "mixed" | "static"; tickers: number } | undefined;

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
        yahoo = await refreshAccountTickerFacts(requestId, tweetsByAuthor);
        mode = "live";
        message = "Feed cache revalidated after live X fetch.";
        logger.info("refresh.x.success", { requestId, fetched });
      } catch (err) {
        mode = "live-fallback";
        message = err instanceof Error ? err.message : "Live X refresh failed; feed cache was still revalidated.";
        logger.warn("refresh.x.failure", { requestId, error: serializeError(err) });
        yahoo = await refreshAccountTickerFacts(requestId);
      }
    } else {
      logger.info("refresh.x.skipped", { requestId, reason: "not_configured" });
      yahoo = await refreshAccountTickerFacts(requestId);
    }

    const accountPaths = getTrackedAuthors().map((author) => `/feed/accounts/${author.slug}`);
    const revalidatePaths = ["/feed", ...accountPaths, "/watchlist"];
    logger.info("refresh.revalidate.start", { requestId, paths: revalidatePaths });
    revalidatePath("/feed");
    accountPaths.forEach((path) => revalidatePath(path));
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
