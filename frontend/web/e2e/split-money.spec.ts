import { expect, test, type Page } from "@playwright/test";
import { assertNoHorizontalOverflow, hideDevOverlay, register } from "./helpers";

async function openSplitMoney(page: Page) {
  await page.goto("/split-money");
  await expect(page.getByRole("heading", { name: "Split Money", level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  await hideDevOverlay(page);
}

/** Wizard footer primary — the header also has a "Continue", so target the footer explicitly. */
function wizardNext(page: Page) {
  return page.locator(".sm-wizard-footer .sm-primary");
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
  await expect(page.getByRole("heading", { name: "Add Person", level: 1 })).toBeVisible();
  const form = page.locator("section.sm-form-card").filter({ hasText: "Full Name" });
  await form.locator("label").filter({ hasText: "Full Name" }).locator("input").fill(name);
  await form.locator("label").filter({ hasText: /Phone Number/ }).locator("input").fill(phone);
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

    // Navigation entry: desktop sidebar "More finance tools" section, or the mobile "More" sheet.
    const desktopTools = page.getByRole("navigation", { name: "More finance tools" });
    const isDesktop = (await desktopTools.count()) > 0 && (await desktopTools.isVisible());
    if (!isDesktop) {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "More" }).click();
    }
    const tools = isDesktop ? desktopTools : page.getByRole("navigation", { name: "More" });
    const splitLink = tools.getByRole("link", { name: /Split Money/i });
    await splitLink.scrollIntoViewIfNeeded();
    await expect(splitLink).toBeVisible();
    await expect(tools.getByText(/Split expenses & settle/i)).toBeVisible();
    await splitLink.click();
    await expect(page).toHaveURL(/\/split-money/);
    await expect(page.getByRole("heading", { name: "Split Money", level: 1 })).toBeVisible();
    await shot(page, "01-empty-dashboard");

    // Empty dashboard stats (use visible main text — raw getByText("NaN") can hit hidden next payloads)
    await expect(page.locator(".sm-stat").getByText("Total shared expenses")).toBeVisible();
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
    await wizardNext(page).click();
    await expect(page.getByText(/Title is required|Amount must be greater/i).first()).toBeVisible();

    await page.locator('label:has-text("Expense title") input').fill("Dinner at Restaurant");
    await page.locator('label:has-text("Total amount") input').fill("6000");
    await page.locator('label:has-text("Category") select').selectOption("Food & Dining");
    await page.locator('label:has-text("Date") input').fill("2026-10-05");
    await page.locator('label:has-text("Time") input').fill("20:30");
    await page.locator('label:has-text("Description") textarea').fill("Dinner with friends");
    await wizardNext(page).click();

    // Step 2 who paid
    await expect(page.getByRole("heading", { name: "Who Paid?" })).toBeVisible();
    await shot(page, "05-who-paid-single");
    await page.getByRole("button", { name: /Multiple payers/i }).click();
    await shot(page, "06-who-paid-multiple");
    await page.getByRole("button", { name: /Single payer/i }).click();
    await wizardNext(page).click();

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
    await wizardNext(page).click();

    // Step 4 equal split — ₹6,000 / 4 = ₹1,500.00
    await expect(page.getByText(/How do you want to split/i)).toBeVisible();
    await page.getByRole("button", { name: /Equal Split/i }).click();
    await expect(page.getByText("₹1,500.00").first()).toBeVisible();
    await shot(page, "08-equal-split");
    await wizardNext(page).click();

    // Step 5 reminders — verify unsupported external channels are disabled (in-app only)
    await expect(page.getByRole("heading", { name: /Due Date/i })).toBeVisible();
    await expect(page.locator(".sm-channels button").filter({ hasText: "Email" })).toBeDisabled();
    await expect(page.locator(".sm-channels button").filter({ hasText: "WhatsApp / SMS" })).toBeDisabled();
    await page.locator('label.sm-date-input input[type="date"]').fill("2026-10-15");
    await expect(page.locator(".sm-cal-grid button.sel")).toHaveText("15");
    await shot(page, "09-due-reminder");
    await wizardNext(page).click();

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

    // Record a partial repayment on a debtor → creditor obligation edge.
    // Single payer (self) and 4 equal shares → 3 obligations of ₹1,500 each, all owed to "You".
    const select = page.locator('label:has-text("Who pays whom") select');
    await expect(select).toBeVisible();
    const options = await select.locator("option").allTextContents();
    expect(options.length, `expected 3 obligations, got ${options.join("|")}`).toBe(3);
    const edge = options.find((o) => /Rohit Sharma/.test(o));
    expect(edge, `expected Rohit's obligation, got ${options.join("|")}`).toBeTruthy();
    expect(edge).toMatch(/₹1,500\.00 left/);
    await select.selectOption({ label: edge! });
    // Scope to the repayment form (the adjustment form below also has an "Amount" field).
    const payFields = page.locator(".sm-fields").filter({ hasText: "Who pays whom" });
    await payFields.locator("label").filter({ hasText: /^Amount$/ }).locator("input").fill("500");
    const payResp = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/split-money/expenses/") &&
        r.url().includes("/payments") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Record repayment" }).click();
    const paid = await payResp;
    expect(paid.ok(), `payment failed: ${paid.status()}`).toBe(true);
    await expect(page.getByText(/Repayment recorded/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Partially Paid|partially_paid/i).first()).toBeVisible();
    // Ledger: Rohit's edge drops to ₹1,000; history shows the manual record.
    await expect(select.locator("option").filter({ hasText: "Rohit Sharma" })).toHaveText(/₹1,000\.00 left/);
    await expect(page.getByText(/Rohit Sharma → .* ₹500\.00 via upi/i)).toBeVisible();
    await shot(page, "13-partial-payment");

    // Void (reverse) the repayment — record stays as voided and the edge is restored.
    const onDialog = (d: import("@playwright/test").Dialog) =>
      d.type() === "prompt" ? d.accept("test reversal") : d.accept();
    page.on("dialog", onDialog);
    const voidResp = page.waitForResponse(
      (r) => /\/payments\/[^/]+\/void$/.test(new URL(r.url()).pathname) && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Reverse repayment of ₹500\.00/ }).click();
    const voided = await voidResp;
    expect(voided.ok(), `void failed: ${voided.status()}`).toBe(true);
    await expect(page.getByText(/\(voided\)/).first()).toBeVisible({ timeout: 15_000 });
    await expect(select.locator("option").filter({ hasText: "Rohit Sharma" })).toHaveText(/₹1,500\.00 left/);
    page.off("dialog", onDialog);
    await shot(page, "13b-voided-payment");

    // Schedule an in-app reminder → honest "within ~15 minutes" copy, listed as scheduled with a Cancel button.
    const reminderResp = page.waitForResponse(
      (r) => r.url().includes("/reminders") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Schedule Reminder" }).click();
    expect((await reminderResp).ok()).toBe(true);
    await expect(page.getByText(/In-app reminder scheduled/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();
    // Wizard step 5 already scheduled a due-date reminder, so expect the manual one in addition.
    await expect(page.getByRole("button", { name: "Cancel reminder" })).toHaveCount(2, { timeout: 15_000 });
    await expect(page.getByText(/in-app · scheduled/i)).toHaveCount(2);
    await shot(page, "13c-reminder");

    // Cancel one scheduled reminder
    await page.getByRole("button", { name: "Cancel reminder" }).first().click();
    await expect(page.getByRole("button", { name: "Cancel reminder" })).toHaveCount(1, { timeout: 15_000 });

    // Edit expense details
    await page.getByRole("button", { name: "Edit details" }).click();
    const editSection = page.locator('section[aria-label="Edit expense details"]');
    await expect(editSection).toBeVisible();
    await editSection.locator("label").filter({ hasText: "Expense title" }).locator("input").fill("Dinner at Restaurant (Edited)");
    await editSection.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByRole("heading", { name: "Dinner at Restaurant (Edited)", level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    // Apply a waiver/adjustment on Aman Gupta's share (₹500 waiver reduces ₹1,500 -> ₹1,000)
    const adjFields = page.locator(".sm-fields").filter({ hasText: "Select participant" });
    const adjSelect = adjFields.locator("label").filter({ hasText: "Person" }).locator("select");
    const amanOpt = (await adjSelect.locator("option").allTextContents()).find((o) => /Aman Gupta/.test(o));
    expect(amanOpt).toBeTruthy();
    await adjSelect.selectOption({ label: amanOpt! });
    await adjFields.locator("label").filter({ hasText: "Type" }).locator("select").selectOption("waived");
    await adjFields.locator("label").filter({ hasText: /^Amount$/ }).locator("input").fill("500");
    await page.getByRole("button", { name: "Apply adjustment" }).click();
    await expect(select.locator("option").filter({ hasText: "Aman Gupta" })).toHaveText(/₹1,000\.00 left/, {
      timeout: 15_000,
    });

    // Upload and view receipt on ExpenseDetail
    const receiptSection = page.locator('section[aria-label="Receipts"]');
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    await receiptSection.locator('input[type="file"]').setInputFiles({
      name: "dinner-receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from(pngBase64, "base64"),
    });
    await expect(receiptSection.getByText("dinner-receipt.png")).toBeVisible({ timeout: 15_000 });
    await expect(receiptSection.getByRole("link", { name: "View" })).toBeVisible();

    // Preview Borrow/Lend suggestions via Convert button (preview-only; does not create duplicate debt)
    const convertResp = page.waitForResponse(
      (r) => r.url().includes("/convert-lend") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Convert" }).click();
    expect((await convertResp).ok()).toBe(true);

    // Mark all remaining obligations settled atomically
    page.once("dialog", (d) => d.accept());
    const settleResp = page.waitForResponse(
      (r) => r.url().includes("/settle") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Mark Settled" }).click();
    expect((await settleResp).ok()).toBe(true);
    await expect(page.getByText("Nothing is outstanding on this expense.")).toBeVisible({ timeout: 15_000 });

    // Confirm persisted D1 database state via fresh API fetch
    const createdBody = (await created.json()) as { data?: { id?: string }; id?: string };
    const createdExpenseId = createdBody.data?.id ?? createdBody.id;
    expect(createdExpenseId).toBeTruthy();
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8787";
    const persisted = await page.evaluate(
      async ({ id, api }) => {
        const res = await fetch(`${api}/api/v1/split-money/expenses/${id}`, { credentials: "include" });
        const json = await res.json();
        return json.data ?? json;
      },
      { id: createdExpenseId, api: apiBase },
    );
    expect(persisted.status).toBe("settled");
    expect(persisted.ledger?.remainingMinor).toBe(0);
    expect(persisted.ledger?.collectibleMinor).toBe(400_000); // ₹4,500 initial external share − ₹500 Aman waiver = ₹4,000
    expect(persisted.ledger?.collectedMinor).toBe(400_000);
    expect(persisted.obligations).toEqual([]);
    expect(persisted.payments.some((p: { status: string }) => p.status === "voided")).toBe(true);
    expect(persisted.adjustments.some((a: { type: string; amountMinor: number }) => a.type === "waived" && a.amountMinor === -50_000)).toBe(true);
    expect(persisted.receipts.length).toBeGreaterThanOrEqual(1);
    expect(persisted.ledgerVersion).toBeGreaterThanOrEqual(5);

    // History + filter tabs + detail drawer
    await page.goto("/split-money/history");
    await expect(page.getByRole("heading", { name: "Split History", level: 1 })).toBeVisible();
    await expect(page.getByText("Dinner at Restaurant (Edited)").first()).toBeVisible();
    await page.getByRole("button", { name: "Settled", exact: true }).click();
    await expect(page.getByText("Dinner at Restaurant (Edited)").first()).toBeVisible();
    await page.locator(".sm-hist-row").filter({ hasText: "Dinner at Restaurant (Edited)" }).first().click();
    await expect(page.getByRole("heading", { name: "Payment History" })).toBeVisible();
    await expect(page.getByText(/\(voided\)/).first()).toBeVisible();
    await shot(page, "14-history");

    // Dashboard populated
    await openSplitMoney(page);
    await expect(page.getByText("Dinner at Restaurant (Edited)").first()).toBeVisible();
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
    await wizardNext(page).click();
    await page.getByRole("button", { name: /Multiple payers/i }).click();
    // Select two people as payers
    const payerCards = page.locator(".sm-people-grid button");
    await payerCards.nth(0).click();
    await payerCards.nth(1).click();
    const payerInputs = page.locator('.sm-fields label .sm-input-icon input');
    if ((await payerInputs.count()) >= 2) {
      await payerInputs.nth(0).fill("4000");
      await payerInputs.nth(1).fill("1500");
      await wizardNext(page).click();
      await expect(page.getByText(/must equal the expense total/i)).toBeVisible();
      await payerInputs.nth(1).fill("2000");
    }
  });

  test("people edit/archive/restore, group balances & members, cancel/reopen & delete expense", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await register(page, "split-lifecycle");

    await addPerson(page, "Karan Mehta", "9811112222");
    await addPerson(page, "Sneha Nair", "9811113333");

    // Open Sneha Nair -> Edit person -> Archive person -> Show archived -> Restore person
    await page.locator(".sm-people-list button").filter({ hasText: "Sneha Nair" }).click();
    await expect(page.getByRole("heading", { name: "Sneha Nair", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Edit person" }).click();
    await page.locator("label").filter({ hasText: "Full Name" }).locator("input").fill("Sneha Nair Updated");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Sneha Nair Updated", level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Archive person" }).click();
    await expect(page.locator(".sm-chip").filter({ hasText: "Archived" })).toBeVisible({ timeout: 15_000 });

    // Back to People list: hidden until "Show archived" is toggled
    await page.getByRole("button", { name: /People/ }).first().click();
    await expect(page.locator(".sm-people-list").getByText("Sneha Nair Updated")).toHaveCount(0);
    await page.getByRole("button", { name: "Show archived" }).click();
    await expect(page.locator(".sm-people-list").getByText(/Sneha Nair Updated \(Archived\)/)).toBeVisible({
      timeout: 15_000,
    });
    await page.locator(".sm-people-list button").filter({ hasText: "Sneha Nair Updated" }).click();
    await page.getByRole("button", { name: "Restore person" }).click();
    await expect(page.getByRole("button", { name: "Archive person" })).toBeVisible({ timeout: 15_000 });

    // Create group with Karan Mehta, then manage group members, balances, and settings
    await page.goto("/split-money/groups");
    await page.getByRole("button", { name: /Create Group/i }).click();
    await page.locator('label:has-text("Group Name") input').fill("Office Lunch Group");
    const groupPrimary = page.locator(".sm-wizard-footer .sm-primary");
    await groupPrimary.click();
    await page.locator(".sm-contact-list button").filter({ hasText: "Karan Mehta" }).click();
    await groupPrimary.click();
    await groupPrimary.click();
    await groupPrimary.click();
    await expect(page.getByText("Office Lunch Group").first()).toBeVisible({ timeout: 15_000 });

    // Open group detail
    await page.getByRole("button", { name: /Office Lunch Group/ }).click();
    await expect(page.getByRole("heading", { name: "Office Lunch Group", level: 1 })).toBeVisible();

    // Members tab: add and remove Sneha Nair Updated (settled balance = 0)
    await page.getByRole("button", { name: "Members", exact: true }).click();
    await page.getByLabel("Add member").selectOption({ label: "Sneha Nair Updated" });
    await page.getByRole("button", { name: /^Add$/ }).click();
    await expect(page.locator(".sm-member-row").filter({ hasText: "Sneha Nair Updated" })).toBeVisible({
      timeout: 15_000,
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Remove Sneha Nair Updated" }).click();
    await expect(page.locator(".sm-member-row").filter({ hasText: "Sneha Nair Updated" })).toHaveCount(0, {
      timeout: 15_000,
    });

    // Balances and Settings tabs
    await page.getByRole("button", { name: "Balances", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Member balances" })).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Save Settings" }).click();

    // Create a clean expense, then exercise Cancel -> Reopen -> Delete
    await page.goto("/split-money/create");
    await page.evaluate(() => localStorage.removeItem("hisaab.split-expense.draft.v1"));
    await page.reload();
    await page.locator('label:has-text("Expense title") input').fill("Quick Snack");
    await page.locator('label:has-text("Total amount") input').fill("400");
    await wizardNext(page).click();
    await wizardNext(page).click();
    const karanRow = page.locator(".sm-contact-list button").filter({ hasText: "Karan Mehta" });
    if (!/Added/i.test(await karanRow.locator("span").last().innerText())) {
      await karanRow.click();
    }
    await wizardNext(page).click();
    await wizardNext(page).click();
    await wizardNext(page).click();
    await page.getByRole("button", { name: /Create Split Expense/i }).click();
    await expect(page.getByRole("heading", { name: "Expense Created Successfully!", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /View Expense/i }).click();
    await expect(page.getByRole("heading", { name: "Quick Snack", level: 1 })).toBeVisible({ timeout: 15_000 });

    // Cancel expense -> Reopen expense -> Delete expense
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel expense" }).dispatchEvent("click");
    await expect(page.getByRole("button", { name: "Reopen expense" })).toBeVisible({ timeout: 15_000 });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Reopen expense" }).dispatchEvent("click");
    await expect(page.getByRole("button", { name: "Cancel expense" })).toBeVisible({ timeout: 15_000 });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).dispatchEvent("click");
    await expect(page).toHaveURL(/\/split-money$/, { timeout: 15_000 });
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
    await wizardNext(pageA).click();
    await wizardNext(pageA).click();
    const contacts = pageA.locator(".sm-contact-list button");
    const n = await contacts.count();
    for (let i = 0; i < n; i += 1) {
      const btn = contacts.nth(i);
      const label = await btn.locator("span").last().innerText();
      if (/Add/i.test(label) && !/Added/i.test(label)) await btn.click();
    }
    await wizardNext(pageA).click();
    await wizardNext(pageA).click();
    await wizardNext(pageA).click();
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
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8787";
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
