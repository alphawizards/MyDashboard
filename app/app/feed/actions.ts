"use server";

import { POST } from "@/app/api/refresh/all/route";
import type { XRefreshAuditSummary } from "@/lib/x/cache";

export type RefreshFeedActionResult = {
  ok?: boolean;
  refreshed?: boolean;
  requestId?: string;
  lastRefreshTime?: string;
  mode?: string;
  message?: string;
  error?: string;
  status: number;
  audit?: XRefreshAuditSummary;
};

export async function refreshFeedFromButton(): Promise<RefreshFeedActionResult> {
  const headers = new Headers({ "x-refresh-trigger": "button" });
  const refreshSecret = process.env.REFRESH_SHARED_SECRET;

  if (refreshSecret) {
    headers.set("x-refresh-secret", refreshSecret);
  }

  // In-process function call to the route handler, not an HTTP request.
  // The URL string is only used for Request object construction.
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
