import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { normalizeXHandle } from "@/app/lib/accounts";
import { addAccount, findByHandle } from "@/lib/accounts/server";
import { isXConfigured, verifyXUserExists } from "@/lib/x/server";

function isLocalAccountCreationEnabled(): boolean {
  return (
    process.env.LOCAL_ACCOUNT_CREATION_ENABLED === "true" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.REFRESH_SHARED_SECRET
  );
}

function storageErrorResponse() {
  return NextResponse.json(
    { ok: false, error: "Tracked account storage is unavailable. Check data/tracked-accounts.json." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  // Dynamic account storage is a local development convenience until durable
  // admin-backed persistence exists.
  if (!isLocalAccountCreationEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Local account creation is disabled." },
      { status: 403 },
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

  let existing;
  try {
    existing = findByHandle(handle);
  } catch {
    return storageErrorResponse();
  }

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

  let profile;
  try {
    profile = addAccount({ handle, name });
  } catch {
    return storageErrorResponse();
  }

  revalidatePath("/feed");

  return NextResponse.json({ ok: true, account: profile }, { status: 201 });
}

export async function GET() {
  const enabled = isLocalAccountCreationEnabled();
  return NextResponse.json({ enabled });
}
