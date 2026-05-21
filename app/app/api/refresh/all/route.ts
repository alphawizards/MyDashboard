import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { buildAccountCompleteTweetMap } from "@/app/lib/accounts";
import { tweetsByAuthor as staticTweetsByAuthor } from "@/app/lib/static-data";
import type { Tweet } from "@/app/lib/types";
import { refreshFarsideBtcFlows } from "@/app/lib/watchlist/farside";
import { getTrackedAuthors } from "@/lib/accounts/server";
import { logDatabaseConfigOnce } from "@/lib/db-config";
import { createRequestId, logger, serializeError } from "@/lib/logger";
import {
  completeXRefreshRun,
  createXRefreshRun,
  insertXAccountRefreshEvents,
  type XAccountRefreshLogEvent,
  type XRefreshAuditSummary,
  type XRefreshTrigger,
} from "@/lib/x/cache";
import { fetchAllTweetsWithDiagnostics, isXConfigured } from "@/lib/x/server";
import type { XRefreshDiagnostics } from "@/lib/x/server";
import { buildTickerMentionCounts, refreshTickerFacts } from "@/lib/stocks/account-tracker";

async function getAccountTickerRefreshPlan(tweetsByAuthor?: Record<string, Tweet[]>): Promise<{
  accounts: number;
  source: "live" | "mixed" | "static";
  tickers: string[];
}> {
  const authors = await getTrackedAuthors();
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
  const { accounts, source, tickers } = await getAccountTickerRefreshPlan(tweetsByAuthor);

  if (!tickers.length) {
    logger.info("refresh.yahoo.accounts.skipped", { requestId, accounts, source, reason: "no_tickers" });
    return { accounts, source, tickers: 0 };
  }

  logger.info("refresh.yahoo.accounts.start", { requestId, accounts, source, tickers: tickers.length });
  await refreshTickerFacts(tickers);
  logger.info("refresh.yahoo.accounts.success", { requestId, accounts, source, tickers: tickers.length });

  return { accounts, source, tickers: tickers.length };
}

function getRefreshTrigger(request: Request): XRefreshTrigger {
  const trigger = request.headers.get("x-refresh-trigger");
  if (trigger === "button" || trigger === "cron") return trigger;
  return "unknown";
}

async function buildSkippedAccountEvents(status: XAccountRefreshLogEvent["status"], error?: string): Promise<XAccountRefreshLogEvent[]> {
  const authors = await getTrackedAuthors();
  return authors.map((author) => ({
    authorKey: author.key,
    handle: author.handle,
    previousLastTweetId: null,
    newLastTweetId: null,
    newTweetCount: 0,
    newTweetIds: [],
    newTickers: [],
    status,
    ...(error ? { error } : {}),
  }));
}

function countNewTweets(events: readonly XAccountRefreshLogEvent[]): number {
  return events.reduce((sum, event) => sum + event.newTweetCount, 0);
}

export async function POST(request: Request) {
  const requestId = createRequestId(request);
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const route = "/api/refresh/all";
  const triggeredBy = getRefreshTrigger(request);
  let refreshRunId: number | null = null;

  logger.info("refresh.start", { requestId, route, triggeredBy });

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
    refreshRunId = await createXRefreshRun({ requestId, triggeredBy, startedAtIso });

    const lastRefreshTime = new Date().toISOString();
    let mode = "static";
    let message = "X_BEARER_TOKEN is not configured; static fallback data is active.";
    let fetched: Record<string, number> | undefined;
    let diagnostics: XRefreshDiagnostics | undefined;
    let yahoo: { accounts: number; source: "live" | "mixed" | "static"; tickers: number } | undefined;
    let accountEvents: XAccountRefreshLogEvent[] = [];

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
        const { tweetsByAuthor, diagnostics: xDiagnostics, accountEvents: xAccountEvents } = await fetchAllTweetsWithDiagnostics();
        diagnostics = xDiagnostics;
        accountEvents = xAccountEvents ?? [];
        fetched = Object.fromEntries(
          Object.entries(tweetsByAuthor).map(([key, tweets]) => [key, tweets.length]),
        );
        const auditInsert = await insertXAccountRefreshEvents(refreshRunId, accountEvents);
        yahoo = await refreshAccountTickerFacts(requestId, tweetsByAuthor);
        mode = "live";
        message = "Feed cache revalidated after live X fetch.";
        logger.info("refresh.x.success", { requestId, fetched, auditInsert });
      } catch (err) {
        mode = "live-fallback";
        message = err instanceof Error ? err.message : "Live X refresh failed; feed cache was still revalidated.";
        logger.warn("refresh.x.failure", { requestId, error: serializeError(err) });
        accountEvents = await buildSkippedAccountEvents("failed", message);
        const auditInsert = await insertXAccountRefreshEvents(refreshRunId, accountEvents);
        logger.info("refresh.audit.events.saved", { requestId, auditInsert });
        yahoo = await refreshAccountTickerFacts(requestId);
      }
    } else {
      logger.info("refresh.x.skipped", { requestId, reason: "not_configured" });
      accountEvents = await buildSkippedAccountEvents("skipped", "X_BEARER_TOKEN is not configured.");
      const auditInsert = await insertXAccountRefreshEvents(refreshRunId, accountEvents);
      logger.info("refresh.audit.events.saved", { requestId, auditInsert });
      yahoo = await refreshAccountTickerFacts(requestId);
    }

    const accountPaths = (await getTrackedAuthors()).map((author) => `/feed/accounts/${author.slug}`);
    const revalidatePaths = ["/feed", ...accountPaths, "/watchlist"];
    logger.info("refresh.revalidate.start", { requestId, paths: revalidatePaths });
    revalidatePath("/feed");
    accountPaths.forEach((path) => revalidatePath(path));
    revalidatePath("/watchlist");
    logger.info("refresh.revalidate.success", { requestId });

    const durationMs = Date.now() - startedAt;
    const totalNewTweets = countNewTweets(accountEvents);
    const audit: XRefreshAuditSummary = {
      runId: refreshRunId,
      triggeredBy,
      totalNewTweets,
      accounts: accountEvents,
    };
    await completeXRefreshRun({
      runId: refreshRunId,
      finishedAtIso: new Date().toISOString(),
      ok: true,
      mode,
      message,
      totalNewTweets,
      diagnostics,
    });
    logger.info("refresh.success", { requestId, route, mode, durationMs, audit });

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
      audit,
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
    await completeXRefreshRun({
      runId: refreshRunId,
      finishedAtIso: new Date().toISOString(),
      ok: false,
      mode: "failed",
      message: err instanceof Error ? err.message : "Refresh failed.",
      totalNewTweets: 0,
    });

    return NextResponse.json(
      { ok: false, error: "refresh_failed", requestId },
      { status: 500 },
    );
  }
}
