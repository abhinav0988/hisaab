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
    await expect(page.getByRole("button", { name: /Nifty 50 Index/ }).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.goto("/dashboard");
    const investments = page.locator(".pd-module").filter({ hasText: "Investments" });
    await expect(investments).toBeVisible();
    await expect(investments).toContainText(/11,?000/);
  });

  test("loans save from the add screen and appear on Overview", async ({ page }) => {
    test.setTimeout(120_000);
    await register(page, "loan-api");
    await page.goto("/loans");
    await expect(page.getByRole("heading", { name: "EMI & Loans", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Add Loan" }).first().click();
    await expect(page.getByRole("heading", { name: "Add Loan / EMI", level: 1 })).toBeVisible();
    await page.getByRole("radio", { name: "Home Loan" }).click();
    await page.getByLabel("Lender / Bank").fill("HDFC Bank");
    await page.getByLabel("Total Loan Amount (₹)").fill("1000000");
    await page.getByLabel("Total EMIs").fill("60");
    await page.getByLabel("Remaining EMIs").fill("41");
    await page.getByLabel("Monthly EMI (₹)").fill("18500");
    await page.getByLabel("EMI Date (Monthly)").fill("2026-09-10");
    await expect(page.getByText("Paid EMIs")).toBeVisible();
    await expect(page.getByText("19 / 60")).toBeVisible();
    await page.getByRole("button", { name: "Save Loan" }).click();
    await expect(page.getByText("HDFC Bank").first()).toBeVisible();
    await page.goto("/dashboard");
    const loans = page.locator(".pd-module").filter({ hasText: "EMI & Loans" });
    await expect(loans).toBeVisible();
    await expect(loans).toContainText("Home Loan");
  });

  test("credit cards save from the add dialog and appear on the dashboard", async ({ page }) => {
    test.setTimeout(120_000);
    await register(page, "card-api");
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Credit Cards", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Add Card" }).first().click();
    await expect(page.getByRole("heading", { name: "Add Credit Card" })).toBeVisible();
    await page.getByLabel("Card name").fill("HDFC Regalia");
    await page.getByLabel("Last 4 digits").fill("1234");
    await page.getByLabel("Total spend limit (₹)").fill("150000");
    await page.getByLabel("Used amount (₹)").fill("45000");
    await page.getByLabel("Credit hold amount (₹)").fill("2500");
    await page.getByLabel("Overdue amount (₹)").fill("0");
    await page.getByLabel("Current cycle spend (₹)").fill("8500");
    await page.getByLabel("Minimum due (₹)").fill("3000");
    await page.getByRole("button", { name: "Save Card" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("HDFC Regalia").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Upcoming payments" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rewards & Benefits" })).toBeVisible();
  });
});
