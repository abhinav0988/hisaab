import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Asha Sharma");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Secure!12345");
  await page.getByRole("button", { name: "Create my secure account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  return { email, password: "Secure!12345" };
}
async function createCashAccount(page: Page) {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  await page.getByLabel("Account name").fill("Daily cash");
  await page.getByLabel("Opening balance").fill("1000");
  await page.getByRole("button", { name: "Save account" }).click();
  await expect(page.getByText("Daily cash")).toBeVisible();
}

test("creates an account, logs out, and logs back in", async ({ page }) => {
  const credentials = await register(page, "auth");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email address").fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page).toHaveURL(/dashboard/);
});
test("adds expense and income, filters transactions, and creates a budget", async ({ page }) => {
  await register(page, "finance");
  await createCashAccount(page);
  await page.goto("/transactions?action=expense");
  await page.getByLabel(/Amount/).fill("25.50");
  await page.getByLabel("Merchant").fill("Corner cafe");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText("Corner cafe")).toBeVisible();
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByRole("button", { name: "Income" }).click();
  await page.getByLabel(/Amount/).fill("500");
  await page.getByLabel("Source").fill("Freelance client");
  await page.getByRole("button", { name: "Add income" }).click();
  await page.getByPlaceholder("Search merchant, category, account...").fill("Corner cafe");
  await expect(page.getByText("Corner cafe")).toBeVisible();
  await page.goto("/budgets");
  await page.getByRole("button", { name: "Create budget" }).click();
  await page.getByLabel("Budget amount").fill("800");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText("Overall monthly budget")).toBeVisible();
});
test("creates a custom category and opens profile", async ({ page }) => {
  await register(page, "category");
  await page.goto("/categories");
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("Category name").fill("Weekend treats");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("Weekend treats")).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Sharma");
});
test("opens monthly reports and mobile navigation", async ({ page }, testInfo) => {
  await register(page, "report");
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Six-month comparison")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("navigation").last()).toBeVisible();
    await page
      .getByRole("link", { name: /Transactions/ })
      .last()
      .click();
    await expect(page).toHaveURL(/transactions/);
  }
});
