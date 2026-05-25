import { expect, test } from "@playwright/test";

test("portfolio tabs show Sikand holdings and Wolff placeholder", async ({ page }) => {
  await page.goto("/portfolios");

  await expect(page.getByRole("heading", { name: "Portfolio Tracker" })).toBeVisible();
  await expect(page.getByText("Asymmetric Bets").first()).toBeVisible();
  await expect(page.getByText("VIAV").first()).toBeVisible();
  await expect(page.getByText("54.2%").first()).toBeVisible();

  await page.getByRole("button", { name: /Peter Wolff/ }).click();
  await expect(page.locator(".tab-btn.active")).toContainText("Peter Wolff");
  await expect(page.getByText("Waiting for Wolff portfolio")).toBeVisible();

  await page.getByRole("button", { name: /mon@moninvestor/ }).click();
  await expect(page.locator(".tab-btn.active")).toContainText("mon@moninvestor");
  await expect(page.getByRole("heading", { name: "Short-Term Portfolio" }).first()).toBeVisible();
  await expect(page.getByText("Return not captured")).toBeVisible();
  await expect(page.getByText("PENG").first()).toBeVisible();
  await expect(page.getByText("29.9%").first()).toBeVisible();
  await expect(page.getByText("Initial buy 2026-05-06 at $40.93; added 2026-05-12 at $43.53")).toBeVisible();
});
