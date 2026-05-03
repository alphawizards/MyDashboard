import "server-only";
import fs from "node:fs";
import path from "node:path";
import { authors as staticAuthors } from "@/app/lib/static-data";
import type { AuthorProfile, Tweet } from "@/app/lib/types";
import { buildAccountCompleteTweetMap, createAuthorDefaults } from "@/app/lib/accounts";
import type { AccountInput } from "@/app/lib/accounts";

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "tracked-accounts.json");

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
