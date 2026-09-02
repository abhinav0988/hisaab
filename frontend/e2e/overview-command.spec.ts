import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  expectAppShell,
  register,
} from "./helpers";

const widths = [1600, 1440, 1280, 1024, 768, 390] as const;

async function cardsOverlap(page: import("@playwright/test").Page, selector: string) {
  return page.evaluate((sel) => {
    const nodes = [...document.querySelectorAll(sel)] as HTMLElement[];
    const boxes = nodes
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right, width: rect.width, height: rect.height };
      })
      .filter((box) => box.width > 2 && box.height > 2);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap =
          a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
        if (overlap) return true;
      }
    }
    return false;
  }, selector);
}

test.describe("overview command center", () => {
  test.describe.configure({ retries: 0 });
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "mobile") test.skip();
  });

  test("dashboard command center holds at listed widths and keeps existing clicks", async ({ page }) => {
    test.setTimeout(120_000);
    await register(page, "overview-cc");
    await expect(page.getByRole("heading", { name: "Financial Health Score" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Spending Breakdown" })).toBeVisible();

    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
      await expectAppShell(page);
      await expect(page.getByRole("heading", { name: "Financial Health Score" })).toHaveCount(1);
      await assertNoHorizontalOverflow(page);
      expect(await cardsOverlap(page, ".overview-command .oc-card, .oc-kpis > *")).toBe(false);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(".oc-feature").filter({ hasText: "Accounts Overview" }).getByRole("link", { name: /View all/ }).click();
    await expect(page).toHaveURL(/\/accounts$/);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.locator(".oc-feature").filter({ hasText: "Investments" }).getByRole("link", { name: /View all/ }).click();
    await expect(page).toHaveURL(/\/investments$/);
    await page.getByRole("navigation", { name: "More finance tools" }).getByRole("link", { name: "IPO Tracker" }).click();
    await expect(page).toHaveURL(/\/ipo$/);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Overview" }).click();

    await page.getByRole("link", { name: "Add Transaction" }).first().click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await page.getByRole("navigation", { name: "Settings" }).getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Desktop" }).getByRole("button", { name: "Log out" }),
    ).toHaveCount(0);
  });
});
