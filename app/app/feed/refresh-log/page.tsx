import Link from "next/link";
import { getTrackedAuthors } from "@/lib/accounts/server";
import { getXRefreshLogRuns, type XRefreshLogRun } from "@/lib/x/cache";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) return "Not finished";

  return `${new Date(value).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "medium",
    timeStyle: "short",
  })} AEST`;
}

function statusLabel(run: XRefreshLogRun): string {
  if (run.ok === null) return "Running";
  return run.ok ? "Success" : "Failed";
}

export default async function RefreshLogPage() {
  const [runs, authors] = await Promise.all([
    getXRefreshLogRuns(30),
    getTrackedAuthors(),
  ]);
  const authorByKey = Object.fromEntries(authors.map((author) => [author.key, author]));

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">X tracker</p>
          <h1>Refresh Log</h1>
          <p className="subtitle">
            Recent feed refreshes by date, account, new tweets, ticker mentions, and X API status.
          </p>
        </div>
        <nav className="nav-actions" aria-label="Dashboard navigation">
          <Link className="nav-btn" href="/feed">
            X Tracker
          </Link>
          <Link className="nav-btn" href="/">
            Home
          </Link>
          <Link className="nav-btn" href="/watchlist">
            Watchlist
          </Link>
          <Link className="nav-btn" href="/portfolios">
            Portfolios
          </Link>
          <Link className="nav-btn" href="/feed/refresh-log">
            Logs
          </Link>
        </nav>
      </header>

      {runs.length ? (
        <section className="refresh-log-list" aria-label="Refresh history">
          {runs.map((run) => (
            <article className="refresh-log-run" key={run.id}>
              <div className="refresh-log-run-header">
                <div>
                  <h2>{formatDateTime(run.startedAt)}</h2>
                  <p>
                    {statusLabel(run)} · {run.triggeredBy} · {run.mode ?? "unknown"} · request {run.requestId}
                  </p>
                </div>
                <div className="refresh-log-total">
                  <strong>{run.totalNewTweets}</strong>
                  <span>new tweets</span>
                </div>
              </div>

              {run.message ? <p className="refresh-log-message">{run.message}</p> : null}

              <div className="refresh-log-table" role="table" aria-label={`Refresh run ${run.id} account updates`}>
                <div className="refresh-log-row refresh-log-head" role="row">
                  <span>Account</span>
                  <span>Status</span>
                  <span>New</span>
                  <span>Tickers</span>
                  <span>Tweet IDs</span>
                </div>
                {run.accounts.length ? (
                  run.accounts.map((event) => {
                    const author = authorByKey[event.authorKey];
                    const displayName = author?.name ?? event.handle;
                    const accountHref = author ? `/feed/accounts/${author.slug}` : `https://x.com/${event.handle}`;

                    return (
                      <div className="refresh-log-row" role="row" key={`${run.id}-${event.authorKey}`}>
                        <span>
                          <Link href={accountHref}>
                            {displayName}
                          </Link>
                          <small>@{event.handle}</small>
                        </span>
                        <span className={`refresh-log-status ${event.status}`}>{event.status.replaceAll("_", " ")}</span>
                        <span>{event.newTweetCount}</span>
                        <span>{event.newTickers.length ? event.newTickers.join(", ") : "-"}</span>
                        <span>
                          {event.newTweetIds.length ? event.newTweetIds.join(", ") : "-"}
                          {event.error ? <small>{event.error}</small> : null}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">No account-level events were saved for this refresh.</div>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          No refresh logs have been saved yet.
        </section>
      )}
    </main>
  );
}
