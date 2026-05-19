import { NextResponse } from "next/server";
import { POST as refreshAll } from "../all/route";

function getRequestHosts(request: Request) {
  const requestUrl = new URL(request.url);
  return [
    requestUrl.host,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
  ].filter(Boolean);
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    return getRequestHosts(request).includes(originHost);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const headers = new Headers({ "x-refresh-trigger": "button" });
  const requestId = request.headers.get("x-request-id");
  const refreshSecret = process.env.REFRESH_SHARED_SECRET;

  if (requestId) {
    headers.set("x-request-id", requestId);
  }
  if (refreshSecret) {
    headers.set("x-refresh-secret", refreshSecret);
  }

  return refreshAll(new Request("http://localhost/api/refresh/all", {
    method: "POST",
    headers,
  }));
}
