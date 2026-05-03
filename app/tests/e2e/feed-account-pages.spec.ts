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
