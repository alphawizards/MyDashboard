import { NextResponse } from "next/server";
import { refreshWatchlistDashboard } from "@/app/lib/watchlist-data";
import type { WatchlistRefreshResponse } from "@/app/lib/types";

export async function POST() {
  try {
    const dashboard = await refreshWatchlistDashboard();

    return NextResponse.json({
      ok: true,
      ...dashboard,
    } satisfies WatchlistRefreshResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Watchlist refresh failed";

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
