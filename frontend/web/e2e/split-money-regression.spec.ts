import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { assertNoHorizontalOverflow, hideDevOverlay, register } from "./helpers";

const DRAFT_KEY = "hisaab.split-expense.draft.v1";
const SHOTS = "e2e/screenshots/split-money";
const repoRoot = resolve(process.cwd(), "../..");

type Person = { id: string; userId: string; fullName: string; isSelf: boolean };

async function api<T>(page: Page, path: string, init?: { method?: string; body?: unknown }) {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8787";
  return page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, json: (await res.json()) as { data?: unknown; error?: unknown } };
    },
    { url: `${base}/api/v1/split-money${path}`, method: init?.method ?? "GET", body: init?.body },
  ) as Promise<{ status: number; json: { data?: T; error?: { code?: string; message?: string } } }>;
}

async function addPeople(page: Page, names: string[]) {
  const created: Person[] = [];
  for (const [index, fullName] of names.entries()) {
    const res = await api<Person>(page, "/people", {
      method: "POST",
      body: { fullName, phone: `98765432${10 + index}`, relationship: "friend", countryCode: "IN" },
    });
    expect(res.status, JSON.stringify(res.json)).toBeLessThan(300);
    created.push(res.json.data!);
  }
  return created;
}

async function selfPerson(page: Page) {
  const res = await api<Person[]>(page, "/people");
  return res.json.data!.find((p) => p.isSelf)!;
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Writes rows straight into the local dev D1 — the only way to reproduce data the current API now refuses. */
function seedLocalD1(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), "hisaab-seed-"));
  const file = join(dir, "seed.sql");
  writeFileSync(file, sql);
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "hisaab", "--local", "--persist-to", "../../.wrangler/state", "--file", file],
    { cwd: join(repoRoot, "backend/auth"), stdio: "pipe", env: { ...process.env, CI: "1" } },
  );
}

test.describe("Split Money regressions", () => {
  test.describe.configure({ retries: 0 });

  test("₹100 / 3 with another payer and reminders persists exact allocations and labels debts correctly", async ({ page }) => {
    test.setTimeout(180_000);
    await register(page, "split-reg-100");
    const [rohit] = await addPeople(page, ["Rohit Sharma", "Priya Verma"]);

    await page.goto("/split-money/create");
    await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
    await page.reload();
    await hideDevOverlay(page);
    const next = page.locator(".sm-wizard-footer .sm-primary");
    await page.locator('label:has-text("Expense title") input').fill("Snacks");
    await page.locator('label:has-text("Total amount") input').fill("100");
    await next.click();
    await page.locator(".sm-people-grid button").filter({ hasText: "Rohit Sharma" }).click();
    await next.click();
    for (const name of ["Rohit Sharma", "Priya Verma"]) {
      await page.locator(".sm-contact-list button").filter({ hasText: name }).click();
    }
    await next.click();
    await page.getByRole("button", { name: /Equal Split/i }).click();
    const breakdown = page.locator(".sm-breakdown-neon");
    await expect(breakdown.locator(".sm-breakdown-row").filter({ hasText: "Rohit Sharma" })).toContainText("Paid upfront");
    await expect(breakdown.locator(".sm-breakdown-row").filter({ hasText: "(You)" })).toContainText("Owes Rohit");
    await expect(breakdown).not.toContainText("Owes you");
    await next.click();
    await page.locator('label.sm-date-input input[type="date"]').fill(localToday());
    await next.click();
    await page.screenshot({ path: `${SHOTS}/after-review-100-3.png`, fullPage: true });

    const before = Date.now();
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/split-money/expenses") && r.request().method() === "POST"),
      page.getByRole("button", { name: /Create Split Expense/i }).click(),
    ]);
    expect(response.status(), await response.text()).toBe(201);
    const created = ((await response.json()) as { data: { id: string } }).data;

    const persisted = await api<{
      participants: Array<{ shareAmountMinor: number }>;
      payers: Array<{ personId: string; paidAmountMinor: number }>;
      reminders: Array<{ scheduledAt: string }>;
      obligations: Array<{ creditorPersonId: string; amountMinor: number }>;
    }>(page, `/expenses/${created.id}`);
    const view = persisted.json.data!;
    expect(view.participants.map((p) => p.shareAmountMinor).sort((a, b) => b - a)).toEqual([3_334, 3_333, 3_333]);
    expect(view.participants.reduce((sum, p) => sum + p.shareAmountMinor, 0)).toBe(10_000);
    expect(view.payers).toEqual([expect.objectContaining({ personId: rohit!.id, paidAmountMinor: 10_000 })]);
    expect(view.obligations.every((edge) => edge.creditorPersonId === rohit!.id)).toBe(true);
    expect(view.reminders.length).toBeGreaterThan(0);
    for (const reminder of view.reminders) {
      expect(Date.parse(reminder.scheduledAt)).toBeGreaterThanOrEqual(before - 60_000);
    }
  });

  test("a stale saved draft is repaired or sent back to the failing step instead of a generic error", async ({ page }) => {
    test.setTimeout(180_000);
    await register(page, "split-reg-draft");
    const [rohit, priya] = await addPeople(page, ["Rohit Sharma", "Priya Verma"]);
    const self = await selfPerson(page);
    await page.goto("/split-money/create");

    // Older releases could leave a multi-payer draft with no amounts, a seconds-precision time and deleted people.
    await page.evaluate(
      ({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)),
      {
        key: DRAFT_KEY,
        draft: {
          step: 6,
          title: "Stale draft",
          amountMajor: "100",
          category: "Food & Dining",
          expenseTime: "20:30:00",
          payerMode: "multiple",
          payerIds: [rohit!.id],
          payerAmounts: {},
          participantIds: [self.id, rohit!.id, priya!.id],
          method: "equal",
          firstReminderDays: 99,
          frequencyDays: 0,
          remindersEnabled: true,
        },
      },
    );
    await page.reload();
    await hideDevOverlay(page);

    let posted = false;
    page.on("request", (r) => {
      if (r.url().includes("/split-money/expenses") && r.method() === "POST") posted = true;
    });
    await page.getByRole("button", { name: /Create Split Expense/i }).click();
    await expect(page.getByText("Payer amounts must equal the expense total")).toHaveCount(1);
    await expect(page.getByText("Payer amounts must equal the expense total")).toBeVisible();
    await expect(page.locator(".sm-section-heading h2").first()).toContainText(/Who Paid/i);
    await page.screenshot({ path: `${SHOTS}/after-stale-draft-step-error.png`, fullPage: true });
    expect(posted).toBe(false);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), DRAFT_KEY);
    expect(stored.expenseTime).toBe("20:30");
    expect(stored.firstReminderDays).toBe(30);
    expect(stored.frequencyDays).toBe(1);
    expect(stored.ownerId).toBe(self.id);

    // A draft that references people who no longer exist is pruned back to the step that lost them.
    await page.evaluate(
      ({ key, ownerId, ids }) =>
        localStorage.setItem(
          key,
          JSON.stringify({ step: 6, title: "Ghost", amountMajor: "100", ownerId, participantIds: ids, payerIds: [ownerId] }),
        ),
      { key: DRAFT_KEY, ownerId: self.id, ids: [self.id, "ghost-person-0000"] },
    );
    await page.reload();
    await expect
      .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), DRAFT_KEY))
      .toMatchObject({ step: 3, participantIds: [self.id] });
  });

  test("adding yourself as a contact is refused with a field-level reason", async ({ page }) => {
    test.setTimeout(120_000);
    const { email } = await register(page, "split-reg-self");
    const res = await api(page, "/people", {
      method: "POST",
      body: { fullName: "Asha Sharma", email: email.toUpperCase(), relationship: "friend", countryCode: "IN" },
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatchObject({ code: "PERSON_IS_SELF" });
  });

  test("legacy water bill shows refunds, flags and reconciled dashboard on desktop and 320px", async ({ page }) => {
    test.setTimeout(240_000);
    const { email } = await register(page, "split-reg-legacy");
    const self = await selfPerson(page);
    const uid = self.userId;
    const now = Date.now();
    const at = (ms: number) => new Date(now - 3_600_000 + ms).toISOString();
    const dup = `dup-${now}`;
    const sat = `sat-${now}`;
    const exp = `water-${now}`;
    const pay = (id: string, part: string, from: string, to: string, amount: number, ms: number) =>
      `INSERT INTO split_payments (id, expense_id, participant_id, payer_person_id, receiver_person_id, amount_minor, method, payment_date, status, is_final_settlement, created_at, updated_at) VALUES ('${id}', '${exp}', '${part}', '${from}', '${to}', ${amount}, 'upi', '2026-10-13', 'completed', 0, '${at(ms)}', '${at(ms)}');`;
    seedLocalD1(
      [
        `INSERT INTO split_people (id, user_id, full_name, email, country_code, relationship, is_self, created_at, updated_at) VALUES ('${dup}', '${uid}', 'Asha Sharma', '${email}', 'IN', 'friend', 0, '${at(0)}', '${at(0)}'), ('${sat}', '${uid}', 'satyaki', NULL, 'IN', 'friend', 0, '${at(0)}', '${at(0)}');`,
        `INSERT INTO split_expenses (id, user_id, title, category, total_amount_minor, currency, expense_date, split_method, status, allow_partial_payments, send_notifications, is_draft, ledger_version, created_at, updated_at) VALUES ('${exp}', '${uid}', 'water bill', 'Utilities', 50000, 'INR', '2026-10-13', 'equal', 'pending', 1, 1, 0, 0, '${at(0)}', '${at(0)}');`,
        `INSERT INTO split_expense_payers (id, expense_id, person_id, paid_amount_minor) VALUES ('${exp}-payer', '${exp}', '${self.id}', 50000);`,
        `INSERT INTO split_participants (id, expense_id, person_id, share_percentage_bps, share_value, share_amount_minor, adjusted_share_amount_minor, paid_amount_minor, pending_amount_minor, status) VALUES ('${exp}-p-self', '${exp}', '${self.id}', 3333, 1, 16667, 16667, 0, 0, 'pending'), ('${exp}-p-dup', '${exp}', '${dup}', 3333, 1, 16667, 16667, 0, 0, 'pending'), ('${exp}-p-sat', '${exp}', '${sat}', 3334, 1, 16666, 16666, 0, 0, 'pending');`,
        pay(`${exp}-1`, `${exp}-p-self`, self.id, self.id, 16_667, 1_000),
        pay(`${exp}-2`, `${exp}-p-self`, self.id, self.id, 16_667, 1_500),
        pay(`${exp}-5`, `${exp}-p-dup`, dup, self.id, 15_500, 10_000),
        pay(`${exp}-6`, `${exp}-p-dup`, dup, self.id, 15_500, 11_600),
        pay(`${exp}-7`, `${exp}-p-sat`, sat, self.id, 16_666, 30_000),
      ].join("\n"),
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/split-money/expense?id=${exp}`);
    await hideDevOverlay(page);
    await expect(page.getByTestId("split-review-banner")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("split-correction-due")).toContainText("₹143.33");
    await expect(page.getByTestId("flag-self-transfer").first()).toBeVisible();
    await expect(page.getByTestId("flag-duplicate").first()).toBeVisible();
    await expect(page.getByText("must refund")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Settled" })).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/after-legacy-expense-desktop.png`, fullPage: true });

    const dash = await api<{ summary: Record<string, number> }>(page, "/dashboard");
    const s = dash.json.data!.summary;
    expect(s.collectedMinor).toBeLessThanOrEqual(s.collectibleMinor!);
    expect(s.pendingMinor).toBe(s.outstandingDebtMinor! + s.correctionDueMinor!);
    expect(s.correctionDueMinor).toBe(14_333);
    expect(s.moneyToPayMinor).toBe(14_333);

    await page.goto("/split-money");
    await hideDevOverlay(page);
    await expect(page.getByTestId("split-progress-caption")).toContainText("₹333.33 owed on shared bills");
    await expect(page.getByTestId("split-progress-refund")).toContainText("₹143.33");
    await page.screenshot({ path: `${SHOTS}/after-legacy-dashboard-desktop.png`, fullPage: true });

    await page.setViewportSize({ width: 320, height: 879 });
    await page.reload();
    await hideDevOverlay(page);
    await expect(page.getByTestId("split-progress-caption")).toBeVisible({ timeout: 20_000 });
    const row = page.locator(".sm-expense-table button.sm-row").filter({ hasText: "water bill" });
    await row.scrollIntoViewIfNeeded();
    const boxes = await row.evaluate((el) =>
      Array.from(el.children)
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })),
    );
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        expect(overlap, `cells overlap: ${JSON.stringify([a, b])}`).toBe(false);
      }
    }
    await assertNoHorizontalOverflow(page);
    await row.screenshot({ path: `${SHOTS}/after-legacy-dashboard-row-320.png` });
    await page.screenshot({ path: `${SHOTS}/after-legacy-dashboard-320.png`, fullPage: true });
  });
});
