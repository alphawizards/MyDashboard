import { describe, expect, it } from "vitest";
import { buildAccountCompleteTweetMap, normalizeXHandle } from "../../app/lib/accounts";
import { authors } from "../../app/lib/static-data";

describe("account helpers", () => {
  it("normalizes the seeded analyst handles", () => {
    const handles = [
      "@FransBakker9812",
      "KawzInvests",
      "https://x.com/stocktalkweekly",
      "@TheShortBear",
      "@JasonLCapital",
      "@Sandeman52",
      "@aleabitoreddit",
      "@StonkChris",
      "@ShortSeller",
      "@futuristlens",
      "@cyberprincerwo",
    ];

    expect(handles.map((handle) => normalizeXHandle(handle))).toEqual([
      "FransBakker9812",
      "KawzInvests",
      "stocktalkweekly",
      "TheShortBear",
      "JasonLCapital",
      "Sandeman52",
      "aleabitoreddit",
      "StonkChris",
      "ShortSeller",
      "futuristlens",
      "cyberprincerwo",
    ]);
  });

  it("seeds the screenshot accounts without duplicating aleabitoreddit", () => {
    const handles = authors.map((author) => author.handle.toLowerCase());

    expect(handles).toContain("fransbakker9812");
    expect(handles).toContain("kawzinvests");
    expect(handles).toContain("cyberprincerwo");
    expect(handles.filter((handle) => handle === "aleabitoreddit")).toHaveLength(1);
    expect(authors.find((author) => author.handle.toLowerCase() === "aleabitoreddit")).toMatchObject({
      winRate: 82,
      shadowScore: 66,
    });
  });

  it("creates empty tweet arrays for accounts with no tweets", () => {
    const complete = buildAccountCompleteTweetMap(authors, {});

    expect(complete.fransbakker9812).toEqual([]);
    expect(complete.cyberprincerwo).toEqual([]);
  });
});
