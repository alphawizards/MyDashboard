import { describe, expect, it } from "vitest";
import { parseFarsideBtcEtfFlows, parseFarsideDate, parseFarsideValue } from "../../app/lib/watchlist/farside";

describe("Farside BTC ETF parser", () => {
  it("normalizes Farside numeric values", () => {
    expect(parseFarsideValue("-")).toBeNull();
    expect(parseFarsideValue("(95.1)")).toBe(-95.1);
    expect(parseFarsideValue("1,234.5")).toBe(1234.5);
    expect(parseFarsideValue("\u00a0 0.0 \u00a0")).toBe(0);
  });

  it("parses Farside date strings safely", () => {
    expect(parseFarsideDate("05 May 2026")).toMatchObject({
      iso: "2026-05-05",
      label: "05 May 2026",
    });
    expect(parseFarsideDate("Cumulative")).toBeNull();
  });

  it("chooses the table by headers and returns the latest 10 trading rows descending", () => {
    const rows = Array.from({ length: 11 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return `
        <tr>
          <td>${day} May 2026</td>
          <td>${index}</td>
          <td>-</td>
          <td>(95.1)</td>
          <td>1,234.5</td>
          <td>0.0</td>
          <td>0.0</td>
          <td>0.0</td>
          <td>0.0</td>
          <td>0.0</td>
          <td>-</td>
          <td>(1.5)</td>
          <td>-</td>
          <td>${index + 100}</td>
        </tr>`;
    }).join("");

    const html = `
      <table><tr><th>Other</th></tr><tr><td>ignore me</td></tr></table>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>IBIT</th><th>FBTC</th><th>BITB</th><th>ARKB</th>
            <th>BTCO</th><th>EZBC</th><th>BRRR</th><th>HODL</th><th>BTCW</th>
            <th>MSBT</th><th>GBTC</th><th>BTC</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr><td>Cumulative</td><td>1,000</td></tr>
        </tbody>
      </table>`;

    const parsed = parseFarsideBtcEtfFlows(html);

    expect(parsed.tableCount).toBe(2);
    expect(parsed.parsedRowsBeforeFiltering).toBe(11);
    expect(parsed.parsedRowsAfterFiltering).toBe(10);
    expect(parsed.rows[0]).toMatchObject({
      date: "2026-05-11",
      values: {
        IBIT: 10,
        FBTC: null,
        BITB: -95.1,
        ARKB: 1234.5,
        GBTC: -1.5,
        BTC: null,
        Total: 110,
      },
    });
    expect(parsed.rows.at(-1)?.date).toBe("2026-05-02");
  });
});
