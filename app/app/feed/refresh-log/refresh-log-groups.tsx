"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AuthorProfile } from "@/app/lib/types";
import type { XRefreshLogRun } from "@/lib/x/cache";

type RefreshLogGroupsProps = {
  runs: XRefreshLogRun[];
  authors: readonly AuthorProfile[];
};

type RefreshLogDay = {
  key: string;
  label: string;
  isToday: boolean;
  runs: XRefreshLogRun[];
  totalNewTweets: number;
};

function formatDateTime(value: string | null): string {
  if (!value) return "Not finished";

  return `${new Date(value).toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "medium",
    timeStyle: "short",
  })} AEST`;
}

function formatDateKey(value: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "full",
  });
}

function statusLabel(run: XRefreshLogRun): string {
  if (run.ok === null) return "Running";
  return run.ok ? "Success" : "Failed";
}

function buildDayGroups(runs: XRefreshLogRun[]): RefreshLogDay[] {
  const todayKey = formatDateKey(new Date().toISOString());
  const groups = new Map<string, RefreshLogDay>();

  for (const run of runs) {
    const key = formatDateKey(run.startedAt);
    const group = groups.get(key) ?? {
      key,
      label: formatDateLabel(run.startedAt),
      isToday: key === todayKey,
      runs: [],
      totalNewTweets: 0,
    };

    group.runs.push(run);
    group.totalNewTweets += run.totalNewTweets;
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function RefreshLogGroups({ runs, authors }: RefreshLogGroupsProps) {
  const authorByKey = useMemo(
    () => Object.fromEntries(authors.map((author) => [author.key, author])) as Record<string, AuthorProfile>,
    [authors],
  );
  const dayGroups = useMemo(() => buildDayGroups(runs), [runs]);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>(
    () => Object.fromEntries(dayGroups.map((group) => [group.key, group.isToday])),
  );

  if (!dayGroups.length) {
    return <section className="empty-state">No refresh logs have been saved yet.</section>;
  }

  return (
    <section className="refresh-log-list" aria-label="Refresh history">
      {dayGroups.map((group) => {
        const open = openDays[group.key] ?? group.isToday;

        return (
          <section className="refresh-log-day" key={group.key}>
            <button
              aria-expanded={open}
              className="refresh-log-day-toggle"
              onClick={() => setOpenDays((current) => ({ ...current, [group.key]: !open }))}
              type="button"
            >
              <span>{open ? "v" : ">"} {group.label}</span>
              <span>
                {group.runs.length} run{group.runs.length === 1 ? "" : "s"} - {group.totalNewTweets} new tweets
              </span>
            </button>

            {open ? (
              <div className="refresh-log-day-runs">
                {group.runs.map((run) => (
                  <RefreshLogRunCard authorByKey={authorByKey} key={run.id} run={run} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </section>
  );
}

function RefreshLogRunCard({
  authorByKey,
  run,
}: {
  authorByKey: Record<string, AuthorProfile>;
  run: XRefreshLogRun;
}) {
  return (
    <article className="refresh-log-run">
      <div className="refresh-log-run-header">
        <div>
          <h2>{formatDateTime(run.startedAt)}</h2>
          <p>
            {statusLabel(run)} - {run.triggeredBy} - {run.mode ?? "unknown"} - request {run.requestId}
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
  );
}
