import { expect, test } from "@playwright/test";

test("feed tabs switch visible content", async ({ page }) => {
  await page.goto("/feed");

  const tabChecks = [
    { name: "Sikand", text: "Michael Sikand" },
    { name: "Wolff", text: "Peter Wolff" },
    { name: "Serenity", text: "aleabitoreddit" },
    { name: "BryzonX", text: "PENG" },
    { name: "Overlap", text: "Ticker Mention Map" },
  ];

  for (const check of tabChecks) {
    await page.getByRole("button", { name: new RegExp(`^${check.name}\\b`) }).click();
    await expect(page.locator(".tab-btn.active")).toContainText(check.name);
    await expect(page.getByText(check.text).first()).toBeVisible();
  }
});

test("overlap bubble chart packs sorted bubbles into responsive rows", async ({ page }) => {
  await page.goto("/feed");
  await page.getByRole("button", { name: /^Overlap\b/ }).click();

  const chart = page.locator(".bubble-svg");
  await expect(chart).toBeVisible();
  await expect(page.getByText("Sorted by total mentions")).toBeVisible();

  const desktop = await chart.evaluate((element) => {
    const svg = element as SVGSVGElement;
    const groups = [...svg.querySelectorAll<SVGGElement>("g.bubble-node")];
    const viewBoxHeight = svg.viewBox.baseVal.height;
    const nodes = groups.map((group) => {
      const circle = group.querySelector("circle");
      const bbox = group.getBBox();
      const [, x = "0", y = "0"] = group.getAttribute("transform")?.match(/translate\(([^,]+),([^)]+)\)/) ?? [];

      return {
        label: group.querySelector("title")?.textContent ?? "",
        radius: Number(circle?.getAttribute("r")),
        x: Number(x),
        y: Number(y),
        bboxBottom: bbox.y + bbox.height,
        bboxTop: bbox.y,
      };
    });

    return {
      height: Number(svg.getAttribute("height")),
      viewBoxHeight,
      nodes,
      rows: new Set(nodes.map((node) => node.y)).size,
      visibleHeight: svg.getBoundingClientRect().height,
    };
  });

  expect(desktop.height).toBe(desktop.viewBoxHeight);
  expect(desktop.visibleHeight).toBeLessThanOrEqual(desktop.height + 1);
  expect(desktop.nodes.length).toBeGreaterThan(0);
  expect(desktop.nodes.every((node, index) => index === 0 || desktop.nodes[index - 1].radius >= node.radius)).toBe(true);
  expect(desktop.nodes[0].radius).toBeCloseTo(60, 1);
  expect(desktop.nodes.at(-1)?.radius).toBeLessThan(desktop.nodes[0].radius);
  expect(desktop.nodes[0].label).toMatch(/ - .+ \d+x/);

  for (const node of desktop.nodes) {
    expect(node.y + node.bboxTop).toBeGreaterThanOrEqual(0);
    expect(node.y + node.bboxBottom).toBeLessThanOrEqual(desktop.height);
  }

  await page.setViewportSize({ width: 360, height: 900 });
  const mobile = await chart.evaluate((element) => {
    const svg = element as SVGSVGElement;

    return {
      height: Number(svg.getAttribute("height")),
      rows: new Set([...svg.querySelectorAll("g.bubble-node")].map((group) => group.getAttribute("transform")?.match(/,([^)]+)\)/)?.[1])).size,
    };
  });

  expect(mobile.height).toBeGreaterThan(0);
  expect(mobile.rows).toBeGreaterThanOrEqual(desktop.rows);
});

test("feed ticker symbols link to Yahoo Finance", async ({ page }) => {
  await page.goto("/feed");

  const feedTicker = page.locator('.ticker-bar a[href^="https://finance.yahoo.com/quote/"]').first();
  await expect(feedTicker).toHaveAttribute("target", "_blank");
  await expect(feedTicker).toHaveAttribute("rel", /noopener noreferrer/);

  const tweetTicker = page.locator('.tweet-cashtags a[href^="https://finance.yahoo.com/quote/"]').first();
  await expect(tweetTicker).toBeVisible();
  await expect(tweetTicker).toHaveAttribute("target", "_blank");

  await page.getByRole("button", { name: /^Overlap\b/ }).click();
  const uniqueTicker = page.locator('.overlap-table a[href^="https://finance.yahoo.com/quote/"]').first();
  await expect(uniqueTicker).toBeVisible();
  await expect(uniqueTicker).toHaveAttribute("target", "_blank");

  const bubbleTicker = page.locator('.bubble-svg a[href^="https://finance.yahoo.com/quote/"]').first();
  await expect(bubbleTicker).toHaveAttribute("target", "_blank");
  await expect(bubbleTicker).toHaveAttribute("aria-label", /Open .+ on Yahoo Finance/);
});

test("feed tweet cards can switch between newest-first and oldest-first date order", async ({ page }) => {
  await page.goto("/feed");

  const firstTweetTime = page.locator(".tweet-card .tweet-time").first();
  const newestFirst = await firstTweetTime.textContent();

  const newestFirstButton = page.getByRole("button", { name: "Newest First", exact: true });
  await expect(newestFirstButton).toHaveAttribute("aria-pressed", "true");

  await newestFirstButton.click();
  const oldestFirstButton = page.getByRole("button", { name: "Oldest First", exact: true });
  await expect(oldestFirstButton).toHaveAttribute("aria-pressed", "false");

  const oldestFirst = await firstTweetTime.textContent();
  expect(oldestFirst).not.toBe(newestFirst);

  await oldestFirstButton.click();
  await expect(newestFirstButton).toHaveAttribute("aria-pressed", "true");
  await expect(firstTweetTime).toHaveText(newestFirst ?? "");
});
