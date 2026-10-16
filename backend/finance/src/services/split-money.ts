import {
  createDatabase,
  splitActivities,
  splitAdjustments,
  splitExpensePayers,
  splitExpenses,
  splitGroupMembers,
  splitGroups,
  splitItemParticipants,
  splitItems,
  splitParticipants,
  splitPayments,
  splitPeople,
  splitReceipts,
  splitReminders,
  userPreferences,
} from "@hisaab/database";
import {
  checkRepayment,
  computeParticipantShares,
  computeSplitLedger,
  createMockReceiptParser,
  ledgerExpenseStatus,
  simplifyDebts,
  type LedgerObligation,
  type SplitLedger,
  type splitAdjustmentSchema,
  type splitExpensePatchSchema,
  type splitExpenseSchema,
  type splitGroupPatchSchema,
  type splitGroupSchema,
  type splitPaymentSchema,
  type splitPersonPatchSchema,
  type splitPersonSchema,
  type splitReceiptUploadSchema,
} from "@hisaab/validation";
import { AppError, fileUrl, newId, notFound, now, requireOwnedFile, zonedDateKey } from "@hisaab/worker-lib";
import { and, asc, desc, eq, isNull, type SQL } from "drizzle-orm";
import type { z } from "zod";
import {
  idempotencyInsert,
  idempotencyPurge,
  isIdempotencyConflict,
  readIdempotent,
} from "../idempotency";

type PersonInput = z.infer<typeof splitPersonSchema>;
type PersonPatch = z.infer<typeof splitPersonPatchSchema>;
type GroupInput = z.infer<typeof splitGroupSchema>;
type GroupPatch = z.infer<typeof splitGroupPatchSchema>;
type ExpenseInput = z.infer<typeof splitExpenseSchema>;
type ExpensePatch = z.infer<typeof splitExpensePatchSchema>;
type PaymentInput = z.infer<typeof splitPaymentSchema>;
type AdjustmentInput = z.infer<typeof splitAdjustmentSchema>;
type ReceiptInput = z.infer<typeof splitReceiptUploadSchema>;

type PersonRow = typeof splitPeople.$inferSelect;
type GroupRow = typeof splitGroups.$inferSelect;
type ExpenseRow = typeof splitExpenses.$inferSelect;
type PayerRow = typeof splitExpensePayers.$inferSelect;
type ParticipantRow = typeof splitParticipants.$inferSelect;
type PaymentRow = typeof splitPayments.$inferSelect;
type AdjustmentRow = typeof splitAdjustments.$inferSelect;

/** Idempotency context for a mutation: client key plus a fingerprint of the request. */
export type Idem = { key: string | null; hash: string | null };
const NO_IDEM: Idem = { key: null, hash: null };

type ExpenseState = {
  expense: ExpenseRow;
  payers: PayerRow[];
  participants: ParticipantRow[];
  payments: PaymentRow[];
  adjustments: AdjustmentRow[];
};

type Guard = { sql: string; params: unknown[] };

const ACTIVE_STATUSES_EXCLUDED = new Set(["cancelled"]);
const MAX_LEDGER_RETRIES = 5;

function defined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

const snake = (key: string) => key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
const sqlValue = (value: unknown) =>
  typeof value === "boolean" ? (value ? 1 : 0) : value === undefined ? null : value;

function insertRow(env: Env, table: string, row: Record<string, unknown>, guard?: Guard) {
  const keys = Object.keys(row);
  const columns = keys.map(snake).join(", ");
  const marks = keys.map(() => "?").join(", ");
  const values = keys.map((key) => sqlValue(row[key]));
  if (!guard) {
    return env.DB.prepare(`INSERT INTO ${table} (${columns}) VALUES (${marks})`).bind(...values);
  }
  return env.DB.prepare(`INSERT INTO ${table} (${columns}) SELECT ${marks} WHERE ${guard.sql}`).bind(
    ...values,
    ...guard.params,
  );
}

function updateRows(
  env: Env,
  table: string,
  set: Record<string, unknown>,
  where: Record<string, unknown>,
  guard?: Guard,
) {
  const setKeys = Object.keys(set);
  const whereKeys = Object.keys(where);
  const clause = [
    ...whereKeys.map((key) => `${snake(key)} = ?`),
    ...(guard ? [guard.sql] : []),
  ].join(" AND ");
  return env.DB.prepare(
    `UPDATE ${table} SET ${setKeys.map((key) => `${snake(key)} = ?`).join(", ")} WHERE ${clause}`,
  ).bind(
    ...setKeys.map((key) => sqlValue(set[key])),
    ...whereKeys.map((key) => sqlValue(where[key])),
    ...(guard?.params ?? []),
  );
}

function deleteRows(env: Env, table: string, where: Record<string, unknown>, guard?: Guard) {
  const keys = Object.keys(where);
  const clause = [...keys.map((key) => `${snake(key)} = ?`), ...(guard ? [guard.sql] : [])].join(" AND ");
  return env.DB.prepare(`DELETE FROM ${table} WHERE ${clause}`).bind(
    ...keys.map((key) => sqlValue(where[key])),
    ...(guard?.params ?? []),
  );
}

const versionGuard = (expenseId: string, version: number): Guard => ({
  sql: "EXISTS (SELECT 1 FROM split_expenses WHERE id = ? AND ledger_version = ?)",
  params: [expenseId, version],
});
const activityGuard = (activityId: string): Guard => ({
  sql: "EXISTS (SELECT 1 FROM split_activities WHERE id = ?)",
  params: [activityId],
});

function activityRow(input: {
  userId: string;
  expenseId?: string | null;
  groupId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    id: newId(),
    userId: input.userId,
    expenseId: input.expenseId ?? null,
    groupId: input.groupId ?? null,
    actorPersonId: null,
    action: input.action,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    createdAt: now(),
  };
}

async function userToday(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  const prefs = await db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) });
  return zonedDateKey(new Date(), prefs?.timezone ?? "UTC");
}

async function idempotentReplay<T>(env: Env, userId: string, scope: string, idem: Idem) {
  return readIdempotent<T>(env, userId, scope, idem.key, idem.hash);
}

/** Runs create-style batches atomically; a concurrent duplicate key replays the stored response. */
async function commitCreate<T>(
  env: Env,
  userId: string,
  scope: string,
  idem: Idem,
  statements: D1PreparedStatement[],
  response: T,
): Promise<{ response: T; replayed: boolean }> {
  const batch = [...statements];
  if (idem.key) {
    batch.push(idempotencyInsert(env, userId, scope, idem.key, response, idem.hash));
    batch.push(idempotencyPurge(env, userId));
  }
  try {
    await env.DB.batch(batch);
  } catch (error) {
    if (idem.key && isIdempotencyConflict(error)) {
      const previous = await idempotentReplay<T>(env, userId, scope, idem);
      if (previous) return { response: previous, replayed: true };
    }
    throw error;
  }
  return { response, replayed: false };
}

// ---------------------------------------------------------------------------
// People

export async function ensureSelfPerson(env: Env, userId: string, name = "You") {
  const db = createDatabase(env.DB);
  const find = () =>
    db.query.splitPeople.findFirst({
      where: and(eq(splitPeople.userId, userId), eq(splitPeople.isSelf, true)),
      orderBy: asc(splitPeople.createdAt),
    });
  const existing = await find();
  if (existing) return existing;
  const timestamp = now();
  await env.DB.prepare(
    "INSERT INTO split_people (id, user_id, full_name, country_code, relationship, is_self, created_at, updated_at) SELECT ?, ?, ?, 'IN', 'other', 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM split_people WHERE user_id = ? AND is_self = 1)",
  )
    .bind(newId(), userId, name, timestamp, timestamp, userId)
    .run();
  const created = await find();
  if (!created) throw new AppError(500, "SELF_PERSON_MISSING", "Could not prepare your Split Money profile.");
  return created;
}

export async function listPeople(env: Env, userId: string, includeArchived = false) {
  await ensureSelfPerson(env, userId);
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(splitPeople)
    .where(
      includeArchived
        ? eq(splitPeople.userId, userId)
        : and(eq(splitPeople.userId, userId), isNull(splitPeople.archivedAt)),
    )
    .orderBy(desc(splitPeople.isSelf), asc(splitPeople.fullName));
}

export async function getPerson(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.splitPeople.findFirst({
    where: and(eq(splitPeople.id, id), eq(splitPeople.userId, userId)),
  });
  if (!row) throw notFound("Person");
  return row;
}

async function requireActivePerson(env: Env, userId: string, id: string) {
  const person = await getPerson(env, userId, id);
  if (person.archivedAt) {
    throw new AppError(400, "PERSON_ARCHIVED", `${person.fullName} was removed. Restore them before adding to new splits.`);
  }
  return person;
}

const normalise = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export async function createPerson(env: Env, userId: string, input: PersonInput, idem: Idem = NO_IDEM) {
  const scope = "split-person";
  const previous = await idempotentReplay<PersonRow & { existing?: boolean }>(env, userId, scope, idem);
  if (previous) return { ...(await getPerson(env, userId, previous.id)), existing: true };
  const people = await listPeople(env, userId);
  const duplicate = people.find(
    (person) =>
      !person.isSelf &&
      normalise(person.fullName) === normalise(input.fullName) &&
      normalise(person.phone) === normalise(input.phone) &&
      normalise(person.email) === normalise(input.email),
  );
  if (duplicate) return { ...duplicate, existing: true };
  const timestamp = now();
  const value = {
    id: newId(),
    userId,
    fullName: input.fullName,
    phone: input.phone ?? null,
    countryCode: input.countryCode ?? "IN",
    email: input.email ?? null,
    relationship: input.relationship ?? "friend",
    photoUrl: input.photoUrl ?? null,
    isSelf: false,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const result = await commitCreate(env, userId, scope, idem, [insertRow(env, "split_people", value)], value);
  return { ...result.response, existing: result.replayed };
}

export async function updatePerson(env: Env, userId: string, id: string, input: PersonPatch) {
  const existing = await getPerson(env, userId, id);
  // `isSelf` is immutable after creation; strip it before writing.
  const rest: Omit<PersonPatch, "isSelf"> & { isSelf?: boolean } = { ...input };
  delete rest.isSelf;
  const db = createDatabase(env.DB);
  await db
    .update(splitPeople)
    .set({ ...defined(rest), updatedAt: now() })
    .where(and(eq(splitPeople.id, existing.id), eq(splitPeople.userId, userId)));
  return getPerson(env, userId, id);
}

/** People are archived, never hard-deleted, so historical splits keep their names. */
export async function archivePerson(env: Env, userId: string, id: string, restore = false) {
  const person = await getPerson(env, userId, id);
  if (person.isSelf) throw new AppError(400, "CANNOT_ARCHIVE_SELF", "You cannot remove yourself.");
  const db = createDatabase(env.DB);
  await db
    .update(splitPeople)
    .set({ archivedAt: restore ? null : now(), updatedAt: now() })
    .where(and(eq(splitPeople.id, id), eq(splitPeople.userId, userId)));
  return getPerson(env, userId, id);
}

// ---------------------------------------------------------------------------
// Loading and ledger views

async function loadStates(env: Env, userId: string, filter: { expenseId?: string; groupId?: string } = {}) {
  const db = createDatabase(env.DB);
  const conditions: SQL[] = [eq(splitExpenses.userId, userId)];
  if (filter.expenseId) conditions.push(eq(splitExpenses.id, filter.expenseId));
  if (filter.groupId) conditions.push(eq(splitExpenses.groupId, filter.groupId));
  const where = and(...conditions);
  const [expenses, payers, participants, payments, adjustments] = await Promise.all([
    db
      .select()
      .from(splitExpenses)
      .where(where)
      .orderBy(desc(splitExpenses.expenseDate), desc(splitExpenses.createdAt)),
    db
      .select({ row: splitExpensePayers })
      .from(splitExpensePayers)
      .innerJoin(splitExpenses, eq(splitExpensePayers.expenseId, splitExpenses.id))
      .where(where),
    db
      .select({ row: splitParticipants })
      .from(splitParticipants)
      .innerJoin(splitExpenses, eq(splitParticipants.expenseId, splitExpenses.id))
      .where(where),
    db
      .select({ row: splitPayments })
      .from(splitPayments)
      .innerJoin(splitExpenses, eq(splitPayments.expenseId, splitExpenses.id))
      .where(where),
    db
      .select({ row: splitAdjustments })
      .from(splitAdjustments)
      .innerJoin(splitExpenses, eq(splitAdjustments.expenseId, splitExpenses.id))
      .where(where),
  ]);
  const group = <T extends { expenseId: string }>(rows: Array<{ row: T }>) => {
    const map = new Map<string, T[]>();
    for (const { row } of rows) map.set(row.expenseId, [...(map.get(row.expenseId) ?? []), row]);
    return map;
  };
  const payerMap = group(payers);
  const participantMap = group(participants);
  const paymentMap = group(payments);
  const adjustmentMap = group(adjustments);
  return expenses.map(
    (expense): ExpenseState => ({
      expense,
      payers: payerMap.get(expense.id) ?? [],
      participants: participantMap.get(expense.id) ?? [],
      payments: (paymentMap.get(expense.id) ?? []).sort((a, b) =>
        a.paymentDate === b.paymentDate ? b.createdAt.localeCompare(a.createdAt) : b.paymentDate.localeCompare(a.paymentDate),
      ),
      adjustments: adjustmentMap.get(expense.id) ?? [],
    }),
  );
}

async function loadState(env: Env, userId: string, expenseId: string) {
  const [state] = await loadStates(env, userId, { expenseId });
  if (!state) throw notFound("Expense");
  return state;
}

function ledgerFor(state: ExpenseState): SplitLedger {
  return computeSplitLedger({
    totalAmountMinor: state.expense.totalAmountMinor,
    payers: state.payers.map((payer) => ({ personId: payer.personId, paidAmountMinor: payer.paidAmountMinor })),
    participants: state.participants.map((participant) => ({
      id: participant.id,
      personId: participant.personId,
      shareAmountMinor: participant.shareAmountMinor,
    })),
    adjustments: state.adjustments.map((adjustment) => ({
      participantId: adjustment.participantId,
      amountMinor: adjustment.amountMinor,
    })),
    payments: state.payments.map((payment) => ({
      id: payment.id,
      payerPersonId: payment.payerPersonId,
      receiverPersonId: payment.receiverPersonId,
      amountMinor: payment.amountMinor,
      status: payment.status,
      paymentDate: payment.paymentDate,
    })),
  });
}

const isCancelled = (expense: ExpenseRow) => expense.status === "cancelled";
const isActive = (expense: ExpenseRow) => !expense.isDraft && !ACTIVE_STATUSES_EXCLUDED.has(expense.status);

function statusFor(state: ExpenseState, ledger: SplitLedger, today: string) {
  return ledgerExpenseStatus({
    summary: ledger.summary,
    isDraft: state.expense.isDraft,
    cancelled: isCancelled(state.expense),
    dueDate: state.expense.dueDate,
    today,
  });
}

type ViewContext = {
  people: Map<string, PersonRow>;
  groups: Map<string, GroupRow>;
  selfId: string;
  today: string;
};

async function viewContext(env: Env, userId: string): Promise<ViewContext> {
  const self = await ensureSelfPerson(env, userId);
  const db = createDatabase(env.DB);
  const [people, groups, today] = await Promise.all([
    db.select().from(splitPeople).where(eq(splitPeople.userId, userId)),
    db.select().from(splitGroups).where(eq(splitGroups.ownerId, userId)),
    userToday(env, userId),
  ]);
  return {
    people: new Map(people.map((person) => [person.id, person])),
    groups: new Map(groups.map((group) => [group.id, group])),
    selfId: self.id,
    today,
  };
}

function personSummary(people: Map<string, PersonRow>, id: string) {
  const person = people.get(id);
  return person
    ? { id: person.id, fullName: person.fullName, isSelf: person.isSelf, archivedAt: person.archivedAt, photoUrl: person.photoUrl }
    : null;
}

function obligationView(people: Map<string, PersonRow>, edge: LedgerObligation) {
  return {
    ...edge,
    debtor: personSummary(people, edge.debtorPersonId),
    creditor: personSummary(people, edge.creditorPersonId),
  };
}

function expenseView(state: ExpenseState, ctx: ViewContext) {
  const ledger = ledgerFor(state);
  const balanceMap = new Map(ledger.balances.map((row) => [row.personId, row]));
  const self = balanceMap.get(ctx.selfId);
  const { summary } = ledger;
  const status = statusFor(state, ledger, ctx.today);
  return {
    ...state.expense,
    status,
    group: state.expense.groupId ? (ctx.groups.get(state.expense.groupId) ?? null) : null,
    participants: state.participants.map((participant) => {
      const row = balanceMap.get(participant.personId)!;
      return {
        ...participant,
        person: ctx.people.get(participant.personId) ?? null,
        adjustedShareAmountMinor: row.adjustedShareMinor,
        absorbedMinor: row.absorbedMinor,
        upfrontPaidMinor: row.upfrontPaidMinor,
        /** Repayments this participant has sent. Upfront bill payments are separate. */
        paidAmountMinor: row.repaymentSentMinor,
        repaymentReceivedMinor: row.repaymentReceivedMinor,
        /** What this participant still owes. */
        pendingAmountMinor: row.owedMinor,
        receivableMinor: row.receivableMinor,
        originalDebtMinor: row.originalDebtMinor,
        initialNetMinor: row.initialNetMinor,
        netMinor: row.netMinor,
        overpaidMinor: row.overpaidMinor,
        lastPaymentDate: row.lastPaymentDate,
        status: row.status,
      };
    }),
    payers: state.payers.map((payer) => ({ ...payer, person: ctx.people.get(payer.personId) ?? null })),
    payments: state.payments.map((payment) => ({
      ...payment,
      payer: ctx.people.get(payment.payerPersonId) ?? null,
      receiver: ctx.people.get(payment.receiverPersonId) ?? null,
    })),
    adjustments: state.adjustments,
    balances: ledger.balances.map((row) => ({ ...row, person: personSummary(ctx.people, row.personId) })),
    obligations: ledger.obligations.map((edge) => obligationView(ctx.people, edge)),
    originalObligations: ledger.originalObligations.map((edge) => obligationView(ctx.people, edge)),
    ledger: summary,
    yourShareMinor: self?.adjustedShareMinor ?? 0,
    youPaidMinor: self?.upfrontPaidMinor ?? 0,
    youOweMinor: self?.owedMinor ?? 0,
    youAreOwedMinor: self?.receivableMinor ?? 0,
    collectibleMinor: summary.collectibleMinor,
    collectedMinor: summary.collectedMinor,
    pendingMinor: summary.remainingMinor,
    settledPercent: summary.settledPercent,
  };
}

export type ExpenseView = ReturnType<typeof expenseView>;

async function detailExtras(env: Env, userId: string, expenseId: string) {
  const db = createDatabase(env.DB);
  const [activities, reminders, items, receipts] = await Promise.all([
    db
      .select()
      .from(splitActivities)
      .where(and(eq(splitActivities.expenseId, expenseId), eq(splitActivities.userId, userId)))
      .orderBy(desc(splitActivities.createdAt)),
    db.select().from(splitReminders).where(eq(splitReminders.expenseId, expenseId)),
    db.select().from(splitItems).where(eq(splitItems.expenseId, expenseId)),
    db
      .select()
      .from(splitReceipts)
      .where(and(eq(splitReceipts.expenseId, expenseId), eq(splitReceipts.userId, userId))),
  ]);
  const itemParts = items.length
    ? await db
        .select({ row: splitItemParticipants })
        .from(splitItemParticipants)
        .innerJoin(splitItems, eq(splitItemParticipants.itemId, splitItems.id))
        .where(eq(splitItems.expenseId, expenseId))
    : [];
  return {
    activities,
    reminders: reminders.map((reminder) => ({
      ...reminder,
      deliveryAvailable: reminderDeliveryAvailable(reminder.channel),
    })),
    receipts,
    items: items.map((item) => ({
      ...item,
      personIds: itemParts.filter(({ row }) => row.itemId === item.id).map(({ row }) => row.personId),
    })),
  };
}

export async function getExpense(env: Env, userId: string, id: string) {
  const state = await loadState(env, userId, id);
  const [ctx, extras] = await Promise.all([viewContext(env, userId), detailExtras(env, userId, id)]);
  return { ...expenseView(state, ctx), ...extras };
}

export async function listExpenses(
  env: Env,
  userId: string,
  opts?: { status?: string; query?: string; limit?: number; offset?: number; groupId?: string },
) {
  const [states, ctx] = await Promise.all([
    loadStates(env, userId, { groupId: opts?.groupId }),
    viewContext(env, userId),
  ]);
  const query = opts?.query?.trim().toLowerCase();
  const views = states
    .map((state) => expenseView(state, ctx))
    .filter((view) => {
      if (opts?.status && opts.status !== "all" && view.status !== opts.status) return false;
      if (query && !view.title.toLowerCase().includes(query) && !view.category.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));
  return { items: views.slice(offset, offset + limit), total: views.length, offset, limit };
}

// ---------------------------------------------------------------------------
// Ledger mutations

type LedgerChange = {
  statements: (guard: Guard) => D1PreparedStatement[];
  next: ExpenseState;
  action: string;
  metadata?: Record<string, unknown>;
  /** Keep ledger_version unchanged? Never: every financial change bumps it. */
};

/**
 * Applies a financial change atomically. All statements run in one D1 batch guarded by the
 * expense's ledger_version, so concurrent requests cannot both apply against the same state.
 * A losing request re-reads, re-validates and retries; a repeated idempotency key replays.
 */
async function mutateLedger(
  env: Env,
  userId: string,
  expenseId: string,
  scope: string,
  idem: Idem,
  build: (state: ExpenseState, today: string) => LedgerChange | Promise<LedgerChange>,
) {
  for (let attempt = 0; attempt < MAX_LEDGER_RETRIES; attempt += 1) {
    const previous = await idempotentReplay<{ expenseId: string }>(env, userId, scope, idem);
    if (previous) return { replayed: true };
    const state = await loadState(env, userId, expenseId);
    const today = await userToday(env, userId);
    const change = await build(state, today);
    const version = state.expense.ledgerVersion;
    const guard = versionGuard(expenseId, version);
    const activity = activityRow({ userId, expenseId, groupId: state.expense.groupId, action: change.action, metadata: change.metadata });
    const after = activityGuard(activity.id);
    const nextLedger = ledgerFor(change.next);
    const nextStatus = statusFor(change.next, nextLedger, today);
    const balances = new Map(nextLedger.balances.map((row) => [row.personId, row]));
    const statements = change.statements(guard);
    const batch: D1PreparedStatement[] = [
      ...statements,
      insertRow(env, "split_activities", activity, guard),
      env.DB.prepare(
        "UPDATE split_expenses SET ledger_version = ledger_version + 1, status = ?, updated_at = ? WHERE id = ? AND user_id = ? AND ledger_version = ?",
      ).bind(nextStatus, now(), expenseId, userId, version),
      ...change.next.participants.map((participant) => {
        const row = balances.get(participant.personId)!;
        return updateRows(
          env,
          "split_participants",
          {
            adjustedShareAmountMinor: row.adjustedShareMinor,
            paidAmountMinor: row.repaymentSentMinor,
            pendingAmountMinor: row.owedMinor,
            status: row.status,
          },
          { id: participant.id },
          after,
        );
      }),
    ];
    if (nextStatus === "settled") {
      batch.push(
        env.DB.prepare(
          `UPDATE split_reminders SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND status = 'scheduled' AND stop_after_settlement = 1 AND ${after.sql}`,
        ).bind(now(), expenseId, ...after.params),
      );
    } else if (nextStatus === "cancelled") {
      batch.push(
        env.DB.prepare(
          `UPDATE split_reminders SET status = 'cancelled', updated_at = ? WHERE expense_id = ? AND status = 'scheduled' AND ${after.sql}`,
        ).bind(now(), expenseId, ...after.params),
      );
    }
    if (idem.key) {
      batch.push(idempotencyInsert(env, userId, scope, idem.key, { expenseId }, idem.hash, after));
      batch.push(idempotencyPurge(env, userId));
    }
    let results: D1Result[];
    try {
      results = await env.DB.batch(batch);
    } catch (error) {
      if (idem.key && isIdempotencyConflict(error)) continue;
      throw error;
    }
    const bump = results[statements.length + 1];
    if (bump?.meta.changes === 1) return { replayed: false };
  }
  throw new AppError(409, "CONCURRENT_UPDATE", "This expense was changed at the same time. Refresh and try again.");
}

function assertOpen(state: ExpenseState, action: string) {
  if (isCancelled(state.expense)) {
    throw new AppError(400, "EXPENSE_CANCELLED", `Cannot ${action} on a cancelled expense.`);
  }
  if (state.expense.isDraft) {
    throw new AppError(400, "EXPENSE_DRAFT", `Publish this draft before you ${action}.`);
  }
}

function participantIdFor(state: ExpenseState, payerPersonId: string, receiverPersonId: string) {
  return (
    state.participants.find((participant) => participant.personId === payerPersonId)?.id ??
    state.participants.find((participant) => participant.personId === receiverPersonId)?.id ??
    null
  );
}

function paymentRow(
  state: ExpenseState,
  input: {
    payerPersonId: string;
    receiverPersonId: string;
    amountMinor: number;
    method?: string;
    referenceId?: string | null;
    note?: string | null;
    proofUrl?: string | null;
    paymentDate: string;
    isFinalSettlement?: boolean;
  },
): PaymentRow {
  const participantId = participantIdFor(state, input.payerPersonId, input.receiverPersonId);
  if (!participantId) throw new AppError(400, "NOT_A_PARTICIPANT", "Neither person is part of this expense.");
  const timestamp = now();
  return {
    id: newId(),
    expenseId: state.expense.id,
    participantId,
    payerPersonId: input.payerPersonId,
    receiverPersonId: input.receiverPersonId,
    amountMinor: input.amountMinor,
    method: input.method ?? "upi",
    referenceId: input.referenceId ?? null,
    note: input.note ?? null,
    proofUrl: input.proofUrl ?? null,
    paymentDate: input.paymentDate,
    status: "completed",
    isFinalSettlement: input.isFinalSettlement ?? false,
    voidedAt: null,
    voidReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function recordPayment(
  env: Env,
  userId: string,
  expenseId: string,
  input: PaymentInput,
  idem: Idem = NO_IDEM,
) {
  const result = await mutateLedger(env, userId, expenseId, `split-pay:${expenseId}`, idem, (state) => {
    assertOpen(state, "record a repayment");
    const ledger = ledgerFor(state);
    const check = checkRepayment(ledger, input);
    if (!check.ok) throw new AppError(400, check.code, check.message);
    if (!state.expense.allowPartialPayments && check.remainingAfterMinor > 0) {
      throw new AppError(
        400,
        "PARTIAL_DISABLED",
        "Partial repayments are turned off for this expense. Record the full remaining amount.",
      );
    }
    const payment = paymentRow(state, {
      ...input,
      isFinalSettlement: input.isFinalSettlement || check.remainingAfterMinor === 0,
    });
    return {
      statements: (guard) => [insertRow(env, "split_payments", payment, guard)],
      next: { ...state, payments: [payment, ...state.payments] },
      action: "payment_recorded",
      metadata: {
        amountMinor: payment.amountMinor,
        method: payment.method,
        payerPersonId: payment.payerPersonId,
        receiverPersonId: payment.receiverPersonId,
        remainingAfterMinor: check.remainingAfterMinor,
      },
    };
  });
  return { expense: await getExpense(env, userId, expenseId), replayed: result.replayed };
}

/** Records every remaining obligation as a manual settlement in one atomic batch. */
export async function settleAll(
  env: Env,
  userId: string,
  expenseId: string,
  input: { method?: string; paymentDate?: string; note?: string | null },
  idem: Idem = NO_IDEM,
) {
  const result = await mutateLedger(env, userId, expenseId, `split-settle:${expenseId}`, idem, (state, today) => {
    assertOpen(state, "settle");
    const ledger = ledgerFor(state);
    if (ledger.obligations.length === 0) {
      throw new AppError(409, "NOTHING_TO_SETTLE", "Nothing is outstanding on this expense.");
    }
    const payments = ledger.obligations.map((edge) =>
      paymentRow(state, {
        payerPersonId: edge.debtorPersonId,
        receiverPersonId: edge.creditorPersonId,
        amountMinor: edge.amountMinor,
        method: input.method ?? "other",
        note: input.note ?? "Marked settled",
        paymentDate: input.paymentDate ?? today,
        isFinalSettlement: true,
      }),
    );
    return {
      statements: (guard) => payments.map((payment) => insertRow(env, "split_payments", payment, guard)),
      next: { ...state, payments: [...payments, ...state.payments] },
      action: "expense_settled",
      metadata: {
        count: payments.length,
        amountMinor: payments.reduce((sum, payment) => sum + payment.amountMinor, 0),
      },
    };
  });
  return { expense: await getExpense(env, userId, expenseId), replayed: result.replayed };
}

/** Reverses a recorded repayment without deleting it, keeping the history intact. */
export async function voidPayment(
  env: Env,
  userId: string,
  expenseId: string,
  paymentId: string,
  reason: string | null,
  idem: Idem = NO_IDEM,
) {
  const result = await mutateLedger(env, userId, expenseId, `split-void:${paymentId}`, idem, (state) => {
    if (isCancelled(state.expense)) {
      throw new AppError(400, "EXPENSE_CANCELLED", "Reopen the expense before changing its repayments.");
    }
    const payment = state.payments.find((row) => row.id === paymentId);
    if (!payment) throw notFound("Payment");
    if (payment.status !== "completed") {
      throw new AppError(409, "PAYMENT_ALREADY_VOIDED", "This repayment was already reversed.");
    }
    const timestamp = now();
    const voided = { ...payment, status: "voided", voidedAt: timestamp, voidReason: reason, updatedAt: timestamp };
    return {
      statements: (guard) => [
        updateRows(
          env,
          "split_payments",
          { status: "voided", voidedAt: timestamp, voidReason: reason, updatedAt: timestamp },
          { id: paymentId, expenseId, status: "completed" },
          guard,
        ),
      ],
      next: { ...state, payments: state.payments.map((row) => (row.id === paymentId ? voided : row)) },
      action: "payment_voided",
      metadata: { paymentId, amountMinor: payment.amountMinor, reason },
    };
  });
  return { expense: await getExpense(env, userId, expenseId), replayed: result.replayed };
}

const REDUCING_ADJUSTMENTS = new Set(["discount", "waived", "refund"]);

export function signedAdjustment(input: Pick<AdjustmentInput, "type" | "amountMinor" | "direction">) {
  const magnitude = Math.abs(input.amountMinor);
  if (REDUCING_ADJUSTMENTS.has(input.type)) return -magnitude;
  if (input.direction === "increase") return magnitude;
  if (input.direction === "reduce") return -magnitude;
  return input.amountMinor;
}

export async function createAdjustment(
  env: Env,
  userId: string,
  expenseId: string,
  input: AdjustmentInput,
  idem: Idem = NO_IDEM,
) {
  const result = await mutateLedger(env, userId, expenseId, `split-adjust:${expenseId}`, idem, (state) => {
    if (isCancelled(state.expense)) {
      throw new AppError(400, "EXPENSE_CANCELLED", "Cannot adjust a cancelled expense.");
    }
    const participant = state.participants.find((row) => row.id === input.participantId);
    if (!participant) throw notFound("Participant");
    const amountMinor = signedAdjustment(input);
    if (amountMinor === 0) {
      throw new AppError(400, "INVALID_ADJUSTMENT", "Adjustment amount cannot be zero.");
    }
    const ledger = ledgerFor(state);
    const current = ledger.balances.find((row) => row.personId === participant.personId)!;
    if (current.adjustedShareMinor + amountMinor < 0) {
      throw new AppError(
        400,
        "SHARE_BELOW_ZERO",
        `This would reduce the share below zero. The current share is ${current.adjustedShareMinor}.`,
      );
    }
    if (ledger.summary.sharesMinor + amountMinor > state.expense.totalAmountMinor) {
      throw new AppError(
        400,
        "INCREASE_EXCEEDS_TOTAL",
        "Shares cannot add up to more than the expense total. Reduce another share first.",
      );
    }
    const timestamp = now();
    const adjustment: AdjustmentRow = {
      id: newId(),
      expenseId,
      participantId: participant.id,
      amountMinor,
      type: input.type,
      reason: input.reason ?? null,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return {
      statements: (guard) => [insertRow(env, "split_adjustments", adjustment, guard)],
      next: { ...state, adjustments: [...state.adjustments, adjustment] },
      action: "amount_adjusted",
      metadata: { type: input.type, amountMinor, personId: participant.personId, reason: input.reason ?? null },
    };
  });
  return { expense: await getExpense(env, userId, expenseId), replayed: result.replayed };
}

export async function updateExpense(
  env: Env,
  userId: string,
  id: string,
  input: ExpensePatch,
  idem: Idem = NO_IDEM,
) {
  await mutateLedger(env, userId, id, `split-edit:${id}`, idem, (state) => {
    const { status, isDraft, ...fields } = input;
    const patch: Partial<ExpenseRow> = { ...defined(fields) };
    let action = "expense_updated";
    if (status === "cancelled" && !isCancelled(state.expense)) {
      if (state.payments.some((payment) => payment.status === "completed")) {
        throw new AppError(
          409,
          "HAS_REPAYMENTS",
          "Repayments were recorded on this expense. Reverse them before cancelling.",
        );
      }
      patch.status = "cancelled";
      action = "expense_cancelled";
    } else if (status && status !== "cancelled" && isCancelled(state.expense)) {
      patch.status = "pending";
      action = "expense_reopened";
    }
    if (isDraft === false && state.expense.isDraft) {
      patch.isDraft = false;
      action = "expense_published";
    }
    const next = { ...state, expense: { ...state.expense, ...patch } };
    // Status is written by the ledger (derived), not from the patch body.
    const columns: Omit<typeof patch, "status"> & { status?: typeof patch.status } = { ...patch };
    delete columns.status;
    return {
      statements: (guard) => [
        ...(Object.keys(columns).length
          ? [updateRows(env, "split_expenses", { ...columns, updatedAt: now() }, { id, userId }, guard)]
          : []),
        ...(patch.status
          ? [updateRows(env, "split_expenses", { status: patch.status }, { id, userId }, guard)]
          : []),
      ],
      next,
      action,
      metadata: { ...defined(fields), ...(status ? { status } : {}), ...(isDraft === false ? { published: true } : {}) },
    };
  });
  return getExpense(env, userId, id);
}

/** Permanent delete is only allowed before any money moved; otherwise cancel keeps history. */
export async function deleteExpense(env: Env, userId: string, id: string) {
  const state = await loadState(env, userId, id);
  if (state.payments.length > 0 || state.adjustments.length > 0) {
    throw new AppError(
      409,
      "HAS_FINANCIAL_HISTORY",
      "This expense has repayments or adjustments. Cancel it instead so the history is kept.",
    );
  }
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM split_expenses WHERE id = ? AND user_id = ? AND ledger_version = ? AND NOT EXISTS (SELECT 1 FROM split_payments WHERE expense_id = ?) AND NOT EXISTS (SELECT 1 FROM split_adjustments WHERE expense_id = ?)",
    ).bind(id, userId, state.expense.ledgerVersion, id, id),
  ]);
}

// ---------------------------------------------------------------------------
// Expense creation and split replacement

async function buildSplitRows(
  env: Env,
  userId: string,
  expenseId: string,
  input: Pick<ExpenseInput, "totalAmountMinor" | "splitMethod" | "payers" | "participants" | "items">,
) {
  for (const payer of input.payers) await requireActivePerson(env, userId, payer.personId);
  for (const participant of input.participants) await requireActivePerson(env, userId, participant.personId);
  let shares;
  try {
    shares = computeParticipantShares({
      totalAmountMinor: input.totalAmountMinor,
      method: input.splitMethod ?? "equal",
      participants: input.participants,
      items: input.items?.map((item) => ({
        name: item.name,
        quantity: item.quantity ?? 1,
        priceMinor: item.priceMinor,
        kind: item.kind ?? "item",
        personIds: item.personIds,
      })),
    });
  } catch (error) {
    throw new AppError(400, "SPLIT_INVALID", error instanceof Error ? error.message : "Invalid split configuration");
  }
  const payers: PayerRow[] = input.payers.map((payer) => ({
    id: newId(),
    expenseId,
    personId: payer.personId,
    paidAmountMinor: payer.paidAmountMinor,
  }));
  const participants: ParticipantRow[] = shares.map((share) => ({
    id: newId(),
    expenseId,
    personId: share.personId,
    sharePercentageBps: share.sharePercentageBps,
    shareValue: share.shareValue,
    shareAmountMinor: share.shareAmountMinor,
    adjustedShareAmountMinor: share.shareAmountMinor,
    paidAmountMinor: 0,
    pendingAmountMinor: 0,
    status: "pending",
  }));
  const items = (input.items ?? []).map((item) => ({
    row: {
      id: newId(),
      expenseId,
      name: item.name,
      quantity: item.quantity ?? 1,
      priceMinor: item.priceMinor,
      kind: item.kind ?? "item",
    },
    personIds: item.personIds,
  }));
  return { payers, participants, items };
}

function splitRowStatements(
  env: Env,
  rows: Awaited<ReturnType<typeof buildSplitRows>>,
  state: ExpenseState,
  guard?: Guard,
) {
  const ledger = ledgerFor({ ...state, payers: rows.payers, participants: rows.participants });
  const balances = new Map(ledger.balances.map((row) => [row.personId, row]));
  return [
    ...rows.payers.map((payer) => insertRow(env, "split_expense_payers", payer, guard)),
    ...rows.participants.map((participant) => {
      const balance = balances.get(participant.personId)!;
      return insertRow(
        env,
        "split_participants",
        { ...participant, pendingAmountMinor: balance.owedMinor, status: balance.status },
        guard,
      );
    }),
    ...rows.items.flatMap((item) => [
      insertRow(env, "split_items", item.row, guard),
      ...item.personIds.map((personId) =>
        insertRow(env, "split_item_participants", { id: newId(), itemId: item.row.id, personId }, guard),
      ),
    ]),
  ];
}

export async function createExpense(env: Env, userId: string, input: ExpenseInput, idem: Idem = NO_IDEM) {
  const scope = "split-expense";
  const previous = await idempotentReplay<{ id: string }>(env, userId, scope, idem);
  if (previous) return { expense: await getExpense(env, userId, previous.id), replayed: true };
  await ensureSelfPerson(env, userId);
  const today = await userToday(env, userId);
  const currency = input.currency ?? "INR";
  if (input.groupId) {
    const group = await getGroupRow(env, userId, input.groupId);
    if (group.currency !== currency) {
      throw new AppError(
        400,
        "CURRENCY_MISMATCH",
        `${group.name} uses ${group.currency}. Create this expense in ${group.currency}.`,
      );
    }
  }
  const expenseId = newId();
  const rows = await buildSplitRows(env, userId, expenseId, input);
  const timestamp = now();
  const expense: ExpenseRow = {
    id: expenseId,
    userId,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    totalAmountMinor: input.totalAmountMinor,
    currency,
    expenseDate: input.expenseDate,
    expenseTime: input.expenseTime ?? null,
    groupId: input.groupId ?? null,
    splitMethod: input.splitMethod ?? "equal",
    status: input.isDraft ? "draft" : "pending",
    dueDate: input.dueDate ?? null,
    noteForParticipants: input.noteForParticipants ?? null,
    allowPartialPayments: input.allowPartialPayments ?? true,
    sendNotifications: input.sendNotifications ?? true,
    isDraft: input.isDraft ?? false,
    receiptId: input.receiptId ?? null,
    ledgerVersion: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const state: ExpenseState = { expense, payers: rows.payers, participants: rows.participants, payments: [], adjustments: [] };
  expense.status = statusFor(state, ledgerFor(state), today);

  const reminders: Array<Record<string, unknown>> = [];
  if (input.reminder?.enabled && input.dueDate) {
    const days = input.reminder.firstReminderDaysBefore ?? 2;
    const due = new Date(`${input.dueDate}T00:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() - days);
    const channels = input.reminder.channels?.length ? input.reminder.channels : (["in_app"] as const);
    for (const channel of new Set(channels)) {
      reminders.push({
        id: newId(),
        expenseId,
        participantId: null,
        channel,
        scheduledAt: due.toISOString(),
        frequency: input.reminder.recurring ? `every_${input.reminder.frequencyDays ?? 2}_days` : null,
        status: "scheduled",
        message: input.reminder.message ?? null,
        sentAt: null,
        stopAfterSettlement: input.reminder.stopAfterSettlement ?? true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  const statements = [
    insertRow(env, "split_expenses", expense),
    ...splitRowStatements(env, rows, state),
    ...reminders.map((reminder) => insertRow(env, "split_reminders", reminder)),
    ...(input.receiptId
      ? [
          env.DB.prepare(
            "UPDATE split_receipts SET expense_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND expense_id IS NULL",
          ).bind(expenseId, timestamp, input.receiptId, userId),
        ]
      : []),
    insertRow(
      env,
      "split_activities",
      activityRow({
        userId,
        expenseId,
        groupId: expense.groupId,
        action: input.isDraft ? "expense_draft_saved" : "expense_created",
        metadata: { title: input.title, totalAmountMinor: input.totalAmountMinor, currency },
      }),
    ),
  ];
  const result = await commitCreate(env, userId, scope, idem, statements, { id: expenseId });
  return { expense: await getExpense(env, userId, result.response.id), replayed: result.replayed };
}

/** Corrects payers, participants or the split before any repayment or adjustment exists. */
export async function replaceSplit(
  env: Env,
  userId: string,
  expenseId: string,
  input: Pick<ExpenseInput, "totalAmountMinor" | "splitMethod" | "payers" | "participants" | "items">,
  idem: Idem = NO_IDEM,
) {
  await mutateLedger(env, userId, expenseId, `split-replace:${expenseId}`, idem, async (state) => {
    if (isCancelled(state.expense)) throw new AppError(400, "EXPENSE_CANCELLED", "Reopen the expense first.");
    if (state.payments.length > 0 || state.adjustments.length > 0) {
      throw new AppError(
        409,
        "HAS_FINANCIAL_HISTORY",
        "Repayments or adjustments exist. Use an adjustment to correct shares instead.",
      );
    }
    const rows = await buildSplitRows(env, userId, expenseId, input);
    const expense = {
      ...state.expense,
      totalAmountMinor: input.totalAmountMinor,
      splitMethod: input.splitMethod ?? "equal",
    };
    const next: ExpenseState = { ...state, expense, payers: rows.payers, participants: rows.participants };
    return {
      statements: (guard) => [
        deleteRows(env, "split_items", { expenseId }, guard),
        deleteRows(env, "split_expense_payers", { expenseId }, guard),
        deleteRows(env, "split_participants", { expenseId }, guard),
        updateRows(
          env,
          "split_expenses",
          { totalAmountMinor: expense.totalAmountMinor, splitMethod: expense.splitMethod, updatedAt: now() },
          { id: expenseId, userId },
          guard,
        ),
        ...splitRowStatements(env, rows, next, guard),
      ],
      next,
      action: "split_corrected",
      metadata: {
        before: {
          totalAmountMinor: state.expense.totalAmountMinor,
          splitMethod: state.expense.splitMethod,
          payers: state.payers.map((payer) => [payer.personId, payer.paidAmountMinor]),
          participants: state.participants.map((participant) => [participant.personId, participant.shareAmountMinor]),
        },
        after: {
          totalAmountMinor: expense.totalAmountMinor,
          splitMethod: expense.splitMethod,
        },
      },
    };
  });
  return getExpense(env, userId, expenseId);
}

// ---------------------------------------------------------------------------
// Groups

async function getGroupRow(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const group = await db.query.splitGroups.findFirst({
    where: and(eq(splitGroups.id, id), eq(splitGroups.ownerId, userId)),
  });
  if (!group) throw notFound("Group");
  return group;
}

type MemberBalance = {
  personId: string;
  person: ReturnType<typeof personSummary>;
  isMember: boolean;
  expenseCount: number;
  upfrontPaidMinor: number;
  shareMinor: number;
  repaymentSentMinor: number;
  repaymentReceivedMinor: number;
  netMinor: number;
  owedMinor: number;
  receivableMinor: number;
};

function groupLedger(states: ExpenseState[], ctx: ViewContext, memberIds: Set<string>) {
  const members = new Map<string, MemberBalance>();
  const touch = (personId: string) => {
    let row = members.get(personId);
    if (!row) {
      row = {
        personId,
        person: personSummary(ctx.people, personId),
        isMember: memberIds.has(personId),
        expenseCount: 0,
        upfrontPaidMinor: 0,
        shareMinor: 0,
        repaymentSentMinor: 0,
        repaymentReceivedMinor: 0,
        netMinor: 0,
        owedMinor: 0,
        receivableMinor: 0,
      };
      members.set(personId, row);
    }
    return row;
  };
  for (const personId of memberIds) touch(personId);
  let totalSharedMinor = 0;
  let collectibleMinor = 0;
  let collectedMinor = 0;
  let outstandingMinor = 0;
  let activeExpenses = 0;
  let settledExpenses = 0;
  for (const state of states) {
    if (!isActive(state.expense)) continue;
    const ledger = ledgerFor(state);
    totalSharedMinor += state.expense.totalAmountMinor;
    collectibleMinor += ledger.summary.collectibleMinor;
    collectedMinor += ledger.summary.collectedMinor;
    outstandingMinor += ledger.summary.remainingMinor;
    if (ledger.summary.remainingMinor === 0) settledExpenses += 1;
    else activeExpenses += 1;
    for (const balance of ledger.balances) {
      const row = touch(balance.personId);
      row.expenseCount += 1;
      row.upfrontPaidMinor += balance.upfrontPaidMinor;
      row.shareMinor += balance.adjustedShareMinor + balance.absorbedMinor;
      row.repaymentSentMinor += balance.repaymentSentMinor;
      row.repaymentReceivedMinor += balance.repaymentReceivedMinor;
      row.netMinor += balance.netMinor;
    }
  }
  for (const row of members.values()) {
    row.owedMinor = Math.max(0, -row.netMinor);
    row.receivableMinor = Math.max(0, row.netMinor);
  }
  return {
    summary: {
      totalSharedMinor,
      collectibleMinor,
      collectedMinor,
      outstandingMinor,
      settledPercent:
        collectibleMinor === 0 ? (outstandingMinor === 0 ? 100 : 0) : Math.floor((collectedMinor * 10_000) / collectibleMinor) / 100,
      memberCount: memberIds.size,
      activeExpenses,
      settledExpenses,
    },
    memberBalances: [...members.values()].sort((a, b) =>
      a.person?.isSelf ? -1 : b.person?.isSelf ? 1 : (a.person?.fullName ?? "").localeCompare(b.person?.fullName ?? ""),
    ),
  };
}

async function groupMembers(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  const rows = await db
    .select({ row: splitGroupMembers })
    .from(splitGroupMembers)
    .innerJoin(splitGroups, eq(splitGroupMembers.groupId, splitGroups.id))
    .where(eq(splitGroups.ownerId, userId));
  return rows.map(({ row }) => row);
}

export async function listGroups(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  const groups = await db
    .select()
    .from(splitGroups)
    .where(eq(splitGroups.ownerId, userId))
    .orderBy(desc(splitGroups.createdAt));
  if (groups.length === 0) return [];
  const [members, states, ctx] = await Promise.all([
    groupMembers(env, userId),
    loadStates(env, userId),
    viewContext(env, userId),
  ]);
  return groups.map((group) => {
    const groupMemberRows = members.filter((member) => member.groupId === group.id);
    const ledger = groupLedger(
      states.filter((state) => state.expense.groupId === group.id),
      ctx,
      new Set(groupMemberRows.map((member) => member.personId)),
    );
    const self = ledger.memberBalances.find((row) => row.personId === ctx.selfId);
    return {
      ...group,
      members: groupMemberRows.map((member) => ({ ...member, person: ctx.people.get(member.personId) ?? null })),
      summary: ledger.summary,
      yourNetMinor: self?.netMinor ?? 0,
    };
  });
}

export async function getGroup(env: Env, userId: string, id: string) {
  const group = await getGroupRow(env, userId, id);
  const db = createDatabase(env.DB);
  const [members, states, ctx] = await Promise.all([
    db.select().from(splitGroupMembers).where(eq(splitGroupMembers.groupId, id)),
    loadStates(env, userId, { groupId: id }),
    viewContext(env, userId),
  ]);
  const ledger = groupLedger(states, ctx, new Set(members.map((member) => member.personId)));
  return {
    ...group,
    members: members.map((member) => ({ ...member, person: ctx.people.get(member.personId) ?? null })),
    summary: ledger.summary,
    memberBalances: ledger.memberBalances,
    expenses: states.map((state) => expenseView(state, ctx)),
  };
}

export async function createGroup(env: Env, userId: string, input: GroupInput, idem: Idem = NO_IDEM) {
  const scope = "split-group";
  const previous = await idempotentReplay<{ id: string }>(env, userId, scope, idem);
  if (previous) return { group: await getGroup(env, userId, previous.id), replayed: true };
  const self = await ensureSelfPerson(env, userId);
  const memberIds = [...new Set([self.id, ...(input.memberPersonIds ?? [])])];
  for (const personId of memberIds) {
    if (personId !== self.id) await requireActivePerson(env, userId, personId);
  }
  const groupId = newId();
  const timestamp = now();
  const value = {
    id: groupId,
    ownerId: userId,
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? null,
    imageUrl: input.imageUrl ?? null,
    groupType: input.groupType ?? "shared",
    currency: input.currency ?? "INR",
    defaultSplitMethod: input.defaultSplitMethod ?? "equal",
    defaultDueDays: input.defaultDueDays ?? 7,
    allowMemberAdd: input.allowMemberAdd ?? true,
    allowMemberEdit: input.allowMemberEdit ?? true,
    allowMemberSettle: input.allowMemberSettle ?? true,
    sendNotifications: input.sendNotifications ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const statements = [
    insertRow(env, "split_groups", value),
    ...memberIds.map((personId) =>
      insertRow(env, "split_group_members", {
        id: newId(),
        groupId,
        personId,
        role: personId === self.id ? "owner" : "member",
        joinedAt: timestamp,
      }),
    ),
    insertRow(
      env,
      "split_activities",
      activityRow({ userId, groupId, action: "group_created", metadata: { name: value.name, members: memberIds.length } }),
    ),
  ];
  const result = await commitCreate(env, userId, scope, idem, statements, { id: groupId });
  return { group: await getGroup(env, userId, result.response.id), replayed: result.replayed };
}

export async function updateGroup(env: Env, userId: string, id: string, input: GroupPatch) {
  const group = await getGroupRow(env, userId, id);
  if (input.currency && input.currency !== group.currency) {
    const states = await loadStates(env, userId, { groupId: id });
    if (states.length > 0) {
      throw new AppError(409, "GROUP_HAS_EXPENSES", "The currency cannot change once the group has expenses.");
    }
  }
  const db = createDatabase(env.DB);
  await db
    .update(splitGroups)
    .set({ ...defined(input), updatedAt: now() })
    .where(and(eq(splitGroups.id, id), eq(splitGroups.ownerId, userId)));
  return getGroup(env, userId, id);
}

export async function addGroupMember(env: Env, userId: string, groupId: string, personId: string) {
  await getGroupRow(env, userId, groupId);
  await requireActivePerson(env, userId, personId);
  await env.DB.prepare(
    "INSERT INTO split_group_members (id, group_id, person_id, role, joined_at) SELECT ?, ?, ?, 'member', ? WHERE NOT EXISTS (SELECT 1 FROM split_group_members WHERE group_id = ? AND person_id = ?)",
  )
    .bind(newId(), groupId, personId, now(), groupId, personId)
    .run();
  return getGroup(env, userId, groupId);
}

export async function removeGroupMember(env: Env, userId: string, groupId: string, memberId: string) {
  const group = await getGroup(env, userId, groupId);
  const member = group.members.find((row) => row.id === memberId);
  if (!member) throw notFound("Member");
  if (member.role === "owner" || member.person?.isSelf) {
    throw new AppError(400, "CANNOT_REMOVE_OWNER", "You cannot remove yourself from your own group.");
  }
  const balance = group.memberBalances.find((row) => row.personId === member.personId);
  if (balance && balance.netMinor !== 0) {
    throw new AppError(
      409,
      "MEMBER_HAS_BALANCE",
      `${member.person?.fullName ?? "This member"} still ${balance.netMinor < 0 ? "owes" : "is owed"} money in this group. Settle up before removing them.`,
    );
  }
  const db = createDatabase(env.DB);
  await db
    .delete(splitGroupMembers)
    .where(and(eq(splitGroupMembers.id, memberId), eq(splitGroupMembers.groupId, groupId)));
  return getGroup(env, userId, groupId);
}

// ---------------------------------------------------------------------------
// Reminders and receipts

export async function scheduleReminder(
  env: Env,
  userId: string,
  expenseId: string,
  input: {
    channel: "in_app" | "email" | "whatsapp" | "sms";
    scheduledAt: string;
    message?: string | null;
    participantId?: string | null;
    frequency?: string | null;
    stopAfterSettlement?: boolean;
  },
  idem: Idem = NO_IDEM,
) {
  const state = await loadState(env, userId, expenseId);
  assertOpen(state, "schedule a reminder");
  if (input.participantId && !state.participants.some((participant) => participant.id === input.participantId)) {
    throw notFound("Participant");
  }
  const timestamp = now();
  const row = {
    id: newId(),
    expenseId,
    participantId: input.participantId ?? null,
    channel: input.channel,
    scheduledAt: input.scheduledAt,
    frequency: input.frequency ?? null,
    status: "scheduled",
    message: input.message ?? null,
    sentAt: null,
    stopAfterSettlement: input.stopAfterSettlement ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const result = await commitCreate(
    env,
    userId,
    `split-reminder:${expenseId}`,
    idem,
    [
      insertRow(env, "split_reminders", row),
      insertRow(
        env,
        "split_activities",
        activityRow({ userId, expenseId, groupId: state.expense.groupId, action: "reminder_scheduled", metadata: { channel: input.channel } }),
      ),
    ],
    row,
  );
  return { ...result.response, deliveryAvailable: reminderDeliveryAvailable(input.channel) };
}

/**
 * The recurring worker's cron delivers `in_app` reminders (it flips the row to `sent`).
 * Email, WhatsApp and SMS have no connected provider, so those rows end up `failed`
 * with an explicit activity entry instead of a fake "sent".
 */
export function reminderDeliveryAvailable(channel: string) {
  return channel === "in_app";
}

export async function cancelReminder(env: Env, userId: string, expenseId: string, reminderId: string) {
  await loadState(env, userId, expenseId);
  const result = await env.DB.prepare(
    "UPDATE split_reminders SET status = 'cancelled', updated_at = ? WHERE id = ? AND expense_id = ? AND status = 'scheduled'",
  )
    .bind(now(), reminderId, expenseId)
    .run();
  if (result.meta.changes === 0) throw notFound("Scheduled reminder");
}

export async function uploadReceipt(env: Env, userId: string, input: ReceiptInput) {
  if (input.fileUrl && /^(file|content|blob|data):/i.test(input.fileUrl)) {
    throw new AppError(400, "LOCAL_FILE_REJECTED", "Upload the file and send its fileId.");
  }
  const owned = input.fileId ? await requireOwnedFile(env.DB, userId, input.fileId) : null;
  const db = createDatabase(env.DB);
  const useMock = !owned && (env as { SPLIT_RECEIPT_OCR?: string }).SPLIT_RECEIPT_OCR === "mock";
  const parser = useMock ? createMockReceiptParser() : null;
  const extracted = parser
    ? {
        merchant: parser.extractMerchant(null),
        receiptDate: parser.extractDate(null),
        subtotalMinor: parser.extractSubtotal(null),
        taxMinor: parser.extractTax(null),
        totalMinor: parser.extractTotal(null),
        ocrStatus: "extracted" as const,
        ocrPayload: JSON.stringify({ source: "mock" }),
      }
    : {
        merchant: null as string | null,
        receiptDate: null as string | null,
        subtotalMinor: null as number | null,
        taxMinor: null as number | null,
        totalMinor: null as number | null,
        ocrStatus: "pending" as const,
        ocrPayload: null as string | null,
      };
  const value = {
    id: newId(),
    userId,
    expenseId: null as string | null,
    fileId: owned?.id ?? null,
    fileUrl: owned ? fileUrl(owned.id) : input.fileUrl!,
    description: input.description ?? null,
    fileName: owned?.originalName ?? input.fileName ?? null,
    mimeType: owned?.mimeType ?? input.mimeType ?? null,
    fileSizeBytes: owned?.sizeBytes ?? input.fileSizeBytes ?? null,
    ...extracted,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitReceipts).values(value);
  return value;
}

export async function attachExpenseReceipt(
  env: Env,
  userId: string,
  expenseId: string,
  input: { fileId: string; description?: string },
) {
  await loadState(env, userId, expenseId);
  const owned = await requireOwnedFile(env.DB, userId, input.fileId);
  const db = createDatabase(env.DB);
  const existing = await db.query.splitReceipts.findFirst({
    where: and(
      eq(splitReceipts.expenseId, expenseId),
      eq(splitReceipts.userId, userId),
      eq(splitReceipts.fileId, owned.id),
    ),
  });
  if (existing) return existing;
  const value = {
    id: newId(),
    userId,
    expenseId,
    fileId: owned.id,
    fileUrl: fileUrl(owned.id),
    description: input.description ?? null,
    fileName: owned.originalName,
    mimeType: owned.mimeType,
    fileSizeBytes: owned.sizeBytes,
    merchant: null as string | null,
    receiptDate: null as string | null,
    subtotalMinor: null as number | null,
    taxMinor: null as number | null,
    totalMinor: null as number | null,
    ocrStatus: "pending" as const,
    ocrPayload: null as string | null,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitReceipts).values(value);
  return value;
}

export async function deleteExpenseReceipt(env: Env, userId: string, expenseId: string, receiptId: string) {
  const db = createDatabase(env.DB);
  const receipt = await db.query.splitReceipts.findFirst({
    where: and(eq(splitReceipts.id, receiptId), eq(splitReceipts.userId, userId), eq(splitReceipts.expenseId, expenseId)),
  });
  if (!receipt) throw notFound("Receipt");
  await db.delete(splitReceipts).where(eq(splitReceipts.id, receipt.id));
}

// ---------------------------------------------------------------------------
// Summaries

type CurrencyTotals = {
  currency: string;
  expenseCount: number;
  totalSharedMinor: number;
  moneyToReceiveMinor: number;
  moneyToPayMinor: number;
  collectibleMinor: number;
  collectedMinor: number;
  pendingMinor: number;
  overdueMinor: number;
  pendingSettlements: number;
  settledPercent: number;
};

function emptyTotals(currency: string): CurrencyTotals {
  return {
    currency,
    expenseCount: 0,
    totalSharedMinor: 0,
    moneyToReceiveMinor: 0,
    moneyToPayMinor: 0,
    collectibleMinor: 0,
    collectedMinor: 0,
    pendingMinor: 0,
    overdueMinor: 0,
    pendingSettlements: 0,
    settledPercent: 100,
  };
}

function totalsByCurrency(views: ExpenseView[]) {
  const map = new Map<string, CurrencyTotals>();
  for (const view of views) {
    const totals = map.get(view.currency) ?? emptyTotals(view.currency);
    totals.expenseCount += 1;
    totals.totalSharedMinor += view.totalAmountMinor;
    totals.moneyToReceiveMinor += view.youAreOwedMinor;
    totals.moneyToPayMinor += view.youOweMinor;
    totals.collectibleMinor += view.collectibleMinor;
    totals.collectedMinor += view.collectedMinor;
    totals.pendingMinor += view.pendingMinor;
    if (view.status === "overdue") totals.overdueMinor += view.pendingMinor;
    if (view.pendingMinor > 0) totals.pendingSettlements += 1;
    map.set(view.currency, totals);
  }
  for (const totals of map.values()) {
    totals.settledPercent =
      totals.collectibleMinor === 0
        ? totals.pendingMinor === 0
          ? 100
          : 0
        : Math.floor((totals.collectedMinor * 10_000) / totals.collectibleMinor) / 100;
  }
  return [...map.values()].sort((a, b) => b.expenseCount - a.expenseCount);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function previousMonthKey(month: string) {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, "0")}`;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function activeViews(env: Env, userId: string) {
  const [states, ctx] = await Promise.all([loadStates(env, userId), viewContext(env, userId)]);
  const views = states.map((state) => expenseView(state, ctx));
  return { views, ctx, active: views.filter((view) => !view.isDraft && view.status !== "cancelled") };
}

export async function getDashboard(env: Env, userId: string) {
  const { active, ctx } = await activeViews(env, userId);
  const byCurrency = totalsByCurrency(active);
  const primary = byCurrency[0] ?? emptyTotals("INR");
  const primaryViews = active.filter((view) => view.currency === primary.currency);

  const thisMonth = monthKey(ctx.today);
  const lastMonth = previousMonthKey(thisMonth);
  const sharedIn = (month: string) =>
    primaryViews.filter((view) => monthKey(view.expenseDate) === month).reduce((sum, view) => sum + view.totalAmountMinor, 0);

  const categoryMap = new Map<string, number>();
  for (const view of primaryViews) {
    categoryMap.set(view.category, (categoryMap.get(view.category) ?? 0) + view.totalAmountMinor);
  }
  const topCategories = [...categoryMap.entries()]
    .map(([name, amountMinor]) => ({ name, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 5);

  const upcomingSettlements = active
    .filter((view) => view.pendingMinor > 0)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 6)
    .map((view) => ({
      expenseId: view.id,
      title: view.title,
      currency: view.currency,
      dueDate: view.dueDate,
      pendingMinor: view.pendingMinor,
      obligations: view.obligations,
      participants: view.participants
        .filter((participant) => participant.pendingAmountMinor > 0)
        .map((participant) => ({
          personId: participant.personId,
          name: participant.person?.fullName ?? "Unknown",
          pendingMinor: participant.pendingAmountMinor,
        })),
    }));

  const groupBalances = new Map<string, { groupId: string; name: string; currency: string; yourNetMinor: number; outstandingMinor: number }>();
  for (const view of active) {
    if (!view.group) continue;
    const row = groupBalances.get(view.group.id) ?? {
      groupId: view.group.id,
      name: view.group.name,
      currency: view.currency,
      yourNetMinor: 0,
      outstandingMinor: 0,
    };
    row.yourNetMinor += view.youAreOwedMinor - view.youOweMinor;
    row.outstandingMinor += view.pendingMinor;
    groupBalances.set(view.group.id, row);
  }

  return {
    summary: {
      ...primary,
      totalSharedChangePct: pctChange(sharedIn(thisMonth), sharedIn(lastMonth)),
      receiveChangePct: null,
      payChangePct: null,
      pendingChange: null,
    },
    byCurrency,
    topCategories,
    upcomingSettlements,
    groupBalances: [...groupBalances.values()],
    recentExpenses: active.slice(0, 20),
  };
}

export async function getHistory(env: Env, userId: string) {
  const { views, ctx } = await activeViews(env, userId);
  const nonDraft = views.filter((view) => !view.isDraft);
  const counted = nonDraft.filter((view) => view.status !== "cancelled");
  const byCurrency = totalsByCurrency(counted);
  const primary = byCurrency[0]?.currency ?? "INR";
  const inPrimary = counted.filter((view) => view.currency === primary);
  return {
    summary: {
      currency: primary,
      totalExpenses: counted.length,
      totalExpensesMinor: inPrimary.reduce((sum, view) => sum + view.totalAmountMinor, 0),
      yourShareMinor: inPrimary.reduce((sum, view) => sum + view.yourShareMinor, 0),
      youPaidMinor: inPrimary.reduce((sum, view) => sum + view.youPaidMinor, 0),
      youOweMinor: inPrimary.reduce((sum, view) => sum + view.youOweMinor, 0),
      youllReceiveMinor: inPrimary.reduce((sum, view) => sum + view.youAreOwedMinor, 0),
      repaymentsRecordedMinor: inPrimary.reduce((sum, view) => sum + view.ledger.repaymentsRecordedMinor, 0),
      outstandingMinor: inPrimary.reduce((sum, view) => sum + view.pendingMinor, 0),
    },
    byCurrency,
    selfPersonId: ctx.selfId,
    expenses: nonDraft,
  };
}

export async function getPersonDetails(env: Env, userId: string, personId: string) {
  const person = await getPerson(env, userId, personId);
  const { active, ctx } = await activeViews(env, userId);
  const related = active.filter(
    (view) =>
      view.participants.some((participant) => participant.personId === personId) ||
      view.payers.some((payer) => payer.personId === personId),
  );
  const perCurrency = new Map<string, { currency: string; youOweMinor: number; youAreOwedMinor: number }>();
  for (const view of related) {
    const row = perCurrency.get(view.currency) ?? { currency: view.currency, youOweMinor: 0, youAreOwedMinor: 0 };
    for (const edge of view.obligations) {
      if (edge.debtorPersonId === ctx.selfId && edge.creditorPersonId === personId) row.youOweMinor += edge.amountMinor;
      if (edge.debtorPersonId === personId && edge.creditorPersonId === ctx.selfId) row.youAreOwedMinor += edge.amountMinor;
    }
    perCurrency.set(view.currency, row);
  }
  const balances = [...perCurrency.values()];
  const primary = balances[0] ?? { currency: "INR", youOweMinor: 0, youAreOwedMinor: 0 };
  return {
    person,
    currency: primary.currency,
    youOweMinor: primary.youOweMinor,
    youAreOwedMinor: primary.youAreOwedMinor,
    balances,
    expenses: related,
  };
}

export async function simplifySettlements(env: Env, userId: string, expenseId?: string) {
  const { active, ctx } = await activeViews(env, userId);
  const scope = expenseId ? active.filter((view) => view.id === expenseId) : active;
  if (expenseId && scope.length === 0) throw notFound("Expense");
  const byCurrency = new Map<string, Array<{ fromPersonId: string; toPersonId: string; amountMinor: number }>>();
  for (const view of scope) {
    const edges = byCurrency.get(view.currency) ?? [];
    for (const edge of view.obligations) {
      edges.push({ fromPersonId: edge.debtorPersonId, toPersonId: edge.creditorPersonId, amountMinor: edge.amountMinor });
    }
    byCurrency.set(view.currency, edges);
  }
  const timestamp = now();
  const saved = [...byCurrency.entries()].flatMap(([currency, edges]) =>
    simplifyDebts(edges).map((suggestion) => ({
      id: newId(),
      userId,
      fromPersonId: suggestion.fromPersonId,
      toPersonId: suggestion.toPersonId,
      amountMinor: suggestion.amountMinor,
      currency,
      status: "suggested",
      metadata: expenseId ? JSON.stringify({ expenseId }) : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
  await env.DB.batch([
    env.DB.prepare("DELETE FROM split_settlement_suggestions WHERE user_id = ? AND status = 'suggested'").bind(userId),
    ...saved.map((row) => insertRow(env, "split_settlement_suggestions", row)),
    insertRow(
      env,
      "split_activities",
      activityRow({ userId, expenseId: expenseId ?? null, action: "simplify_suggested", metadata: { count: saved.length } }),
    ),
  ]);
  return saved.map((row) => ({
    ...row,
    from: personSummary(ctx.people, row.fromPersonId),
    to: personSummary(ctx.people, row.toPersonId),
  }));
}

/**
 * Preview only: builds Borrow/Lend entries for obligations involving you.
 * Creating them automatically would track the same debt in two places, so nothing is written.
 */
export async function convertExpenseToLend(env: Env, userId: string, expenseId: string) {
  const expense = await getExpense(env, userId, expenseId);
  const self = await ensureSelfPerson(env, userId);
  const suggestions = expense.obligations
    .filter((edge) => edge.debtorPersonId === self.id || edge.creditorPersonId === self.id)
    .map((edge) => {
      const lent = edge.creditorPersonId === self.id;
      const other = lent ? edge.debtor : edge.creditor;
      return {
        person: other?.fullName ?? "Unknown",
        kind: lent ? ("lent" as const) : ("borrowed" as const),
        amountMinor: edge.amountMinor,
        givenOn: expense.expenseDate,
        dueOn: expense.dueDate ?? expense.expenseDate,
        currency: expense.currency,
        note: `From split: ${expense.title}`,
      };
    });
  return { expenseId, created: false, suggestions };
}

export async function getAnalytics(env: Env, userId: string) {
  const dashboard = await getDashboard(env, userId);
  const { views } = await activeViews(env, userId);
  const monthly = new Map<string, number>();
  for (const view of views) {
    if (view.isDraft || view.status === "cancelled" || view.currency !== dashboard.summary.currency) continue;
    const month = monthKey(view.expenseDate);
    monthly.set(month, (monthly.get(month) ?? 0) + view.totalAmountMinor);
  }
  return {
    ...dashboard.summary,
    byCurrency: dashboard.byCurrency,
    topCategories: dashboard.topCategories,
    expenseCount: views.length,
    monthly: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amountMinor]) => ({ month, amountMinor })),
  };
}
