import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { register } from "./helpers";

test.use({
  channel: "chrome",
  viewport: { width: 1440, height: 900 },
});

test.describe("notification panel placement", () => {
  test.describe.configure({ retries: 0 });
  test.beforeEach(({}, testInfo) => {
    if (testInfo.project.name === "mobile") test.skip();
  });

  test("sits under the bell, not over the sidebar", async ({ page }) => {
    test.setTimeout(90_000);
    await mkdir(path.join("e2e", "screenshots"), { recursive: true });
    await register(page, "notify-pos");

    const sizes = [
      { width: 1440, height: 900, name: "desktop" },
      { width: 1280, height: 800, name: "laptop" },
    ] as const;

    for (const size of sizes) {
      await page.setViewportSize(size);
      const notifyButton = page.getByRole("button", { name: "Notifications" });
      const panel = page.locator("[data-notification-panel]");
      if (await panel.evaluate((node) => node.matches(":popover-open")).catch(() => false)) {
        await notifyButton.click();
      }
      await notifyButton.click();
      await expect(panel).toBeVisible({ timeout: 10_000 });
      await expect.poll(async () => panel.getAttribute("data-placed")).toBe("true");

      const [panelBox, bellBox, sidebarBox] = await Promise.all([
        panel.boundingBox(),
        notifyButton.boundingBox(),
        page.getByRole("complementary", { name: "Desktop" }).boundingBox(),
      ]);
      expect(panelBox, `${size.name}: panel box`).toBeTruthy();
      expect(bellBox, `${size.name}: bell box`).toBeTruthy();
      expect(sidebarBox, `${size.name}: sidebar box`).toBeTruthy();

      const panelRight = panelBox!.x + panelBox!.width;
      const bellRight = bellBox!.x + bellBox!.width;
      const sidebarRight = sidebarBox!.x + sidebarBox!.width;

      expect(panelBox!.x, `${size.name}: not over sidebar`).toBeGreaterThan(sidebarRight - 8);
      expect(Math.abs(panelRight - bellRight), `${size.name}: right-aligned to bell`).toBeLessThan(24);
      expect(panelBox!.y, `${size.name}: below bell`).toBeGreaterThan(bellBox!.y + bellBox!.height - 4);

      await page.screenshot({
        path: path.join("e2e", "screenshots", `notify-position-${size.name}.png`),
        fullPage: false,
      });
      await notifyButton.click();
    }
  });
});
