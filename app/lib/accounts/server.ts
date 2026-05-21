import "server-only";
import fs from "node:fs";
import path from "node:path";
import { authors as staticAuthors } from "@/app/lib/static-data";
import type { AuthorProfile, Tweet } from "@/app/lib/types";
import { buildAccountCompleteTweetMap, createAuthorDefaults } from "@/app/lib/accounts";
import type { AccountInput } from "@/app/lib/accounts";
import { queryRows } from "@/lib/db/postgres";

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "tracked-accounts.json");

type TrackedAccountRow = {
  key: string;
  slug: string;
  handle: string;
  name: string;
  short_name: string;
  color: string;
  bio: string | null;
  followers: string | null;
  avatar: string | null;
  platform: string | null;
  win_rate: number | string | null;
  shadow_score: number | string | null;
  rank_source: string | null;
};

let trackedAccountsSchemaReady = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDynamicAccounts(): AuthorProfile[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      fs.writeFileSync(ACCOUNTS_FILE, "[]", "utf-8");
      return [];
    }
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AuthorProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDynamicAccounts(accounts: AuthorProfile[]): void {
  ensureDataDir();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
}

function numberOrUndefined(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rowToAuthor(row: TrackedAccountRow): AuthorProfile {
  return {
    key: row.key,
    slug: row.slug,
    handle: row.handle,
    name: row.name,
    shortName: row.short_name,
    color: row.color,
    bio: row.bio ?? "",
    followers: row.followers ?? "N/A",
    avatar: row.avatar,
    platform: row.platform ?? "X",
    winRate: numberOrUndefined(row.win_rate),
    shadowScore: numberOrUndefined(row.shadow_score),
    rankSource: row.rank_source ?? undefined,
  };
}

function mergeAuthors(dynamic: readonly AuthorProfile[]): AuthorProfile[] {
  const merged: AuthorProfile[] = [...staticAuthors];
  const seenKeys = new Set(merged.map((author) => author.key.toLowerCase()));
  const seenHandles = new Set(merged.map((author) => author.handle.toLowerCase()));

  for (const author of dynamic) {
    const key = author.key.toLowerCase();
    const handle = author.handle.toLowerCase();
    if (seenKeys.has(key) || seenHandles.has(handle)) continue;

    merged.push(author);
    seenKeys.add(key);
    seenHandles.add(handle);
  }

  return merged;
}

async function ensureTrackedAccountsSchema(): Promise<boolean> {
  if (trackedAccountsSchemaReady) return true;

  try {
    const rows = await queryRows(`
      create table if not exists tracked_accounts (
        key                 text primary key,
        slug                text not null unique,
        handle              text not null unique,
        name                text not null,
        short_name          text not null,
        color               text not null,
        bio                 text not null default '',
        followers           text not null default 'N/A',
        avatar              text,
        platform            text not null default 'X',
        win_rate            int,
        shadow_score        int,
        rank_source         text,
        author_id           text,
        active              boolean not null default true,
        last_tweet_id       text,
        last_refreshed_at   timestamptz,
        created_at          timestamptz not null default now(),
        updated_at          timestamptz not null default now()
      );
    `);

    trackedAccountsSchemaReady = rows !== null;
    return trackedAccountsSchemaReady;
  } catch {
    return false;
  }
}

async function readDbAccounts(): Promise<AuthorProfile[] | null> {
  if (!(await ensureTrackedAccountsSchema())) return null;

  try {
    const rows = await queryRows<TrackedAccountRow>(
      `
        select key, slug, handle, name, short_name, color, bio, followers, avatar,
               platform, win_rate, shadow_score, rank_source
        from tracked_accounts
        where active = true
        order by created_at asc, key asc
      `,
    );

    if (!rows) return null;
    return rows.map(rowToAuthor);
  } catch {
    return null;
  }
}

async function insertDbAccount(author: AuthorProfile): Promise<boolean> {
  if (!(await ensureTrackedAccountsSchema())) return false;

  await queryRows(
    `
      insert into tracked_accounts (
        key, slug, handle, name, short_name, color, bio, followers, avatar,
        platform, win_rate, shadow_score, rank_source, active, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,now())
    `,
    [
      author.key,
      author.slug,
      author.handle,
      author.name,
      author.shortName,
      author.color,
      author.bio,
      author.followers,
      author.avatar,
      author.platform ?? "X",
      author.winRate ?? null,
      author.shadowScore ?? null,
      author.rankSource ?? null,
    ],
  );

  return true;
}

export async function getTrackedAuthors(): Promise<readonly AuthorProfile[]> {
  const dbAccounts = await readDbAccounts();
  const dynamic = dbAccounts === null ? readDynamicAccounts() : [...dbAccounts, ...readDynamicAccounts()];
  return mergeAuthors(dynamic);
}

export async function getAuthorBySlug(slug: string): Promise<AuthorProfile | undefined> {
  const lower = slug.toLowerCase();
  const authors = await getTrackedAuthors();
  return authors.find((author) => author.slug.toLowerCase() === lower);
}

export async function completeTweetsByAuthor(
  tweetsByAuthor: Record<string, readonly Tweet[]>,
): Promise<Record<string, readonly Tweet[]>> {
  return buildAccountCompleteTweetMap(await getTrackedAuthors(), tweetsByAuthor);
}

export async function findByHandle(handle: string): Promise<AuthorProfile | undefined> {
  const lower = handle.toLowerCase();
  const all = await getTrackedAuthors();
  return all.find((a) => a.handle.toLowerCase() === lower) as AuthorProfile | undefined;
}

export async function addAccount(input: AccountInput): Promise<AuthorProfile> {
  const existing = await getTrackedAuthors();
  const normalized = input.handle;
  const lower = normalized.toLowerCase();

  const dup = existing.find((a) => a.handle.toLowerCase() === lower);
  if (dup) {
    throw new Error(`Account @${normalized} already exists (key: ${dup.key}).`);
  }

  const profile = createAuthorDefaults(input, existing.length);
  const savedToDb = await insertDbAccount(profile);
  if (!savedToDb) {
    const dynamic = readDynamicAccounts();
    dynamic.push(profile);
    writeDynamicAccounts(dynamic);
  }

  return profile;
}
