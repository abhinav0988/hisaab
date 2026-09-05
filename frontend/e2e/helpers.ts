import { expect, type Page } from "@playwright/test";

export const viewports = [
  { name: "small-mobile", width: 320, height: 700 },
  { name: "android", width: 360, height: 800 },
  { name: "iphone", width: 390, height: 844 },
  { name: "large-mobile", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const appRoutes = {
  "/dashboard": { desktop: /Overview/, mobile: /Overview|Home/, more: false },
  "/transactions": { desktop: /Transactions/, mobile: /Transactions|Txns/, more: false },
  "/budgets": { desktop: /Spending Limits/, mobile: "Limits", more: false },
  "/reports": { desktop: /Analytics/, mobile: /Analytics/, more: true },
  "/goals": { desktop: /Savings Goals/, mobile: /Savings Goals/, more: true },
  "/premium": { desktop: /^Premium/, mobile: /Premium/, more: true },
  "/bank": { desktop: /Bank/, mobile: /Bank/, more: true },
  "/settings": { desktop: /Settings/, mobile: /Settings/, more: true },
} as const;

export async function assertNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);
}

export async function hideDevOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => {
      const el = node as HTMLElement;
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("pointer-events", "none", "important");
    });
  });
}

export async function expectAppShell(page: Page) {
  await hideDevOverlay(page);
  await expect(page.locator("[data-app-shell]")).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/(login|register)(\?|$)/);
}

export async function register(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  await page.goto("/register");
  await expect(page.getByLabel("Full name")).toBeVisible();
  await page.getByLabel("Full name").fill("Asha Sharma");
  await page.getByLabel("Email address").fill(email);
  const sent = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/send-verification-code") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Send code/ }).click();
  const response = await sent;
  expect(response.ok(), `send-verification-code failed: ${response.status()}`).toBe(true);
  const payload = (await response.json()) as {
    data?: { otp?: string; sent?: boolean };
    otp?: string;
  };
  const otp = String(payload.data?.otp ?? payload.otp ?? "").trim();
  expect(otp, `Expected local OTP in response; got ${JSON.stringify(payload)}`).toMatch(/^\d{6}$/);
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(otp);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByText("Email verified", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Create password", { exact: true }).fill("Secure!12345");
  await page.getByLabel("Confirm password").fill("Secure!12345");
  await page.getByRole("button", { name: /Create my secure account/ }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe("/dashboard");
  await expectAppShell(page);
  return { email, password: "Secure!12345" };
}

export async function openAppRoute(
  page: Page,
  route: keyof typeof appRoutes,
  isMobile: boolean,
) {
  const target = appRoutes[route];
  if (new URL(page.url()).pathname === route) {
    await expectAppShell(page);
    return;
  }
  await hideDevOverlay(page);
  if (isMobile) {
    const nav = page.locator("[data-mobile-nav]");
    await expect(nav).toBeVisible();
    if (target.more) {
      await nav.getByRole("button", { name: "More" }).click();
      await page.getByRole("dialog").getByRole("link", { name: target.mobile }).click();
    } else {
      await nav.getByRole("link", { name: target.mobile, exact: true }).click({ timeout: 10_000 });
    }
  } else {
    const navName = route === "/settings" ? "Settings" : "Main";
    await page.getByRole("navigation", { name: navName }).getByRole("link", { name: target.desktop }).click();
  }
  await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}(\\?|$)`));
  await expectAppShell(page);
}

export async function logoutFromSettings(page: Page) {
  await page.goto("/settings");
  await expectAppShell(page);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/login/);
}
