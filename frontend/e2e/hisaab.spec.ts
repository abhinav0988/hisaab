import { expect, test } from "@playwright/test";
import { logoutFromSettings, register } from "./helpers";

test("creates an account, logs out, and logs back in", async ({ page }) => {
  const credentials = await register(page, "auth");
  await logoutFromSettings(page);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page).toHaveURL(/dashboard/);
});
test("adds expense and income, filters transactions, and creates a budget", async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, "finance");
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Cash", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UPI", level: 3 })).toBeVisible();
  await page.goto("/transactions?action=expense");
  await page.getByLabel(/Amount/).fill("25.50");
  await page.getByLabel("Merchant", { exact: true }).fill("Corner cafe");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText("Corner cafe")).toBeVisible();
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await page.getByRole("button", { name: "Income", exact: true }).click();
  await page.getByLabel(/Amount/).fill("500");
  await page.getByLabel("Source").fill("Freelance client");
  await page.getByRole("button", { name: "Add income" }).click();
  await page.getByPlaceholder("Search merchant, category, account...").fill("Corner cafe");
  await expect(page.getByText("Corner cafe")).toBeVisible();
  await page.goto("/budgets");
  await page.getByRole("button", { name: "Add Category Limit", exact: true }).click();
  await page.getByLabel("Budget amount").fill("800");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Overall budget").first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/recurring");
  await page.getByRole("button", { name: "New Reminder" }).first().click();
  await page.getByLabel(/Amount/).fill("12");
  await page.getByLabel("Merchant", { exact: true }).fill("Music plan");
  await page.getByRole("dialog").getByRole("button", { name: "Create reminder" }).click();
  await expect(page.getByText("Music plan").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Edit schedule" }).click();
  await page.getByLabel("Merchant", { exact: true }).fill("Music Plus");
  await page.getByRole("button", { name: "Save reminder" }).click();
  await expect(page.getByText("Music Plus").first()).toBeVisible({ timeout: 15_000 });
});
test("creates a custom category and opens profile", async ({ page }) => {
  await register(page, "category");
  await page.goto("/categories");
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("Category name").fill("Weekend treats");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("Weekend treats")).toBeVisible();
  await page.getByRole("button", { name: "Delete Weekend treats" }).click();
  await expect(page.getByRole("heading", { name: "Delete Weekend treats?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Weekend treats")).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
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
