import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");

  if (origin && origin !== requestUrl.origin) {
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

  return fetch(new URL("/api/refresh/all", requestUrl), {
    method: "POST",
    headers,
    cache: "no-store",
  });
}
