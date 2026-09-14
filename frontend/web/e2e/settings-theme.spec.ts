import { expect, test } from "@playwright/test";
import { register } from "./helpers";

test.use({
  channel: "chrome",
  viewport: { width: 1440, height: 900 },
});

test.describe("settings theme", () => {
  test.describe.configure({ retries: 0 });
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "mobile") test.skip();
  });

  test("keeps the header theme when opening Settings", async ({ page }) => {
    test.setTimeout(90_000);
    await register(page, "theme-settings");
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect.poll(() => page.locator("html").getAttribute("class")).toMatch(/\bdark\b/);
    await page.getByRole("navigation", { name: "Settings" }).getByRole("link", { name: /Settings/ }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect.poll(() => page.locator("html").getAttribute("class")).toMatch(/\bdark\b/);
    await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("dark");
  });
});
