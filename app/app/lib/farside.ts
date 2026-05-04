import type { FarsideFlowRow } from "./types";

export const FARSIDE_FLOW_COLUMNS = ["IBIT", "FBTC", "BITB", "ARKB", "BTCO", "EZBC", "BRRR", "HODL", "BTCW", "MSBT", "GBTC", "BTC", "Total"];

export function parseFarsideFlows(html: string): FarsideFlowRow[] {
  if (!html.includes("<table")) {
    return parseFarsideMarkdown(html);
  }

  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  const tableHtml = tableMatch?.[0] ?? html;
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const headers = extractCells(rowMatches[0] ?? "").slice(1);

  return rowMatches
    .map((rowHtml) => {
      const cells = extractCells(rowHtml);

      if (!cells.length || cells[0].toLowerCase() === "date") {
        return null;
      }

      const [date, ...values] = cells;

      if (!isFlowDate(date)) {
        return null;
      }

      return {
        date,
        values: Object.fromEntries(
          FARSIDE_FLOW_COLUMNS.map((column, index) => {
            const sourceIndex = headers.length ? headers.indexOf(column) : index;
            return [column, sourceIndex >= 0 ? values[sourceIndex] ?? "-" : "-"];
          }),
        ),
      };
    })
    .filter((row): row is FarsideFlowRow => row !== null)
    .slice(-10)
    .reverse();
}

function parseFarsideMarkdown(markdown: string): FarsideFlowRow[] {
  const lines = markdown.split(/\r?\n/);
  const tableLines = lines
    .filter((line) => line.includes("|"))
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("---"));
  const headerLine = tableLines.find((line) => line.includes("Date") && line.includes("IBIT"));
  const headers = splitMarkdownRow(headerLine ?? "").slice(1);

  return tableLines
    .map((line) => splitMarkdownRow(line))
    .filter((cells) => cells.length > 1 && cells[0] !== "Date" && isFlowDate(cells[0]))
    .map(([date, ...values]) => ({
      date,
      values: Object.fromEntries(
        FARSIDE_FLOW_COLUMNS.map((column, index) => {
          const sourceIndex = headers.length ? headers.indexOf(column) : index;
          return [column, sourceIndex >= 0 ? values[sourceIndex] ?? "-" : "-"];
        }),
      ),
    }))
    .slice(-10)
    .reverse();
}

function isFlowDate(value: string) {
  return /^\d{2} [A-Z][a-z]{2} \d{4}$/.test(value);
}

function splitMarkdownRow(line: string) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function extractCells(rowHtml: string) {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((match) => decodeHtml(stripTags(match[1])).trim())
    .filter(Boolean);
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&#8211;/g, "-")
    .replace(/\s+/g, " ");
}
