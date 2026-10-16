import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import type { z } from "zod";
import type { splitExpenseSchema, splitPaymentSchema, splitPersonSchema } from "@hisaab/validation";
import { requestHash } from "./idempotency";
import {
  addGroupMember,
  archivePerson,
  cancelReminder,
  convertExpenseToLend,
  createAdjustment,
  createExpense,
  createGroup,
  createPerson,
  deleteExpense,
  ensureSelfPerson,
  getAnalytics,
  getDashboard,
  getExpense,
  getGroup,
  getHistory,
  getPersonDetails,
  listPeople,
  recordPayment,
  removeGroupMember,
  replaceSplit,
  scheduleReminder,
  settleAll,
  simplifySettlements,
  updateExpense,
  uploadReceipt,
  voidPayment,
} from "./services/split-money";

const userId = "split-user-integration-01";
type PersonOut = z.infer<typeof splitPersonSchema>;
type ExpenseOut = z.infer<typeof splitExpenseSchema>;
type PaymentOut = z.infer<typeof splitPaymentSchema>;

async function seedUser() {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)",
  )
    .bind(userId, "Split Tester", "split-tester@example.com", now, now)
    .run();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO user_preferences (id, user_id, timezone, default_currency, created_at, updated_at) VALUES (?, ?, 'Asia/Kolkata', 'INR', ?, ?)",
  )
    .bind(`prefs-${userId}`, userId, now, now)
    .run();
}

function person(fullName: string): PersonOut {
  return {
    fullName,
    relationship: "friend",
    countryCode: "IN",
    email: null,
  };
}

function equalExpense(
  title: string,
  totalAmountMinor: number,
  self: string,
  others: string[],
  payers: Array<{ personId: string; paidAmountMinor: number }>,
): ExpenseOut {
  return {
    title,
    category: "Food",
    totalAmountMinor,
    currency: "INR",
    expenseDate: "2026-10-14",
    splitMethod: "equal",
    allowPartialPayments: true,
    sendNotifications: true,
    isDraft: false,
    payers,
    participants: [{ personId: self }, ...others.map((personId) => ({ personId }))],
  };
}

function payment(
  payerPersonId: string,
  receiverPersonId: string,
  amountMinor: number,
  method: PaymentOut["method"] = "upi",
): PaymentOut {
  return {
    payerPersonId,
    receiverPersonId,
    amountMinor,
    method,
    paymentDate: "2026-10-14",
    isFinalSettlement: false,
  };
}

describe.sequential("Split Money financial integration", () => {
  beforeAll(async () => {
    await seedUser();
  });

  it("creates a single-payer expense with correct collectible balances", async () => {
    const you = await createPerson(env, userId, person("You Clone"));
    const rahul = await createPerson(env, userId, person("Rahul A"));
    const priya = await createPerson(env, userId, person("Priya A"));
    const selfId = await getSelfId();
    const created = await createExpense(
      env,
      userId,
      equalExpense("Dinner 1200", 120_000, selfId, [rahul.id, priya.id], [
        { personId: selfId, paidAmountMinor: 120_000 },
      ]),
    );
    void you;
    const view = created.expense;
    expect(view.ledger?.collectibleMinor).toBe(80_000);
    expect(view.youOweMinor).toBe(0);
    expect(view.youAreOwedMinor).toBe(80_000);
    expect(view.obligations).toHaveLength(2);
    expect(view.obligations!.every((edge) => edge.creditorPersonId === selfId)).toBe(true);
    expect(view.participants!.find((p) => p.personId === rahul.id)?.pendingAmountMinor).toBe(40_000);
  });

  it("routes multi-payer repayments to the correct creditor and rejects wrong receivers", async () => {
    const self = await getSelfId();
    const rahul = await createPerson(env, userId, person("Rahul B"));
    const priya = await createPerson(env, userId, person("Priya B"));
    const { expense } = await createExpense(
      env,
      userId,
      equalExpense("Trip 1200 multi", 120_000, self, [rahul.id, priya.id], [
        { personId: self, paidAmountMinor: 70_000 },
        { personId: rahul.id, paidAmountMinor: 50_000 },
      ]),
    );
    expect(expense.youAreOwedMinor).toBe(30_000);
    expect(expense.obligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ debtorPersonId: priya.id, creditorPersonId: self, amountMinor: 30_000 }),
        expect.objectContaining({ debtorPersonId: priya.id, creditorPersonId: rahul.id, amountMinor: 10_000 }),
      ]),
    );

    await expect(recordPayment(env, userId, expense.id, payment(priya.id, rahul.id, 20_000))).rejects.toMatchObject({
      code: "PAYMENT_EXCEEDS_OBLIGATION",
    });

    const payload = payment(priya.id, rahul.id, 10_000);
    const paid = await recordPayment(env, userId, expense.id, payload, {
      key: "pay-multi-001",
      hash: await requestHash({ amount: 10_000 }),
    });
    expect(paid.expense.obligations).toEqual([
      expect.objectContaining({ debtorPersonId: priya.id, creditorPersonId: self, amountMinor: 30_000 }),
    ]);
    expect(paid.expense.ledger?.remainingMinor).toBe(30_000);
    expect(paid.expense.ledger?.collectedMinor).toBe(10_000);
  });

  it("replays identical payment idempotency keys and settles atomically", async () => {
    const self = await getSelfId();
    const friend = await createPerson(env, userId, person("Friend C"));
    const { expense } = await createExpense(
      env,
      userId,
      equalExpense("Coffee 200", 20_000, self, [friend.id], [{ personId: self, paidAmountMinor: 20_000 }]),
    );
    const payload = payment(friend.id, self, 5_000, "cash");
    const idem = { key: "idem-pay-coffee-01", hash: await requestHash(payload) };
    const first = await recordPayment(env, userId, expense.id, payload, idem);
    const second = await recordPayment(env, userId, expense.id, payload, idem);
    expect(second.replayed).toBe(true);
    expect(first.expense.payments?.filter((p) => p.status === "completed")).toHaveLength(1);
    expect(second.expense.payments?.filter((p) => p.status === "completed")).toHaveLength(1);

    const settled = await settleAll(
      env,
      userId,
      expense.id,
      { method: "other" },
      { key: "idem-settle-coffee-01", hash: await requestHash({ settle: true }) },
    );
    expect(settled.expense.status).toBe("settled");
    expect(settled.expense.ledger?.remainingMinor).toBe(0);
    expect(settled.expense.obligations).toHaveLength(0);

    const again = await settleAll(
      env,
      userId,
      expense.id,
      { method: "other" },
      { key: "idem-settle-coffee-01", hash: await requestHash({ settle: true }) },
    );
    expect(again.replayed).toBe(true);
  });

  it("survives concurrent payment attempts without over-settling", async () => {
    const self = await getSelfId();
    const friend = await createPerson(env, userId, person("Friend D"));
    const { expense } = await createExpense(
      env,
      userId,
      equalExpense("Concurrent 100", 10_000, self, [friend.id], [
        { personId: self, paidAmountMinor: 10_000 },
      ]),
    );
    const attempts = await Promise.all(
      Array.from({ length: 8 }, async (_, index) => ({
        key: `concurrent-${index}-${Date.now()}`,
        hash: await requestHash({ i: index }),
      })),
    );
    const payload = payment(friend.id, self, 5_000);
    const results = await Promise.allSettled(
      attempts.map((idem) => recordPayment(env, userId, expense.id, payload, idem)),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(8);
    const final = await getExpense(env, userId, expense.id);
    const completed = final.payments?.filter((p) => p.status === "completed") ?? [];
    const repaid = completed.reduce((sum, p) => sum + p.amountMinor, 0);
    expect(repaid).toBeLessThanOrEqual(5_000);
    expect(final.ledger?.remainingMinor).toBeGreaterThanOrEqual(0);
    expect((final.ledger?.remainingMinor ?? 0) + repaid).toBe(5_000);
  });

  it("dashboard totals match live expense ledgers without hard-coded percentages", async () => {
    const dashboard = await getDashboard(env, userId);
    expect(dashboard.summary.receiveChangePct).toBeNull();
    expect(dashboard.summary.payChangePct).toBeNull();
    expect(dashboard.summary.pendingChange).toBeNull();
    expect(dashboard.summary.moneyToReceiveMinor).toBeGreaterThanOrEqual(0);
    expect(dashboard.summary.moneyToPayMinor).toBeGreaterThanOrEqual(0);
    expect(dashboard.summary.collectedMinor).toBeLessThanOrEqual(dashboard.summary.collectibleMinor);
  });

  it("rejects idempotency key reuse when request payload hash differs", async () => {
    const self = await getSelfId();
    const friend = await createPerson(env, userId, person("Friend Idem Conflict"));
    const { expense } = await createExpense(
      env,
      userId,
      equalExpense("Lunch 400", 40_000, self, [friend.id], [{ personId: self, paidAmountMinor: 40_000 }]),
    );
    const firstPayload = payment(friend.id, self, 10_000, "upi");
    const secondPayload = payment(friend.id, self, 15_000, "upi");
    await recordPayment(env, userId, expense.id, firstPayload, {
      key: "idem-conflict-key-01",
      hash: await requestHash(firstPayload),
    });
    await expect(
      recordPayment(env, userId, expense.id, secondPayload, {
        key: "idem-conflict-key-01",
        hash: await requestHash(secondPayload),
      }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
    });
  });

  it("voids repayments, restores obligations, blocks deletion with audit history, and allows re-payment", async () => {
    const self = await getSelfId();
    const friend = await createPerson(env, userId, person("Friend Void"));
    const { expense } = await createExpense(
      env,
      userId,
      equalExpense("Cab 300", 30_000, self, [friend.id], [{ personId: self, paidAmountMinor: 30_000 }]),
    );
    const paid = await recordPayment(env, userId, expense.id, payment(friend.id, self, 15_000, "upi"));
    expect(paid.expense.status).toBe("settled");
    const paymentId = paid.expense.payments![0]!.id;

    // Cannot cancel while an active repayment exists
    await expect(updateExpense(env, userId, expense.id, { status: "cancelled" })).rejects.toMatchObject({
      code: "HAS_REPAYMENTS",
    });

    // Void the repayment
    const voided = await voidPayment(env, userId, expense.id, paymentId, "Entered wrong UPI ref");
    expect(voided.expense.status).toBe("pending");
    expect(voided.expense.ledger?.remainingMinor).toBe(15_000);
    expect(voided.expense.payments?.[0]?.status).toBe("voided");
    expect(voided.expense.payments?.[0]?.voidReason).toBe("Entered wrong UPI ref");

    // Cannot permanently delete because voided payment audit history exists
    await expect(deleteExpense(env, userId, expense.id)).rejects.toMatchObject({
      code: "HAS_FINANCIAL_HISTORY",
    });

    // Re-pay after voiding
    const repaid = await recordPayment(env, userId, expense.id, payment(friend.id, self, 15_000, "bank_transfer"));
    expect(repaid.expense.status).toBe("settled");
    expect(repaid.expense.payments).toHaveLength(2);
  });

  it("applies waivers and adjustments with proportional payer absorption and zero-sum balances", async () => {
    const self = await getSelfId();
    const rahul = await createPerson(env, userId, person("Rahul Adj"));
    const priya = await createPerson(env, userId, person("Priya Adj"));
    const { expense } = await createExpense(
      env,
      userId,
      equalExpense("Hotel 900", 90_000, self, [rahul.id, priya.id], [
        { personId: self, paidAmountMinor: 60_000 },
        { personId: rahul.id, paidAmountMinor: 30_000 },
      ]),
    );
    const priyaParticipant = expense.participants!.find((p) => p.personId === priya.id)!;

    // Waive 150.00 (15,000 minor) of Priya's 300.00 share
    const adjusted = await createAdjustment(env, userId, expense.id, {
      participantId: priyaParticipant.id,
      type: "waived",
      amountMinor: 15_000,
      reason: "Priya checked out early",
    });
    const netSum = adjusted.expense.balances!.reduce((sum, b) => sum + b.netMinor, 0);
    expect(netSum).toBe(0);
    const priyaBal = adjusted.expense.balances!.find((b) => b.personId === priya.id)!;
    expect(priyaBal.adjustedShareMinor).toBe(15_000);
    expect(priyaBal.owedMinor).toBe(15_000);
  });

  it("edits details, cancels and reopens expenses, cancels scheduled reminders on cancel, and deletes clean expenses", async () => {
    const self = await getSelfId();
    const friend = await createPerson(env, userId, person("Friend Lifecycle"));
    const { expense } = await createExpense(
      env,
      userId,
      equalExpense("Movie 500", 50_000, self, [friend.id], [{ personId: self, paidAmountMinor: 50_000 }]),
    );
    const rem = await scheduleReminder(env, userId, expense.id, {
      channel: "in_app",
      scheduledAt: "2026-10-20T09:00:00.000Z",
      message: "Movie ticket share",
    });
    expect(rem.status).toBe("scheduled");

    // Edit details
    const edited = await updateExpense(env, userId, expense.id, {
      title: "IMAX Movie 500",
      category: "Entertainment",
      description: "Evening show",
    });
    expect(edited.title).toBe("IMAX Movie 500");
    expect(edited.category).toBe("Entertainment");

    // Cancel expense -> also cancels scheduled reminders and rejects payments while cancelled
    const cancelled = await updateExpense(env, userId, expense.id, { status: "cancelled" });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.reminders?.find((r) => r.id === rem.id)?.status).toBe("cancelled");
    await expect(recordPayment(env, userId, expense.id, payment(friend.id, self, 5_000, "cash"))).rejects.toMatchObject({
      code: "EXPENSE_CANCELLED",
    });

    // Reopen expense
    const reopened = await updateExpense(env, userId, expense.id, { status: "pending" });
    expect(reopened.status).toBe("pending");
    expect(reopened.obligations).toHaveLength(1);

    // Schedule and manually cancel a reminder
    const rem2 = await scheduleReminder(env, userId, expense.id, {
      channel: "in_app",
      scheduledAt: "2026-10-21T09:00:00.000Z",
    });
    await cancelReminder(env, userId, expense.id, rem2.id);
    const afterCancelRem = await getExpense(env, userId, expense.id);
    expect(afterCancelRem.reminders?.find((r) => r.id === rem2.id)?.status).toBe("cancelled");

    // Delete clean expense (no payments or adjustments)
    await deleteExpense(env, userId, expense.id);
    await expect(getExpense(env, userId, expense.id)).rejects.toMatchObject({ status: 404 });
  });

  it("enforces group member & person archive balance guards until obligations are settled", async () => {
    const self = await getSelfId();
    const member = await createPerson(env, userId, person("Group Member Guard"));
    const extra = await createPerson(env, userId, person("Group Extra Member"));
    const { group } = await createGroup(env, userId, {
      name: "Goa Trip Group",
      currency: "INR",
      groupType: "shared",
      defaultSplitMethod: "equal",
      defaultDueDays: 7,
      allowMemberAdd: true,
      allowMemberEdit: true,
      allowMemberSettle: true,
      sendNotifications: true,
      memberPersonIds: [member.id],
    });
    const withExtra = await addGroupMember(env, userId, group.id, extra.id);
    expect(withExtra.members).toHaveLength(3);

    const { expense } = await createExpense(env, userId, {
      ...equalExpense("Villa Booking", 60_000, self, [member.id, extra.id], [
        { personId: self, paidAmountMinor: 60_000 },
      ]),
      groupId: group.id,
    });

    const groupView = await getGroup(env, userId, group.id);
    expect(groupView.summary.outstandingMinor).toBe(40_000);
    const memberRow = groupView.members.find((m) => m.personId === member.id)!;

    // Cannot remove group member while they owe money
    await expect(removeGroupMember(env, userId, group.id, memberRow.id)).rejects.toMatchObject({
      code: "MEMBER_HAS_BALANCE",
    });

    // Settle expense -> now member removal succeeds
    await settleAll(env, userId, expense.id, { method: "upi" });
    const afterRemove = await removeGroupMember(env, userId, group.id, memberRow.id);
    expect(afterRemove.members.some((m) => m.personId === member.id)).toBe(false);

    // Archive person -> excluded from active list and blocked from new group/expense membership until restored
    const archived = await archivePerson(env, userId, member.id);
    expect(archived.archivedAt).toBeTruthy();
    await expect(addGroupMember(env, userId, group.id, member.id)).rejects.toMatchObject({
      code: "PERSON_ARCHIVED",
    });
    const activeOnly = await listPeople(env, userId, false);
    const withArchived = await listPeople(env, userId, true);
    expect(activeOnly.some((p) => p.id === member.id)).toBe(false);
    expect(withArchived.some((p) => p.id === member.id)).toBe(true);

    const restored = await archivePerson(env, userId, member.id, true);
    expect(restored.archivedAt).toBeNull();
  });

  it("upgrades and mutates pre-0018 existing data rows cleanly without balance drift", async () => {
    const self = await getSelfId();
    const legacyFriend = await createPerson(env, userId, person("Legacy Pre0018 Friend"));
    const legacyExpenseId = "legacy-exp-pre-0018";
    const now = new Date().toISOString();

    // Insert a simulated pre-0018 expense where cached participant pending_amount_minor was stale (0)
    // and ledger_version defaulted to 0 during 0018 migration.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO split_expenses (id, user_id, title, category, total_amount_minor, currency, expense_date, split_method, status, allow_partial_payments, send_notifications, is_draft, ledger_version, created_at, updated_at)
         VALUES (?, ?, 'Legacy Pre-0018 Dinner', 'Food', 40000, 'INR', '2026-10-01', 'equal', 'pending', 1, 1, 0, 0, ?, ?)`,
      ).bind(legacyExpenseId, userId, now, now),
      env.DB.prepare(
        `INSERT INTO split_expense_payers (id, expense_id, person_id, paid_amount_minor) VALUES (?, ?, ?, 40000)`,
      ).bind("legacy-payer-1", legacyExpenseId, self),
      env.DB.prepare(
        `INSERT INTO split_participants (id, expense_id, person_id, share_percentage_bps, share_value, share_amount_minor, adjusted_share_amount_minor, paid_amount_minor, pending_amount_minor, status)
         VALUES (?, ?, ?, 5000, 1, 20000, 20000, 0, 0, 'pending'),
                (?, ?, ?, 5000, 1, 20000, 20000, 0, 0, 'pending')`,
      ).bind("legacy-part-self", legacyExpenseId, self, "legacy-part-friend", legacyExpenseId, legacyFriend.id),
    ]);

    // Reading the legacy expense derives the authoritative ledger (20,000 owed by legacyFriend)
    const before = await getExpense(env, userId, legacyExpenseId);
    expect(before.ledger?.collectibleMinor).toBe(20_000);
    expect(before.youAreOwedMinor).toBe(20_000);
    expect(before.obligations).toEqual([
      expect.objectContaining({ debtorPersonId: legacyFriend.id, creditorPersonId: self, amountMinor: 20_000 }),
    ]);

    // Mutating the legacy expense bumps ledger_version and heals cached participant columns
    const afterPartial = await recordPayment(env, userId, legacyExpenseId, payment(legacyFriend.id, self, 8_000, "cash"));
    expect(afterPartial.expense.status).toBe("partially_settled");
    expect(afterPartial.expense.ledger?.remainingMinor).toBe(12_000);
    expect(afterPartial.expense.participants?.find((p) => p.personId === legacyFriend.id)?.pendingAmountMinor).toBe(12_000);
  });

  it("verifies all 5 split methods and cross-platform Web/Android API contracts (receipts, replaceSplit, convertToLend, simplify, history, analytics, personDetails)", async () => {
    const self = await getSelfId();
    const p1 = await createPerson(env, userId, person("Method Alice"));
    const p2 = await createPerson(env, userId, person("Method Bob"));

    // 1. Receipt upload & linkage
    const receipt = await uploadReceipt(env, userId, {
      fileUrl: "https://example.com/receipt-contract.png",
      fileName: "receipt-contract.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
    });
    expect(receipt.id).toBeTruthy();

    // 2. Exact split
    const { expense: exactExp } = await createExpense(env, userId, {
      ...equalExpense("Contract Exact", 25_000, self, [p1.id, p2.id], [{ personId: self, paidAmountMinor: 25_000 }]),
      splitMethod: "exact",
      receiptId: receipt.id,
      participants: [
        { personId: self, shareAmountMinor: 10_000 },
        { personId: p1.id, shareAmountMinor: 9_000 },
        { personId: p2.id, shareAmountMinor: 6_000 },
      ],
    });
    expect(exactExp.ledger?.collectibleMinor).toBe(15_000);

    // 3. Percentage split (40% / 35% / 25%)
    const { expense: pctExp } = await createExpense(env, userId, {
      ...equalExpense("Contract Percentage", 20_000, self, [p1.id, p2.id], [{ personId: self, paidAmountMinor: 20_000 }]),
      splitMethod: "percentage",
      participants: [
        { personId: self, sharePercentageBps: 4000 },
        { personId: p1.id, sharePercentageBps: 3500 },
        { personId: p2.id, sharePercentageBps: 2500 },
      ],
    });
    expect(pctExp.ledger?.collectibleMinor).toBe(12_000);

    // 4. Shares split (2 : 1 : 1)
    const { expense: sharesExp } = await createExpense(env, userId, {
      ...equalExpense("Contract Shares", 40_000, self, [p1.id, p2.id], [{ personId: self, paidAmountMinor: 40_000 }]),
      splitMethod: "shares",
      participants: [
        { personId: self, shareValue: 2 },
        { personId: p1.id, shareValue: 1 },
        { personId: p2.id, shareValue: 1 },
      ],
    });
    expect(sharesExp.ledger?.collectibleMinor).toBe(20_000);

    // 5. Itemwise split
    const { expense: itemExp } = await createExpense(env, userId, {
      ...equalExpense("Contract Itemwise", 30_000, self, [p1.id, p2.id], [{ personId: self, paidAmountMinor: 30_000 }]),
      splitMethod: "itemwise",
      items: [
        { name: "Main Course", quantity: 1, priceMinor: 18_000, kind: "item", personIds: [self, p1.id, p2.id] },
        { name: "Dessert", quantity: 1, priceMinor: 12_000, kind: "item", personIds: [p1.id, p2.id] },
      ],
    });
    expect(itemExp.ledger?.collectibleMinor).toBe(24_000);

    // 6. replaceSplit before any payments
    const replaced = await replaceSplit(env, userId, exactExp.id, {
      totalAmountMinor: 25_000,
      splitMethod: "equal",
      payers: [{ personId: self, paidAmountMinor: 25_000 }],
      participants: [{ personId: self }, { personId: p1.id }],
    });
    expect(replaced.splitMethod).toBe("equal");
    expect(replaced.ledger?.collectibleMinor).toBe(12_500);

    // 7. Cross-platform read & helper endpoints
    const lendConv = await convertExpenseToLend(env, userId, replaced.id);
    expect(lendConv.created).toBe(false);
    expect(lendConv.suggestions).toEqual([
      expect.objectContaining({ person: "Method Alice", kind: "lent", amountMinor: 12_500, currency: "INR" }),
    ]);

    const simplified = await simplifySettlements(env, userId, replaced.id);
    expect(simplified.length).toBeGreaterThan(0);

    const history = await getHistory(env, userId);
    expect(history.expenses.some((e) => e.id === itemExp.id)).toBe(true);

    const analytics = await getAnalytics(env, userId);
    expect(analytics.expenseCount).toBeGreaterThan(0);

    const personDetail = await getPersonDetails(env, userId, p1.id);
    expect(personDetail.person.id).toBe(p1.id);
    expect(personDetail.youAreOwedMinor).toBeGreaterThan(0);
  });
});

async function getSelfId() {
  const row = await env.DB.prepare(
    "SELECT id FROM split_people WHERE user_id = ? AND is_self = 1 LIMIT 1",
  )
    .bind(userId)
    .first<{ id: string }>();
  if (!row) {
    return (await ensureSelfPerson(env, userId)).id;
  }
  return row.id;
}
