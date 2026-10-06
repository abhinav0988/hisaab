import { expect, test, type Page } from "@playwright/test";
import { assertNoHorizontalOverflow, hideDevOverlay, register } from "./helpers";

async function openSplitMoney(page: Page) {
  await page.goto("/split-money");
  await expect(page.getByRole("heading", { name: "Split Money", level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await hideDevOverlay(page);
}

async function shot(page: Page, name: string) {
  await hideDevOverlay(page);
  await page.screenshot({
    path: `e2e/screenshots/split-money/${name}.png`,
    fullPage: true,
  });
}

async function addPerson(page: Page, name: string, phone: string) {
  await page.goto("/split-money/people");
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /^Add Person$/ }).click();
  const form = page.locator("section.sm-form-card").filter({ hasText: "Add Person" });
  await expect(form.getByRole("heading", { name: "Add Person" })).toBeVisible();
  await form.locator("label").filter({ hasText: "Full Name" }).locator("input").fill(name);
  await form.locator("label").filter({ hasText: /^Phone$/ }).locator("input").fill(phone);
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/split-money/people") &&
        r.request().method() === "POST" &&
        r.ok(),
    ),
    form.getByRole("button", { name: "Save Person" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
}

test.describe("Split Money", () => {
  test.describe.configure({ retries: 0 });

  test("sidebar, empty dashboard, people, equal split, partial payment", async ({ page }) => {
    test.setTimeout(240_000);
    await register(page, "split-qa");

    // Sidebar presence (finance tools section)
    const tools = page.getByRole("navigation", { name: "More finance tools" });
    const splitLink = tools.getByRole("link", { name: /Split Money/i });
    await splitLink.scrollIntoViewIfNeeded();
    await expect(splitLink).toBeVisible();
    await expect(tools.getByText(/Split expenses & settle/i)).toBeVisible();
    await splitLink.click();
    await expect(page).toHaveURL(/\/split-money/);
    await expect(page.getByRole("heading", { name: "Split Money", level: 1 })).toBeVisible();
    await shot(page, "01-empty-dashboard");

    // Empty dashboard stats (use visible main text — raw getByText("NaN") can hit hidden next payloads)
    await expect(page.getByText("Total shared expenses")).toBeVisible();
    await expect(page.getByText("No split expenses yet")).toBeVisible();
    const dashText = await page.locator("main.sm-page").innerText();
    expect(dashText).not.toMatch(/₹NaN|\bNaN\b|\bundefined\b/);
    await expect(page.locator("main.sm-page").getByText("₹0.00").first()).toBeVisible();

    // Refresh keeps route
    await page.reload();
    await expect(page).toHaveURL(/\/split-money/);
    await expect(page.getByRole("heading", { name: "Split Money", level: 1 })).toBeVisible();

    // Regression: other module still loads
    await page.goto("/lend");
    await expect(page.getByRole("heading", { name: /Borrow|Lend/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await openSplitMoney(page);

    // People
    await page.goto("/split-money/people");
    await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();
    await addPerson(page, "Rohit Sharma", "9876543210");
    await addPerson(page, "Priya Verma", "9876543211");
    await addPerson(page, "Aman Gupta", "9876543212");
    await shot(page, "02-people-list");

    // Groups create (footer primary is the stable control across steps)
    await page.goto("/split-money/groups");
    await expect(page.getByRole("heading", { name: "Groups", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /Create Group/i }).click();
    await page.locator('label:has-text("Group Name") input').fill("Friends Group");
    await page.locator('label:has-text("Description") textarea').fill("Weekend expenses");
    const groupPrimary = page.locator(".sm-wizard-footer .sm-primary");
    await groupPrimary.click();
    await expect(page.locator(".sm-stepper button.current")).toContainText("Add Members");
    await page.locator(".sm-contact-list button").filter({ hasText: "Rohit Sharma" }).click();
    await expect(
      page.locator(".sm-contact-list button").filter({ hasText: "Rohit Sharma" }).getByText("Added"),
    ).toBeVisible();
    await groupPrimary.click();
    await expect(page.locator(".sm-stepper button.current")).toContainText("Settings");
    await groupPrimary.click();
    await expect(page.locator(".sm-stepper button.current")).toContainText("Review");
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/v1/split-money/groups") &&
          r.request().method() === "POST" &&
          r.ok(),
      ),
      groupPrimary.click(),
    ]);
    await expect(page.getByRole("heading", { name: "Groups", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Friends Group").first()).toBeVisible({ timeout: 15_000 });
    await shot(page, "03-groups");

    // Create expense wizard
    await page.goto("/split-money/create");
    await page.evaluate(() => localStorage.removeItem("hisaab.split-expense.draft.v1"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Create Split Expense", level: 1 })).toBeVisible();
    await shot(page, "04-create-step1");

    // Invalid step 1
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText(/Title is required|Amount must be greater/i).first()).toBeVisible();

    await page.locator('label:has-text("Expense title") input').fill("Dinner at Restaurant");
    await page.locator('label:has-text("Total amount") input').fill("6000");
    await page.locator('label:has-text("Category") select').selectOption("Food & Dining");
    await page.locator('label:has-text("Date") input').fill("2026-10-05");
    await page.locator('label:has-text("Time") input').fill("20:30");
    await page.locator('label:has-text("Description") textarea').fill("Dinner with friends");
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Step 2 who paid
    await expect(page.getByRole("heading", { name: "Who Paid?" })).toBeVisible();
    await shot(page, "05-who-paid-single");
    await page.getByRole("button", { name: /Multiple payers/i }).click();
    await shot(page, "06-who-paid-multiple");
    await page.getByRole("button", { name: /Single payer/i }).click();
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Step 3 split with — ensure all people selected (self + 3 friends)
    await expect(page.getByRole("heading", { name: "Split With" })).toBeVisible();
    for (const name of ["Rohit Sharma", "Priya Verma", "Aman Gupta"]) {
      const row = page.locator(".sm-contact-list button").filter({ hasText: name });
      const status = row.locator("span").last();
      if (/Add/i.test(await status.innerText()) && !/Added/i.test(await status.innerText())) {
        await row.click();
      }
      await expect(row.getByText("Added")).toBeVisible();
    }
    await expect(page.locator(".sm-contact-list button").filter({ hasText: "Added" })).toHaveCount(4);
    await shot(page, "07-split-with");
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Step 4 equal split — ₹6,000 / 4 = ₹1,500.00
    await expect(page.getByText(/How do you want to split/i)).toBeVisible();
    await page.getByRole("button", { name: /Equal Split/i }).click();
    await expect(page.getByText("₹1,500.00").first()).toBeVisible();
    await shot(page, "08-equal-split");
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Step 5 reminders
    await expect(page.getByRole("heading", { name: /Due Date/i })).toBeVisible();
    await page.locator('label:has-text("Settlement due date") input').fill("2026-10-15");
    await shot(page, "09-due-reminder");
    await page.getByRole("button", { name: /^Continue/ }).click();

    // Step 6 review + create
    await expect(page.getByRole("heading", { name: /Review/i })).toBeVisible();
    await expect(page.getByText("Dinner at Restaurant").first()).toBeVisible();
    await shot(page, "10-review");
    const createResp = page.waitForResponse(
      (r) => r.url().includes("/api/v1/split-money/expenses") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Create Split Expense/i }).click();
    const created = await createResp;
    expect(created.ok(), `create expense failed: ${created.status()}`).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Expense Created Successfully!", level: 1 }),
    ).toBeVisible({ timeout: 20_000 });
    await shot(page, "11-success");
    await page.getByRole("button", { name: /View Expense/i }).click();

    // Expense detail
    await expect(page.getByRole("heading", { name: "Dinner at Restaurant", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, "12-expense-detail");

    // Record partial payment against a non-self pending participant
    const select = page.locator('label:has-text("Person") select');
    await expect(select).toBeVisible();
    const options = await select.locator("option").allTextContents();
    const pendingOption = options.find(
      (o) =>
        /pending/i.test(o) &&
        !/Select participant/i.test(o) &&
        !/^You\b/i.test(o.trim()),
    );
    expect(pendingOption, `expected non-self pending participant, got ${options.join("|")}`).toBeTruthy();
    await select.selectOption({ label: pendingOption! });
    await page.locator("label").filter({ hasText: /^Amount$/ }).locator("input").fill("500");
    const payResp = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/split-money/expenses/") &&
        r.url().includes("/payments") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Record Payment" }).click();
    const paid = await payResp;
    expect(paid.ok(), `payment failed: ${paid.status()}`).toBe(true);
    await expect(page.getByText(/Payment recorded/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Partially Paid|partially_paid/i).first()).toBeVisible();
    await shot(page, "13-partial-payment");

    // History
    await page.goto("/split-money/history");
    await expect(page.getByRole("heading", { name: "Split History", level: 1 })).toBeVisible();
    await expect(page.getByText("Dinner at Restaurant").first()).toBeVisible();
    await shot(page, "14-history");

    // Dashboard populated
    await openSplitMoney(page);
    await expect(page.getByText("Dinner at Restaurant").first()).toBeVisible();
    await expect(page.getByText("No split expenses yet")).toHaveCount(0);
    await shot(page, "15-dashboard-populated");

    // Import receipt UI shell
    await page.goto("/split-money/import-receipt");
    await expect(page.getByRole("heading", { name: "Import Receipt", level: 1 })).toBeVisible();
    await expect(page.getByText(/Gmail|coming soon/i).first()).toBeVisible();
    await shot(page, "16-import-receipt");

    // Multiple payer validation via UI
    await page.goto("/split-money/create");
    await page.locator('label:has-text("Expense title") input').fill("Trip Snacks");
    await page.locator('label:has-text("Total amount") input').fill("6000");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /Multiple payers/i }).click();
    // Select two people as payers
    const payerCards = page.locator(".sm-people-grid button");
    await payerCards.nth(0).click();
    await payerCards.nth(1).click();
    const payerInputs = page.locator('.sm-fields label .sm-input-icon input');
    if ((await payerInputs.count()) >= 2) {
      await payerInputs.nth(0).fill("4000");
      await payerInputs.nth(1).fill("1500");
      await page.getByRole("button", { name: /^Continue/ }).click();
      await expect(page.getByText(/must equal the expense total/i)).toBeVisible();
      await payerInputs.nth(1).fill("2000");
    }
  });

  test("mobile split money dashboard has no horizontal overflow", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await register(page, "split-mobile");
    await openSplitMoney(page);
    await assertNoHorizontalOverflow(page);
    await shot(page, "17-mobile-dashboard");
    await page.getByRole("button", { name: /Split Expense/i }).first().click();
    await expect(page.getByRole("heading", { name: "Create Split Expense", level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await shot(page, "18-mobile-create");
  });
});

test.describe("Split Money authz API", () => {

  test("user B cannot read user A expense", async ({ browser }) => {
    test.setTimeout(240_000);
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await register(pageA, "split-auth-a");
    await register(pageB, "split-auth-b");

    // Seed people + expense as A via UI minimally
    await pageA.goto("/split-money/people");
    await addPerson(pageA, "Friend One", "9000000001");
    await pageA.goto("/split-money/create");
    await pageA.locator('label:has-text("Expense title") input').fill("Private Dinner");
    await pageA.locator('label:has-text("Total amount") input').fill("1000");
    await pageA.getByRole("button", { name: /^Continue/ }).click();
    await pageA.getByRole("button", { name: /^Continue/ }).click();
    const contacts = pageA.locator(".sm-contact-list button");
    const n = await contacts.count();
    for (let i = 0; i < n; i += 1) {
      const btn = contacts.nth(i);
      const label = await btn.locator("span").last().innerText();
      if (/Add/i.test(label) && !/Added/i.test(label)) await btn.click();
    }
    await pageA.getByRole("button", { name: /^Continue/ }).click();
    await pageA.getByRole("button", { name: /^Continue/ }).click();
    await pageA.getByRole("button", { name: /^Continue/ }).click();
    const createResp = pageA.waitForResponse(
      (r) => r.url().includes("/api/v1/split-money/expenses") && r.request().method() === "POST",
    );
    await pageA.getByRole("button", { name: /Create Split Expense/i }).click();
    const created = await createResp;
    expect(created.ok()).toBe(true);
    const body = (await created.json()) as { data?: { id?: string }; id?: string };
    const expenseId = body.data?.id ?? body.id;
    expect(expenseId).toBeTruthy();

    await pageA.getByRole("button", { name: /View Expense/i }).click();
    await expect(pageA.getByRole("heading", { name: "Private Dinner", level: 1 })).toBeVisible();

    // Must hit the gateway origin (not Next.js). Cookies are set for the API host.
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8797";
    const status = await pageB.evaluate(
      async ({ id, api }) => {
        const res = await fetch(`${api}/api/v1/split-money/expenses/${id}`, {
          credentials: "include",
        });
        return res.status;
      },
      { id: expenseId, api: apiBase },
    );
    expect([403, 404]).toContain(status);

    await contextA.close();
    await contextB.close();
  });
});
