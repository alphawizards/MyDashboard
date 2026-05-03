import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { normalizeXHandle } from "@/app/lib/accounts";
import { addAccount, findByHandle } from "@/lib/accounts/server";
import { isXConfigured, verifyXUserExists } from "@/lib/x/server";

export async function POST(request: Request) {
  // When REFRESH_SHARED_SECRET is configured, admin auth is assumed to exist
  // but no client-facing auth mechanism is implemented yet. Disable account
  // creation via the browser until a proper admin session is available.
  if (process.env.REFRESH_SHARED_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Account creation is not available when admin auth is configured." },
      { status: 401 },
    );
  }

  let body: { handle?: string; name?: string };
  try {
    body = (await request.json()) as { handle?: string; name?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawHandle = body.handle?.trim();
  const name = body.name?.trim();

  if (!rawHandle || !name) {
    return NextResponse.json(
      { ok: false, error: "handle and name are required" },
      { status: 400 },
    );
  }

  if (name.length > 100) {
    return NextResponse.json(
      { ok: false, error: "name must be 100 characters or fewer" },
      { status: 400 },
    );
  }

  let handle: string;
  try {
    handle = normalizeXHandle(rawHandle);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid handle" },
      { status: 400 },
    );
  }

  const existing = findByHandle(handle);
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `Account @${handle} already exists (key: ${existing.key}).` },
      { status: 409 },
    );
  }

  if (isXConfigured()) {
    const { exists, diagnostic } = await verifyXUserExists(handle);
    if (!exists) {
      const detail = diagnostic.error ?? "Unknown X API error";
      return NextResponse.json(
        { ok: false, error: `X user @${handle} not found. ${detail}` },
        { status: 422 },
      );
    }
  }

  const profile = addAccount({ handle, name });

  revalidatePath("/feed");

  return NextResponse.json({ ok: true, account: profile }, { status: 201 });
}

export async function GET() {
  const enabled = !process.env.REFRESH_SHARED_SECRET;
  return NextResponse.json({ enabled });
}
