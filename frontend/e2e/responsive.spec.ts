import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  assertNoHorizontalOverflow,
  expectAppShell,
  openAppRoute,
  register,
  viewports,
} from "./helpers";

const screenshotDir = path.join("e2e", "screenshots");
const appPages = [
  "/dashboard",
  "/transactions",
  "/budgets",
  "/reports",
  "/goals",
  "/premium",
  "/settings",
] as const;

test.describe("responsive production shell", () => {
  test.describe.configure({ retries: 0 });
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "mobile") test.skip();
  });

  test("authenticated pages stay usable across breakpoints", async ({ page }) => {
    test.setTimeout(180_000);
    await mkdir(screenshotDir, { recursive: true });
    await register(page, "responsive");
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Asha/ })).toBeVisible({
      timeout: 15_000,
    });

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const isMobile = viewport.width < 1024;
      await expectAppShell(page);
      if (isMobile) {
        await expect(page.locator("[data-mobile-nav]")).toBeVisible();
        await expect(page.getByRole("link", { name: "Add Transaction" })).toBeVisible();
        await expect(page.locator("[data-mobile-nav]").getByRole("button", { name: "More" })).toBeVisible();
      } else {
        await expect(page.getByRole("complementary", { name: "Desktop" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Main" }).getByText("Spending Limits")).toBeVisible();
      }
      await expect(
        page.getByRole("complementary", { name: "Desktop" }).getByRole("button", { name: "Log out" }),
      ).toHaveCount(0);

      for (const route of appPages) {
        await openAppRoute(page, route, isMobile);
        await expect(page.locator("main .skeleton")).toHaveCount(0, { timeout: 15_000 });
        await expect(page.locator("main").getByRole("heading").first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator("main")).toBeVisible();
        await assertNoHorizontalOverflow(page);
        const mainPadding = await page.locator("main").evaluate((node) => getComputedStyle(node).paddingBottom);
        if (isMobile) {
          expect(parseFloat(mainPadding)).toBeGreaterThanOrEqual(76);
        }
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [route, name] of [
      ["/dashboard", "dashboard"],
      ["/transactions", "transactions"],
      ["/budgets", "spending-limits"],
      ["/reports", "analytics"],
      ["/goals", "goals"],
      ["/premium", "premium"],
      ["/settings", "settings"],
    ] as const) {
      await openAppRoute(page, route, false);
      await page.screenshot({ path: path.join(screenshotDir, `${name}-desktop.png`), fullPage: true });
    }
    await page.goto("/transactions?action=add");
    await expectAppShell(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDir, "add-transaction-desktop.png"),
    });
    await page.keyboard.press("Escape");
    await openAppRoute(page, "/settings", false);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "logout-confirmation-desktop.png") });
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-mobile-nav]")).toBeVisible();
    for (const [route, name] of [
      ["/dashboard", "dashboard"],
      ["/transactions", "transactions"],
      ["/budgets", "spending-limits"],
      ["/reports", "analytics"],
      ["/goals", "goals"],
      ["/premium", "premium"],
      ["/settings", "settings"],
    ] as const) {
      await openAppRoute(page, route, true);
      await page.screenshot({ path: path.join(screenshotDir, `${name}-mobile.png`), fullPage: true });
    }
    await page.goto("/transactions?action=add");
    await expectAppShell(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    const dialogBox = await page.getByRole("dialog").locator(".responsive-dialog").boundingBox();
    expect(dialogBox).toBeTruthy();
    expect(dialogBox!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: path.join(screenshotDir, "add-transaction-mobile.png") });
    await page.keyboard.press("Escape");
    await openAppRoute(page, "/settings", true);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Log out of Hisaab?" })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, "logout-confirmation-mobile.png") });
    await page.getByRole("button", { name: "Cancel" }).click();

    await openAppRoute(page, "/dashboard", true);
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(screenshotDir, "dashboard-dark-mobile.png"), fullPage: true });
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.dir = "rtl";
      document.documentElement.lang = "ur";
    });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(screenshotDir, "dashboard-rtl-mobile.png"), fullPage: true });
  });

  test("auth screens fit every required viewport", async ({ page }) => {
    test.setTimeout(120_000);
    await mkdir(screenshotDir, { recursive: true });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      if (viewport.name === "iphone" || viewport.name === "desktop") {
        await page.screenshot({
          path: path.join(screenshotDir, `login-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }
    await page.goto("/register");
    await expect(page.getByLabel("Full name")).toBeVisible();
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(page.getByLabel("Full name")).toBeVisible();
      await expect(page.getByLabel("Confirm password")).toBeVisible();
      await assertNoHorizontalOverflow(page);
      if (viewport.name === "iphone" || viewport.name === "desktop") {
        await page.screenshot({
          path: path.join(screenshotDir, `registration-${viewport.name}.png`),
          fullPage: true,
        });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.screenshot({ path: path.join(screenshotDir, "login-mobile.png"), fullPage: true });
    await page.goto("/register");
    await page.screenshot({
      path: path.join(screenshotDir, "registration-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await page.screenshot({ path: path.join(screenshotDir, "login-desktop.png"), fullPage: true });
    await page.goto("/register");
    await page.screenshot({
      path: path.join(screenshotDir, "registration-desktop.png"),
      fullPage: true,
    });
  });
});
