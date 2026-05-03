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
});
