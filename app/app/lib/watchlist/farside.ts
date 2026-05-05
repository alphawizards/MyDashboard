import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { farsideHtml } from "@/app/lib/static-data";
import {
  BTC_ETF_FLOW_COLUMNS,
  type BtcEtfFlowColumn,
  type BtcEtfFlowRow,
  type BtcEtfFlowsSnapshot,
} from "@/app/lib/types";

export const FARSIDE_BTC_ETF_SOURCE_URL = "https://farside.co.uk/bitcoin-etf-flow-all-data/";

const REQUIRED_HEADERS = ["Date", ...BTC_ETF_FLOW_COLUMNS] as const;
const LOG_PREFIX = "[watchlist:farside]";
const BUNDLED_SNAPSHOT_FETCHED_AT = "2026-04-25T06:43:00+10:00";
const CACHE_PATH = path.join(process.cwd(), ".cache", "farside-btc-flows.json");

type FarsideCache = {
  fetchedAt: string;
  sourceUrl: string;
  rows: BtcEtfFlowRow[];
};

type ParseResult = {
  rows: BtcEtfFlowRow[];
  tableCount: number;
  chosenHeaders: string[];
  parsedRowsBeforeFiltering: number;
  parsedRowsAfterFiltering: number;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function logInfo(message: string, data: Record<string, unknown> = {}) {
  console.info(LOG_PREFIX, message, data);
}

function logWarn(message: string, data: Record<string, unknown> = {}) {
  console.warn(LOG_PREFIX, message, data);
}

function normalizeText(value: string) {
  return decodeHtml(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string) {
  return normalizeText(value).toLowerCase();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: string) {
  return normalizeText(value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, ""));
}

function extractTables(html: string) {
  return [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
}

function extractRows(tableHtml: string) {
  return [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function extractCells(rowHtml: string) {
  return [...rowHtml.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => stripTags(match[1]));
}

function findHeaderRow(rows: string[]) {
  for (let index = 0; index < rows.length; index += 1) {
    const cells = extractCells(rows[index]);
    const normalized = cells.map(normalizeHeader);
    const hasRequired = REQUIRED_HEADERS.every((header) => normalized.includes(normalizeHeader(header)));
    if (hasRequired) return { index, headers: cells };
  }

  return null;
}

export function parseFarsideValue(rawValue: string): number | null {
  const value = normalizeText(rawValue).replace(/[–—]/g, "-");
  if (!value || value === "-") return null;

  const isParentheticalNegative = /^\(.+\)$/.test(value);
  const numeric = value.replace(/[(),$]/g, "").replace(/\s/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(numeric)) return null;

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  return isParentheticalNegative ? -Math.abs(parsed) : parsed;
}

export function parseFarsideDate(rawDate: string): { iso: string; label: string; time: number } | null {
  const value = normalizeText(rawDate);
  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  const year = Number(match[3]);
  if (!Number.isInteger(day) || month === undefined || !Number.isInteger(year)) return null;

  const time = Date.UTC(year, month, day);
  const date = new Date(time);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;

  return {
    iso: date.toISOString().slice(0, 10),
    label: `${String(day).padStart(2, "0")} ${match[2].slice(0, 3)} ${year}`,
    time,
  };
}

export function parseFarsideBtcEtfFlows(html: string): ParseResult {
  if (!html.trim()) {
    throw new Error("Farside HTML was empty.");
  }

  const tables = extractTables(html);
  if (tables.length === 0) {
    throw new Error("No HTML tables found in Farside response.");
  }

  for (const table of tables) {
    const rows = extractRows(table);
    const headerRow = findHeaderRow(rows);
    if (!headerRow) continue;

    const headerIndexByName = new Map(headerRow.headers.map((header, index) => [normalizeHeader(header), index]));
    const parsedRows: BtcEtfFlowRow[] = [];

    for (const rowHtml of rows.slice(headerRow.index + 1)) {
      const cells = extractCells(rowHtml);
      const dateCellIndex = headerIndexByName.get("date");
      if (dateCellIndex === undefined) continue;

      const parsedDate = parseFarsideDate(cells[dateCellIndex] ?? "");
      if (!parsedDate) continue;

      const values = Object.fromEntries(
        BTC_ETF_FLOW_COLUMNS.map((column) => {
          const cellIndex = headerIndexByName.get(normalizeHeader(column));
          return [column, cellIndex === undefined ? null : parseFarsideValue(cells[cellIndex] ?? "")];
        }),
      ) as Record<BtcEtfFlowColumn, number | null>;

      parsedRows.push({
        date: parsedDate.iso,
        dateLabel: parsedDate.label,
        values,
      });
    }

    const latestRows = parsedRows
      .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
      .slice(0, 10);

    return {
      rows: latestRows,
      tableCount: tables.length,
      chosenHeaders: headerRow.headers,
      parsedRowsBeforeFiltering: parsedRows.length,
      parsedRowsAfterFiltering: latestRows.length,
    };
  }

  throw new Error(`No Farside table had all required headers: ${REQUIRED_HEADERS.join(", ")}.`);
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent":
          "MorningStockDashboard/1.0 (+https://railway.app; contact: personal-watchlist)",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFarsideHtml() {
  const retries = 2;
  const timeoutMs = 8000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const response = await fetchWithTimeout(FARSIDE_BTC_ETF_SOURCE_URL, timeoutMs);
      logInfo("fetch completed", { attempt, status: response.status });

      if (!response.ok) {
        throw new Error(`Farside responded with HTTP ${response.status}.`);
      }

      const html = await response.text();
      logInfo("html received", { htmlSize: html.length });
      if (!html.trim()) {
        throw new Error("Farside response body was empty.");
      }
      return html;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logWarn("fetch attempt failed", { attempt, reason: lastError.message });
      if (attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }

  throw lastError ?? new Error("Farside fetch failed.");
}

async function readSnapshotCache(): Promise<FarsideCache | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as FarsideCache;
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readBundledSnapshot(): FarsideCache | null {
  try {
    const parsed = parseFarsideBtcEtfFlows(farsideHtml);
    if (parsed.rows.length === 0) return null;

    logInfo("using bundled Farside snapshot", {
      parsedRowsAfterFiltering: parsed.parsedRowsAfterFiltering,
    });

    return {
      fetchedAt: BUNDLED_SNAPSHOT_FETCHED_AT,
      rows: parsed.rows,
      sourceUrl: FARSIDE_BTC_ETF_SOURCE_URL,
    };
  } catch (error) {
    logWarn("bundled snapshot parse failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function writeSnapshotCache(snapshot: FarsideCache) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function refreshFarsideBtcFlows(): Promise<BtcEtfFlowsSnapshot> {
  try {
    const html = await fetchFarsideHtml();
    const parsed = parseFarsideBtcEtfFlows(html);

    logInfo("parse completed", {
      tableCount: parsed.tableCount,
      chosenHeaders: parsed.chosenHeaders,
      parsedRowsBeforeFiltering: parsed.parsedRowsBeforeFiltering,
      parsedRowsAfterFiltering: parsed.parsedRowsAfterFiltering,
    });

    if (parsed.rows.length === 0) {
      throw new Error("Farside table parsed successfully but produced zero trading rows.");
    }

    const fetchedAt = new Date().toISOString();
    await writeSnapshotCache({
      fetchedAt,
      rows: parsed.rows,
      sourceUrl: FARSIDE_BTC_ETF_SOURCE_URL,
    });

    return {
      rows: parsed.rows,
      sourceUrl: FARSIDE_BTC_ETF_SOURCE_URL,
      status: {
        provider: "farside",
        status: "ok",
        message: `Loaded ${parsed.rows.length} Farside rows.`,
        updatedAt: fetchedAt,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("refresh failed", { reason: message });

    const cached = (await readSnapshotCache()) ?? readBundledSnapshot();
    if (cached) {
      return {
        rows: cached.rows,
        sourceUrl: cached.sourceUrl,
        status: {
          provider: "farside",
          status: "stale",
          message: "Using cached Farside data; latest fetch failed.",
          updatedAt: cached.fetchedAt,
          error: message,
        },
      };
    }

    return {
      rows: [],
      sourceUrl: FARSIDE_BTC_ETF_SOURCE_URL,
      status: {
        provider: "farside",
        status: "failed",
        message: "Farside data is unavailable.",
        updatedAt: null,
        error: message,
      },
    };
  }
}

export async function getFarsideBtcFlows() {
  return refreshFarsideBtcFlows();
}
