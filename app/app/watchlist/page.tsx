import { getWatchlistDashboardData } from "../lib/watchlist-data";
import { WatchlistDashboard } from "./watchlist-dashboard";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const dashboard = await getWatchlistDashboardData();

  return (
    <main className="app-shell">
      <WatchlistDashboard initialData={dashboard} />
    </main>
  );
}
