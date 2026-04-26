import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const configuredSecret = process.env.REFRESH_SHARED_SECRET;

  if (configuredSecret) {
    const suppliedSecret = request.headers.get("x-refresh-secret");
    if (suppliedSecret !== configuredSecret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "prototype",
    message: "Refresh worker is not wired yet; static fallback data is active.",
  });
}
