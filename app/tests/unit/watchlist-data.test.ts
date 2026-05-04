import { describe, expect, it } from "vitest";
import { parseFarsideFlows } from "../../app/lib/farside";

describe("parseFarsideFlows", () => {
  it("normalizes Farside table rows into the dashboard table shape", () => {
    const rows = parseFarsideFlows(`
      <table>
        <tr><th>Date</th><th>IBIT</th><th>FBTC</th><th>Total</th></tr>
        <tr><td>01 May 2026</td><td>12.3</td><td>(4.5)</td><td>7.8</td></tr>
        <tr><td>04 May 2026</td><td>-</td><td>0.0</td><td>0.0</td></tr>
        <tr><td>Cumulative</td><td>100</td><td>50</td><td>150</td></tr>
      </table>
    `);

    expect(rows).toEqual([
      expect.objectContaining({
        date: "04 May 2026",
        values: expect.objectContaining({ IBIT: "-", FBTC: "0.0", Total: "0.0" }),
      }),
      expect.objectContaining({
        date: "01 May 2026",
        values: expect.objectContaining({ IBIT: "12.3", FBTC: "(4.5)", Total: "7.8" }),
      }),
    ]);
  });

  it("normalizes readable markdown fallback rows", () => {
    const rows = parseFarsideFlows(`
      Date | IBIT | FBTC | Total |
      | --- | --- | --- | --- |
      | 01 May 2026 | 12.3 | (4.5) | 7.8 |
      | 04 May 2026 | - | 0.0 | 0.0 |
    `);

    expect(rows[0]).toEqual(expect.objectContaining({
      date: "04 May 2026",
      values: expect.objectContaining({ IBIT: "-", FBTC: "0.0", Total: "0.0" }),
    }));
  });
});
