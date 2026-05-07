import { expect, test } from "@playwright/test";

test("ranked analysts link to individual account pages", async ({ page }) => {
  await page.goto("/feed");

  const analystPanel = page.getByLabel("Ranked X analysts");
  await expect(analystPanel.getByRole("link", { name: /FransBakker9812/i })).toBeVisible();
  await analystPanel.getByRole("link", { name: /FransBakker9812/i }).click();

  await expect(page).toHaveURL(/\/feed\/accounts\/fransbakker9812$/);
  await expect(page.getByRole("heading", { name: "FransBakker9812" }).first()).toBeVisible();
  await expect(page.getByText("@FransBakker9812").first()).toBeVisible();
  await expect(page.getByText("No tweets captured for this account yet.")).toBeVisible();
});

test("Serenity account page shows the stock pick tracker table", async ({ page }) => {
  await page.goto("/feed/accounts/serenity");

  const tracker = page.getByLabel("Serenity stock pick tracker");
  await expect(tracker.getByRole("heading", { name: "Stock Pick Tracker" })).toBeVisible();
  await expect(tracker.getByText("Ticker", { exact: true })).toBeVisible();
  await expect(tracker.getByText("Company", { exact: true })).toBeVisible();
  await expect(tracker.getByText("Theme", { exact: true })).toBeVisible();
  await expect(tracker.getByText("1M %", { exact: true })).toBeVisible();
  await expect(tracker.getByText("12M %", { exact: true })).toBeVisible();
  await expect(tracker.getByText("Mentions", { exact: true })).toBeVisible();
  await expect(tracker.getByText("AAOI", { exact: true }).first()).toBeVisible();
});
