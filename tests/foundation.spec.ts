import { expect, test } from "@playwright/test";

test("boots into the placeholder stage shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("board-host")).toBeVisible();
  await expect(page.getByText("US-001 foundation")).toBeVisible();
  await expect(page.getByTestId("phase-readout")).toHaveText("Boot");
  await expect(page.getByText("CODEXQIX")).toBeVisible();
  await expect(page.getByText("Placeholder Stage")).toBeVisible({ timeout: 4000 });
  await expect(page.getByTestId("phase-readout")).toHaveText("Stage");
});
