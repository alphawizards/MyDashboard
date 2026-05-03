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
