import type { AuthorProfile, Tweet } from "./types";

const HANDLE_RE = /^[a-zA-Z0-9_]{1,15}$/;

export function normalizeXHandle(raw: string): string {
  const trimmed = raw.trim();
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const urlMatch = withoutAt.match(
    /(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)(?:\/|$)/i,
  );
  const handle = urlMatch ? urlMatch[1] : withoutAt;
  if (!HANDLE_RE.test(handle)) {
    throw new Error(
      `Invalid X handle "${raw}". Handles must be 1-15 characters using letters, numbers, or underscore.`,
    );
  }
  return handle;
}

const PALETTE = [
  "#4fc3f7",
  "#10b981",
  "#a78bfa",
  "#f43f5e",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#e11d48",
  "#0ea5e9",
  "#22c55e",
  "#d946ef",
];

export function nextColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export interface AccountInput {
  handle: string;
  name: string;
}

export function createAuthorDefaults(input: AccountInput, existingCount: number) {
  const normalized = normalizeXHandle(input.handle);
  const key = `u_${normalized.toLowerCase()}`;
  const slug = normalized.toLowerCase();
  const shortName =
    input.name.length > 10
      ? input.name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 4)
      : input.name;
  const color = PALETTE[existingCount % PALETTE.length];

  return {
    key,
    slug,
    name: input.name,
    shortName,
    handle: normalized,
    color,
    bio: "",
    followers: "N/A",
    avatar: null,
    platform: "X",
  };
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

export function buildAccountCompleteTweetMap(
  authors: readonly AuthorProfile[],
  tweetsByAuthor: Record<string, readonly Tweet[]>,
): Record<string, readonly Tweet[]> {
  return Object.fromEntries(
    authors.map((author) => [author.key, tweetsByAuthor[author.key] ?? []]),
  );
}
