import { expect, test } from "@playwright/test";
import { register } from "./helpers";

test.describe("finance modules", () => {
  test.describe.configure({ retries: 0 });
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "mobile") test.skip();
  });

  test("investments save to the API and appear on Overview", async ({ page }) => {
    test.setTimeout(120_000);
    await register(page, "finance-api");
    await page.goto("/investments");
    await expect(page.getByRole("heading", { name: "Investments", level: 1 })).toBeVisible();
    await expect(page.getByText("No investments yet")).toBeVisible();
    await page.getByRole("button", { name: "Add Investment" }).first().click();
    await page.getByLabel("Name").fill("Nifty 50 Index");
    await page.getByLabel("Invested").fill("10000");
    await page.getByLabel("Current value").fill("11000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Nifty 50 Index")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.locator(".oc-feature").filter({ hasText: "Investments" })).toContainText(
      "Nifty 50 Index",
    );
  });
});
