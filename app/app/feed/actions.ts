"use server";

import { POST } from "@/app/api/refresh/all/route";

export type RefreshFeedActionResult = {
  ok?: boolean;
  refreshed?: boolean;
  requestId?: string;
  lastRefreshTime?: string;
  mode?: string;
  message?: string;
  error?: string;
  status: number;
  audit?: {
    runId: number | null;
    triggeredBy: "button" | "cron" | "unknown";
    totalNewTweets: number;
    accounts: {
      authorKey: string;
      handle: string;
      newTweetCount: number;
      newTweetIds: string[];
      newTickers: string[];
      status: "updated" | "no_new_tweets" | "failed" | "skipped";
      error?: string;
    }[];
  };
};

export async function refreshFeedFromButton(): Promise<RefreshFeedActionResult> {
  const headers = new Headers({ "x-refresh-trigger": "button" });
  const refreshSecret = process.env.REFRESH_SHARED_SECRET;

  if (refreshSecret) {
    headers.set("x-refresh-secret", refreshSecret);
  }

  const response = await POST(new Request("http://localhost/api/refresh/all", {
    method: "POST",
    headers,
  }));
  const body = await response.json().catch(() => ({}));

  return {
    ...body,
    status: response.status,
  };
}
