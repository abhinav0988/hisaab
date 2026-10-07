import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = process.env.AUDIT_OUT || "/home/abhinav/Videos/MyProjects/Hisaab/docs/audit-evidence/mobile-all-features";
const viewports = [
  { name: "320", width: 320, height: 720 },
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
];
const routes = [
  "/dashboard",
  "/transactions",
  "/bank",
  "/budgets",
  "/goals",
  "/accounts",
  "/investments",
  "/ipo",
  "/loans",
  "/cards",
  "/upi-credit",
  "/recurring",
  "/lend",
  "/settings",
  "/reports",
  "/coach",
  "/premium",
  "/categories",
  "/profile",
  "/schedules",
  "/split-money",
  "/split-money/create",
  "/split-money/history",
  "/split-money/groups",
  "/split-money/people",
  "/split-money/import-receipt",
];

async function register(page) {
  const email = `qa-mobi-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Full name").fill("Mobile QA");
  await page.getByLabel("Email address").fill(email);
  const sent = page.waitForResponse(
    (r) => r.url().includes("/api/auth/send-verification-code") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /Send code/ }).click();
  const response = await sent;
  const payload = await response.json();
  const otp = String(payload?.data?.otp ?? payload?.otp ?? "").trim();
  if (!/^\d{6}$/.test(otp)) throw new Error(`OTP missing: ${JSON.stringify(payload).slice(0,200)}`);
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(otp);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await page.getByText("Email verified", { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByLabel("Create password", { exact: true }).fill("Secure!12345");
  await page.getByLabel("Confirm password").fill("Secure!12345");
  await page.getByRole("button", { name: /Create my secure account/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 40_000 });
  return email;
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const offenders = [];
    const vw = doc.clientWidth;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > vw + 1.5 || r.left < -1.5) {
        const style = getComputedStyle(el);
        if (style.position === "fixed" || style.position === "sticky") {
          // still count if it overflows horizontally beyond viewport
          if (r.right <= vw + 1.5 && r.left >= -1.5) continue;
        }
        const cls = (el.className && String(el.className).slice(0, 80)) || "";
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls,
          left: Math.round(r.left),
          right: Math.round(r.right),
          w: Math.round(r.width),
        });
        if (offenders.length >= 8) break;
      }
    }
    return {
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      bodyW: body.scrollWidth,
      overflowPx: Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth,
      overflow: Math.max(doc.scrollWidth, body.scrollWidth) > doc.clientWidth + 1,
      offenders,
    };
  });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(45_000);
await page.setViewportSize({ width: 390, height: 844 });
const email = await register(page);
console.log("registered", email);

const results = [];
for (const route of routes) {
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.classList.add("dark");
      try { localStorage.setItem("theme", "dark"); } catch {}
    });
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(700);
    const m = await measure(page);
    const slug = route.replace(/^\//, "").replace(/\//g, "_") || "home";
    const file = `${slug}-${vp.name}.png`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: false });
    const row = { route, viewport: vp.name, ...m, file };
    results.push(row);
    const mark = m.overflow || m.offenders.length ? "FAIL" : "ok";
    console.log(`${mark} ${route} @${vp.name} overflow=${m.overflowPx} offenders=${m.offenders.length}`);
    if (m.offenders[0]) console.log("  ", JSON.stringify(m.offenders[0]));
  }
}

const fails = results.filter((r) => r.overflow || r.offenders.length);
await writeFile(path.join(OUT, "report.json"), JSON.stringify({ fails, results }, null, 2));
console.log(`\nDone. ${fails.length}/${results.length} failing checks. OUT=${OUT}`);
await browser.close();
