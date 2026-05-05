import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { refreshFarsideBtcFlows } from "@/app/lib/watchlist/farside";
import { logDatabaseConfigOnce } from "@/lib/db-config";
import { createRequestId, logger, serializeError } from "@/lib/logger";
import { fetchAllTweetsWithDiagnostics, isXConfigured } from "@/lib/x/server";
import type { XRefreshDiagnostics } from "@/lib/x/server";

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
        mode = "live";
        message = "Feed cache revalidated after live X fetch.";
        logger.info("refresh.x.success", { requestId, fetched });
      } catch (err) {
        mode = "live-fallback";
        message = err instanceof Error ? err.message : "Live X refresh failed; feed cache was still revalidated.";
        logger.warn("refresh.x.failure", { requestId, error: serializeError(err) });
      }
    } else {
      logger.info("refresh.x.skipped", { requestId, reason: "not_configured" });
    }

    logger.info("refresh.revalidate.start", { requestId, paths: ["/feed", "/watchlist"] });
    revalidatePath("/feed");
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
