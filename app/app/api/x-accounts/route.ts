import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { normalizeXHandle } from "@/app/lib/accounts";
import { addAccount, findByHandle } from "@/lib/accounts/server";
import { isXConfigured, verifyXUserExists } from "@/lib/x/server";

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

function isAccountCreationEnabled() {
  return process.env.ACCOUNT_CREATION_DISABLED !== "true";
}

export async function POST(request: Request) {
  if (!isAccountCreationEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Account creation is disabled." },
      { status: 401 },
    );
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
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

  const existing = await findByHandle(handle);
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
    profile = await addAccount({ handle, name });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Account could not be saved." },
      { status: 500 },
    );
  }

  revalidatePath("/feed");
  revalidatePath(`/feed/accounts/${profile.slug}`);
  revalidatePath("/feed/refresh-log");

  return NextResponse.json({ ok: true, account: profile }, { status: 201 });
}

export async function GET() {
  const enabled = isAccountCreationEnabled();
  return NextResponse.json({ enabled });
}
