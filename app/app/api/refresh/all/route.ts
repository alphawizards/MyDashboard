import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fetchAllTweets, isXConfigured } from "@/lib/x/server";

export async function POST(request: Request) {
  const configuredSecret = process.env.REFRESH_SHARED_SECRET;

  if (configuredSecret) {
    const suppliedSecret = request.headers.get("x-refresh-secret");
    if (suppliedSecret !== configuredSecret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const lastRefreshTime = new Date().toISOString();
  let mode = "static";
  let message = "X_BEARER_TOKEN is not configured; static fallback data is active.";
  let fetched: Record<string, number> | undefined;

  if (isXConfigured()) {
    try {
      const tweetsByAuthor = await fetchAllTweets();
      fetched = Object.fromEntries(
        Object.entries(tweetsByAuthor).map(([key, tweets]) => [key, tweets.length]),
      );
      mode = "live";
      message = "Feed cache revalidated after live X fetch.";
    } catch (err) {
      mode = "live-fallback";
      message = err instanceof Error ? err.message : "Live X refresh failed; feed cache was still revalidated.";
    }
  }

  revalidatePath("/feed");

  return NextResponse.json({
    ok: true,
    refreshed: true,
    lastRefreshTime,
    mode,
    message,
    ...(fetched ? { fetched } : {}),
  });
}
