import "server-only";
import fs from "node:fs";
import path from "node:path";
import { authors as staticAuthors } from "@/app/lib/static-data";
import type { AuthorProfile, Tweet } from "@/app/lib/types";
import { buildAccountCompleteTweetMap, createAuthorDefaults } from "@/app/lib/accounts";
import type { AccountInput } from "@/app/lib/accounts";

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "tracked-accounts.json");

export class AccountStorageError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AccountStorageError";
    this.cause = cause;
  }
}

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    throw new AccountStorageError("Unable to prepare tracked account storage.", err);
  }
}

function readDynamicAccounts(): AuthorProfile[] {
  ensureDataDir();
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AuthorProfile[];
    if (!Array.isArray(parsed)) {
      throw new AccountStorageError("Tracked account storage must contain a JSON array.");
    }
    return parsed;
  } catch (err) {
    if (err instanceof AccountStorageError) {
      throw err;
    }
    throw new AccountStorageError("Unable to read tracked account storage.", err);
  }
}

function writeDynamicAccounts(accounts: AuthorProfile[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
  } catch (err) {
    throw new AccountStorageError("Unable to write tracked account storage.", err);
  }
}

export function getTrackedAuthors(): readonly AuthorProfile[] {
  const dynamic = readDynamicAccounts();
  return [...staticAuthors, ...dynamic];
}

export function getAuthorBySlug(slug: string): AuthorProfile | undefined {
  const lower = slug.toLowerCase();
  return getTrackedAuthors().find((author) => author.slug.toLowerCase() === lower);
}

export function completeTweetsByAuthor(
  tweetsByAuthor: Record<string, readonly Tweet[]>,
): Record<string, readonly Tweet[]> {
  return buildAccountCompleteTweetMap(getTrackedAuthors(), tweetsByAuthor);
}

export function findByHandle(handle: string): AuthorProfile | undefined {
  const lower = handle.toLowerCase();
  const all = getTrackedAuthors();
  return all.find((a) => a.handle.toLowerCase() === lower) as AuthorProfile | undefined;
}

export function addAccount(input: AccountInput): AuthorProfile {
  const existing = getTrackedAuthors();
  const normalized = input.handle;
  const lower = normalized.toLowerCase();

  const dup = existing.find((a) => a.handle.toLowerCase() === lower);
  if (dup) {
    throw new Error(`Account @${normalized} already exists (key: ${dup.key}).`);
  }

  const profile = createAuthorDefaults(input, existing.length);
  const dynamic = readDynamicAccounts();
  dynamic.push(profile);
  writeDynamicAccounts(dynamic);

  return profile;
}
