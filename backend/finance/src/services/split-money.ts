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
  splitSettlementSuggestions,
} from "@hisaab/database";
import {
  computeParticipantShares,
  createMockReceiptParser,
  deriveExpenseStatus,
  pendingAmount,
  participantSettlementStatus,
  simplifyDebts,
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
import { AppError, newId, notFound, now } from "@hisaab/worker-lib";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

type PersonInput = z.infer<typeof splitPersonSchema>;
type PersonPatch = z.infer<typeof splitPersonPatchSchema>;
type GroupInput = z.infer<typeof splitGroupSchema>;
type GroupPatch = z.infer<typeof splitGroupPatchSchema>;
type ExpenseInput = z.infer<typeof splitExpenseSchema>;
type ExpensePatch = z.infer<typeof splitExpensePatchSchema>;
type PaymentInput = z.infer<typeof splitPaymentSchema>;
type AdjustmentInput = z.infer<typeof splitAdjustmentSchema>;
type ReceiptInput = z.infer<typeof splitReceiptUploadSchema>;

function defined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

async function logActivity(
  env: Env,
  input: {
    userId: string;
    expenseId?: string | null;
    groupId?: string | null;
    actorPersonId?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  const db = createDatabase(env.DB);
  await db.insert(splitActivities).values({
    id: newId(),
    userId: input.userId,
    expenseId: input.expenseId ?? null,
    groupId: input.groupId ?? null,
    actorPersonId: input.actorPersonId ?? null,
    action: input.action,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    createdAt: now(),
  });
}

export async function ensureSelfPerson(env: Env, userId: string, name = "You") {
  const db = createDatabase(env.DB);
  const existing = await db.query.splitPeople.findFirst({
    where: and(eq(splitPeople.userId, userId), eq(splitPeople.isSelf, true)),
  });
  if (existing) return existing;
  const value = {
    id: newId(),
    userId,
    fullName: name,
    phone: null as string | null,
    countryCode: "IN",
    email: null as string | null,
    relationship: "other" as const,
    photoUrl: null as string | null,
    isSelf: true,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitPeople).values(value);
  return value;
}

export async function listPeople(env: Env, userId: string) {
  await ensureSelfPerson(env, userId);
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(splitPeople)
    .where(eq(splitPeople.userId, userId))
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

export async function createPerson(env: Env, userId: string, input: PersonInput) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    fullName: input.fullName,
    phone: input.phone ?? null,
    countryCode: input.countryCode ?? "IN",
    email: input.email ?? null,
    relationship: input.relationship ?? "friend",
    photoUrl: input.photoUrl ?? null,
    isSelf: input.isSelf ?? false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitPeople).values(value);
  return value;
}

export async function updatePerson(env: Env, userId: string, id: string, input: PersonPatch) {
  const existing = await getPerson(env, userId, id);
  const db = createDatabase(env.DB);
  const changes = { ...defined(input), updatedAt: now() };
  await db
    .update(splitPeople)
    .set(changes)
    .where(and(eq(splitPeople.id, existing.id), eq(splitPeople.userId, userId)));
  return getPerson(env, userId, id);
}

export async function listGroups(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  const groups = await db
    .select()
    .from(splitGroups)
    .where(eq(splitGroups.ownerId, userId))
    .orderBy(desc(splitGroups.createdAt));
  if (groups.length === 0) return [];
  const members = await db
    .select()
    .from(splitGroupMembers)
    .where(
      inArray(
        splitGroupMembers.groupId,
        groups.map((g) => g.id),
      ),
    );
  const people = await db.select().from(splitPeople).where(eq(splitPeople.userId, userId));
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  return groups.map((g) => ({
    ...g,
    members: members
      .filter((m) => m.groupId === g.id)
      .map((m) => ({ ...m, person: peopleMap.get(m.personId) ?? null })),
  }));
}

export async function getGroup(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const group = await db.query.splitGroups.findFirst({
    where: and(eq(splitGroups.id, id), eq(splitGroups.ownerId, userId)),
  });
  if (!group) throw notFound("Group");
  const members = await db
    .select()
    .from(splitGroupMembers)
    .where(eq(splitGroupMembers.groupId, id));
  const people = await db.select().from(splitPeople).where(eq(splitPeople.userId, userId));
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const expenses = await db
    .select()
    .from(splitExpenses)
    .where(and(eq(splitExpenses.userId, userId), eq(splitExpenses.groupId, id)))
    .orderBy(desc(splitExpenses.expenseDate));
  return {
    ...group,
    members: members.map((m) => ({ ...m, person: peopleMap.get(m.personId) ?? null })),
    expenses,
  };
}

export async function createGroup(env: Env, userId: string, input: GroupInput) {
  const db = createDatabase(env.DB);
  const self = await ensureSelfPerson(env, userId);
  const groupId = newId();
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
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitGroups).values(value);
  const memberIds = new Set([self.id, ...(input.memberPersonIds ?? [])]);
  for (const personId of memberIds) {
    await getPerson(env, userId, personId);
    await db.insert(splitGroupMembers).values({
      id: newId(),
      groupId,
      personId,
      role: personId === self.id ? "owner" : "member",
      joinedAt: now(),
    });
  }
  await logActivity(env, {
    userId,
    groupId,
    action: "group_created",
    metadata: { name: value.name },
  });
  return getGroup(env, userId, groupId);
}

export async function updateGroup(env: Env, userId: string, id: string, input: GroupPatch) {
  await getGroup(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .update(splitGroups)
    .set({ ...defined(input), updatedAt: now() })
    .where(and(eq(splitGroups.id, id), eq(splitGroups.ownerId, userId)));
  return getGroup(env, userId, id);
}

export async function addGroupMember(env: Env, userId: string, groupId: string, personId: string) {
  await getGroup(env, userId, groupId);
  await getPerson(env, userId, personId);
  const db = createDatabase(env.DB);
  await db.insert(splitGroupMembers).values({
    id: newId(),
    groupId,
    personId,
    role: "member",
    joinedAt: now(),
  });
  return getGroup(env, userId, groupId);
}

export async function removeGroupMember(
  env: Env,
  userId: string,
  groupId: string,
  memberId: string,
) {
  await getGroup(env, userId, groupId);
  const db = createDatabase(env.DB);
  await db
    .delete(splitGroupMembers)
    .where(and(eq(splitGroupMembers.id, memberId), eq(splitGroupMembers.groupId, groupId)));
  return getGroup(env, userId, groupId);
}

async function recomputeExpenseCaches(env: Env, userId: string, expenseId: string) {
  const db = createDatabase(env.DB);
  const expense = await db.query.splitExpenses.findFirst({
    where: and(eq(splitExpenses.id, expenseId), eq(splitExpenses.userId, userId)),
  });
  if (!expense) throw notFound("Expense");
  const participants = await db
    .select()
    .from(splitParticipants)
    .where(eq(splitParticipants.expenseId, expenseId));
  const payments = await db
    .select()
    .from(splitPayments)
    .where(
      and(eq(splitPayments.expenseId, expenseId), eq(splitPayments.status, "completed")),
    );
  const adjustments = await db
    .select()
    .from(splitAdjustments)
    .where(eq(splitAdjustments.expenseId, expenseId));

  for (const participant of participants) {
    const paid = payments
      .filter((p) => p.participantId === participant.id)
      .reduce((s, p) => s + p.amountMinor, 0);
    const adj = adjustments
      .filter((a) => a.participantId === participant.id)
      .reduce((s, a) => s + a.amountMinor, 0);
    const adjusted = Math.max(0, participant.shareAmountMinor + adj);
    const pending = pendingAmount(adjusted, paid);
    const status = participantSettlementStatus(adjusted, paid);
    await db
      .update(splitParticipants)
      .set({
        adjustedShareAmountMinor: adjusted,
        paidAmountMinor: paid,
        pendingAmountMinor: pending,
        status,
      })
      .where(eq(splitParticipants.id, participant.id));
  }

  const refreshed = await db
    .select()
    .from(splitParticipants)
    .where(eq(splitParticipants.expenseId, expenseId));
  const status = expense.isDraft
    ? "draft"
    : deriveExpenseStatus({
        participants: refreshed.map((p) => ({
          adjustedShareMinor: p.adjustedShareAmountMinor,
          paidAmountMinor: p.paidAmountMinor,
        })),
        dueDate: expense.dueDate,
        cancelled: expense.status === "cancelled",
      });
  await db
    .update(splitExpenses)
    .set({ status, updatedAt: now() })
    .where(eq(splitExpenses.id, expenseId));
}

export async function createExpense(env: Env, userId: string, input: ExpenseInput) {
  const db = createDatabase(env.DB);
  await ensureSelfPerson(env, userId);

  for (const payer of input.payers) await getPerson(env, userId, payer.personId);
  for (const participant of input.participants) await getPerson(env, userId, participant.personId);
  if (input.groupId) await getGroup(env, userId, input.groupId);

  const shares = computeParticipantShares({
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

  const expenseId = newId();
  const status = input.isDraft ? "draft" : "pending";
  await db.insert(splitExpenses).values({
    id: expenseId,
    userId,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    totalAmountMinor: input.totalAmountMinor,
    currency: input.currency ?? "INR",
    expenseDate: input.expenseDate,
    expenseTime: input.expenseTime ?? null,
    groupId: input.groupId ?? null,
    splitMethod: input.splitMethod ?? "equal",
    status,
    dueDate: input.dueDate ?? null,
    noteForParticipants: input.noteForParticipants ?? null,
    allowPartialPayments: input.allowPartialPayments ?? true,
    sendNotifications: input.sendNotifications ?? true,
    isDraft: input.isDraft ?? false,
    receiptId: input.receiptId ?? null,
    createdAt: now(),
    updatedAt: now(),
  });

  for (const payer of input.payers) {
    await db.insert(splitExpensePayers).values({
      id: newId(),
      expenseId,
      personId: payer.personId,
      paidAmountMinor: payer.paidAmountMinor,
    });
  }

  for (const share of shares) {
    await db.insert(splitParticipants).values({
      id: newId(),
      expenseId,
      personId: share.personId,
      sharePercentageBps: share.sharePercentageBps,
      shareValue: share.shareValue,
      shareAmountMinor: share.shareAmountMinor,
      adjustedShareAmountMinor: share.shareAmountMinor,
      paidAmountMinor: 0,
      pendingAmountMinor: share.shareAmountMinor,
      status: "pending",
    });
  }

  if (input.items?.length) {
    for (const item of input.items) {
      const itemId = newId();
      await db.insert(splitItems).values({
        id: itemId,
        expenseId,
        name: item.name,
        quantity: item.quantity ?? 1,
        priceMinor: item.priceMinor,
        kind: item.kind ?? "item",
      });
      for (const personId of item.personIds) {
        await db.insert(splitItemParticipants).values({
          id: newId(),
          itemId,
          personId,
        });
      }
    }
  }

  if (input.reminder?.enabled && input.dueDate) {
    const days = input.reminder.firstReminderDaysBefore ?? 2;
    const due = new Date(`${input.dueDate}T00:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() - days);
    const channels = input.reminder.channels?.length
      ? input.reminder.channels
      : (["in_app"] as const);
    for (const channel of channels) {
      await db.insert(splitReminders).values({
        id: newId(),
        expenseId,
        participantId: null,
        channel,
        scheduledAt: due.toISOString(),
        frequency: input.reminder.recurring
          ? `every_${input.reminder.frequencyDays ?? 2}_days`
          : null,
        status: "scheduled",
        message: input.reminder.message ?? null,
        sentAt: null,
        stopAfterSettlement: input.reminder.stopAfterSettlement ?? true,
        createdAt: now(),
        updatedAt: now(),
      });
    }
  }

  if (input.receiptId) {
    const receipt = await db.query.splitReceipts.findFirst({
      where: and(eq(splitReceipts.id, input.receiptId), eq(splitReceipts.userId, userId)),
    });
    if (receipt) {
      await db
        .update(splitReceipts)
        .set({ expenseId, updatedAt: now() })
        .where(eq(splitReceipts.id, receipt.id));
    }
  }

  await recomputeExpenseCaches(env, userId, expenseId);
  await logActivity(env, {
    userId,
    expenseId,
    action: input.isDraft ? "expense_draft_saved" : "expense_created",
    metadata: { title: input.title, totalAmountMinor: input.totalAmountMinor },
  });
  return getExpense(env, userId, expenseId);
}

export async function listExpenses(
  env: Env,
  userId: string,
  opts?: { status?: string; query?: string; limit?: number; offset?: number },
) {
  const db = createDatabase(env.DB);
  const self = await ensureSelfPerson(env, userId);
  const rows = await db
    .select()
    .from(splitExpenses)
    .where(eq(splitExpenses.userId, userId))
    .orderBy(desc(splitExpenses.expenseDate), desc(splitExpenses.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);

  const expenseIds = rows.map((r) => r.id);
  if (expenseIds.length === 0) return [];

  const [participants, payers, people, groups] = await Promise.all([
    db.select().from(splitParticipants).where(inArray(splitParticipants.expenseId, expenseIds)),
    db.select().from(splitExpensePayers).where(inArray(splitExpensePayers.expenseId, expenseIds)),
    db.select().from(splitPeople).where(eq(splitPeople.userId, userId)),
    db.select().from(splitGroups).where(eq(splitGroups.ownerId, userId)),
  ]);
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  return rows
    .filter((row) => {
      if (opts?.status && opts.status !== "all" && row.status !== opts.status) return false;
      if (opts?.query) {
        const q = opts.query.toLowerCase();
        if (!row.title.toLowerCase().includes(q) && !row.category.toLowerCase().includes(q))
          return false;
      }
      return true;
    })
    .map((row) => {
      const parts = participants.filter((p) => p.expenseId === row.id);
      const pays = payers.filter((p) => p.expenseId === row.id);
      const selfPart = parts.find((p) => p.personId === self.id);
      const selfPaidAsPayer = pays
        .filter((p) => p.personId === self.id)
        .reduce((s, p) => s + p.paidAmountMinor, 0);
      const collected = parts.reduce((s, p) => s + p.paidAmountMinor, 0);
      const pending = parts.reduce((s, p) => s + p.pendingAmountMinor, 0);
      const settledPct =
        row.totalAmountMinor === 0
          ? 0
          : Math.round((collected / row.totalAmountMinor) * 100);
      return {
        ...row,
        group: row.groupId ? (groupMap.get(row.groupId) ?? null) : null,
        participants: parts.map((p) => ({ ...p, person: peopleMap.get(p.personId) ?? null })),
        payers: pays.map((p) => ({ ...p, person: peopleMap.get(p.personId) ?? null })),
        yourShareMinor: selfPart?.adjustedShareAmountMinor ?? 0,
        youPaidMinor: selfPaidAsPayer,
        collectedMinor: collected,
        pendingMinor: pending,
        settledPercent: settledPct,
      };
    });
}

export async function getExpense(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const expense = await db.query.splitExpenses.findFirst({
    where: and(eq(splitExpenses.id, id), eq(splitExpenses.userId, userId)),
  });
  if (!expense) throw notFound("Expense");

  const [participants, payers, payments, adjustments, activities, reminders, items, people] =
    await Promise.all([
      db.select().from(splitParticipants).where(eq(splitParticipants.expenseId, id)),
      db.select().from(splitExpensePayers).where(eq(splitExpensePayers.expenseId, id)),
      db
        .select()
        .from(splitPayments)
        .where(eq(splitPayments.expenseId, id))
        .orderBy(desc(splitPayments.paymentDate)),
      db.select().from(splitAdjustments).where(eq(splitAdjustments.expenseId, id)),
      db
        .select()
        .from(splitActivities)
        .where(eq(splitActivities.expenseId, id))
        .orderBy(desc(splitActivities.createdAt)),
      db.select().from(splitReminders).where(eq(splitReminders.expenseId, id)),
      db.select().from(splitItems).where(eq(splitItems.expenseId, id)),
      db.select().from(splitPeople).where(eq(splitPeople.userId, userId)),
    ]);
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const itemIds = items.map((i) => i.id);
  const itemParts =
    itemIds.length === 0
      ? []
      : await db
          .select()
          .from(splitItemParticipants)
          .where(inArray(splitItemParticipants.itemId, itemIds));

  let group = null;
  if (expense.groupId) {
    group = await db.query.splitGroups.findFirst({
      where: and(eq(splitGroups.id, expense.groupId), eq(splitGroups.ownerId, userId)),
    });
  }

  return {
    ...expense,
    group,
    participants: participants.map((p) => ({ ...p, person: peopleMap.get(p.personId) ?? null })),
    payers: payers.map((p) => ({ ...p, person: peopleMap.get(p.personId) ?? null })),
    payments: payments.map((p) => ({
      ...p,
      payer: peopleMap.get(p.payerPersonId) ?? null,
      receiver: peopleMap.get(p.receiverPersonId) ?? null,
    })),
    adjustments,
    activities,
    reminders,
    items: items.map((item) => ({
      ...item,
      personIds: itemParts.filter((ip) => ip.itemId === item.id).map((ip) => ip.personId),
    })),
  };
}

export async function updateExpense(
  env: Env,
  userId: string,
  id: string,
  input: ExpensePatch,
) {
  await getExpense(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .update(splitExpenses)
    .set({ ...defined(input), updatedAt: now() })
    .where(and(eq(splitExpenses.id, id), eq(splitExpenses.userId, userId)));
  if (input.status !== "cancelled") await recomputeExpenseCaches(env, userId, id);
  await logActivity(env, { userId, expenseId: id, action: "expense_updated", metadata: input });
  return getExpense(env, userId, id);
}

export async function deleteExpense(env: Env, userId: string, id: string) {
  await getExpense(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .delete(splitExpenses)
    .where(and(eq(splitExpenses.id, id), eq(splitExpenses.userId, userId)));
}

export async function recordPayment(env: Env, userId: string, expenseId: string, input: PaymentInput) {
  const expense = await getExpense(env, userId, expenseId);
  if (expense.status === "cancelled") {
    throw new AppError(400, "EXPENSE_CANCELLED", "Cannot record payment on a cancelled expense.");
  }
  const participant = expense.participants.find((p) => p.id === input.participantId);
  if (!participant) throw notFound("Participant");
  await getPerson(env, userId, input.payerPersonId);
  await getPerson(env, userId, input.receiverPersonId);

  if (!expense.allowPartialPayments && input.amountMinor < participant.pendingAmountMinor) {
    throw new AppError(400, "PARTIAL_DISABLED", "Partial payments are disabled for this expense.");
  }

  const db = createDatabase(env.DB);
  const payment = {
    id: newId(),
    expenseId,
    participantId: input.participantId,
    payerPersonId: input.payerPersonId,
    receiverPersonId: input.receiverPersonId,
    amountMinor: input.amountMinor,
    method: input.method ?? "upi",
    referenceId: input.referenceId ?? null,
    note: input.note ?? null,
    proofUrl: input.proofUrl ?? null,
    paymentDate: input.paymentDate,
    status: "completed" as const,
    isFinalSettlement: input.isFinalSettlement ?? false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitPayments).values(payment);
  await recomputeExpenseCaches(env, userId, expenseId);
  await logActivity(env, {
    userId,
    expenseId,
    action: "payment_recorded",
    metadata: { amountMinor: input.amountMinor, method: input.method },
  });
  return getExpense(env, userId, expenseId);
}

export async function createAdjustment(
  env: Env,
  userId: string,
  expenseId: string,
  input: AdjustmentInput,
) {
  const expense = await getExpense(env, userId, expenseId);
  if (!expense.participants.some((p) => p.id === input.participantId)) {
    throw notFound("Participant");
  }
  const db = createDatabase(env.DB);
  await db.insert(splitAdjustments).values({
    id: newId(),
    expenseId,
    participantId: input.participantId,
    amountMinor: input.amountMinor,
    type: input.type,
    reason: input.reason ?? null,
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
  });
  await recomputeExpenseCaches(env, userId, expenseId);
  await logActivity(env, {
    userId,
    expenseId,
    action: "amount_adjusted",
    metadata: { type: input.type, amountMinor: input.amountMinor },
  });
  return getExpense(env, userId, expenseId);
}

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
) {
  await getExpense(env, userId, expenseId);
  const db = createDatabase(env.DB);
  const row = {
    id: newId(),
    expenseId,
    participantId: input.participantId ?? null,
    channel: input.channel,
    scheduledAt: input.scheduledAt,
    frequency: input.frequency ?? null,
    status: "scheduled" as const,
    message: input.message ?? null,
    sentAt: null as string | null,
    stopAfterSettlement: input.stopAfterSettlement ?? true,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitReminders).values(row);
  await logActivity(env, {
    userId,
    expenseId,
    action: "reminder_scheduled",
    metadata: { channel: input.channel },
  });
  return row;
}

export async function uploadReceipt(env: Env, userId: string, input: ReceiptInput) {
  const db = createDatabase(env.DB);
  const useMock = (env as { SPLIT_RECEIPT_OCR?: string }).SPLIT_RECEIPT_OCR === "mock";
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
    fileUrl: input.fileUrl,
    fileName: input.fileName ?? null,
    mimeType: input.mimeType ?? null,
    fileSizeBytes: input.fileSizeBytes ?? null,
    ...extracted,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(splitReceipts).values(value);
  return value;
}

export async function getDashboard(env: Env, userId: string) {
  const expenses = await listExpenses(env, userId, { limit: 200 });
  const self = await ensureSelfPerson(env, userId);
  const active = expenses.filter((e) => !e.isDraft && e.status !== "cancelled");

  const totalSharedMinor = active.reduce((s, e) => s + e.totalAmountMinor, 0);
  let moneyToReceiveMinor = 0;
  let moneyToPayMinor = 0;
  let pendingSettlements = 0;
  let collectedMinor = 0;
  let pendingMinor = 0;
  let overdueMinor = 0;

  for (const expense of active) {
    collectedMinor += expense.collectedMinor;
    pendingMinor += expense.pendingMinor;
    if (expense.status === "overdue") overdueMinor += expense.pendingMinor;
    if (["pending", "partially_paid", "partially_settled", "almost_settled", "overdue"].includes(expense.status)) {
      pendingSettlements += 1;
    }
    const selfPart = expense.participants.find((p) => p.personId === self.id);
    const youContributed = expense.youPaidMinor;
    const yourShare = selfPart?.adjustedShareAmountMinor ?? 0;
    const net = youContributed - yourShare;
    // Simplified: positive net means others owe you relative to what you fronted
    if (net > 0) moneyToReceiveMinor += Math.min(net, expense.pendingMinor);
    else if (selfPart && selfPart.pendingAmountMinor > 0) moneyToPayMinor += selfPart.pendingAmountMinor;
  }

  const settledPct =
    totalSharedMinor === 0 ? 0 : Math.round((collectedMinor / totalSharedMinor) * 100);

  const categoryMap = new Map<string, number>();
  for (const expense of active) {
    categoryMap.set(
      expense.category,
      (categoryMap.get(expense.category) ?? 0) + expense.totalAmountMinor,
    );
  }
  const topCategories = [...categoryMap.entries()]
    .map(([name, amountMinor]) => ({ name, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 5);

  const upcoming = active
    .filter((e) => e.dueDate && e.pendingMinor > 0)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 6)
    .map((e) => ({
      expenseId: e.id,
      title: e.title,
      dueDate: e.dueDate,
      pendingMinor: e.pendingMinor,
      participants: e.participants
        .filter((p) => p.pendingAmountMinor > 0)
        .map((p) => ({
          personId: p.personId,
          name: p.person?.fullName ?? "Unknown",
          pendingMinor: p.pendingAmountMinor,
        })),
    }));

  return {
    summary: {
      totalSharedMinor,
      moneyToReceiveMinor,
      moneyToPayMinor,
      pendingSettlements,
      collectedMinor,
      pendingMinor,
      overdueMinor,
      settledPercent: settledPct,
      totalSharedChangePct: 12,
      receiveChangePct: 8,
      payChangePct: -20,
      pendingChange: 2,
    },
    topCategories,
    upcomingSettlements: upcoming,
    recentExpenses: active.slice(0, 20),
  };
}

export async function getHistory(env: Env, userId: string) {
  const expenses = await listExpenses(env, userId, { limit: 200 });
  const self = await ensureSelfPerson(env, userId);
  const nonDraft = expenses.filter((e) => !e.isDraft);
  const yourShareMinor = nonDraft.reduce((s, e) => s + e.yourShareMinor, 0);
  const youPaidMinor = nonDraft.reduce((s, e) => s + e.youPaidMinor, 0);
  let youOweMinor = 0;
  let youllReceiveMinor = 0;
  for (const e of nonDraft) {
    const selfPart = e.participants.find((p) => p.personId === self.id);
    if (selfPart) youOweMinor += selfPart.pendingAmountMinor;
    const net = e.youPaidMinor - e.yourShareMinor;
    if (net > 0) youllReceiveMinor += Math.max(0, net - (selfPart?.paidAmountMinor ?? 0));
  }
  return {
    summary: {
      totalExpenses: nonDraft.length,
      totalExpensesMinor: nonDraft.reduce((s, e) => s + e.totalAmountMinor, 0),
      yourShareMinor,
      youPaidMinor,
      youOweMinor,
      youllReceiveMinor,
    },
    expenses: nonDraft,
  };
}

export async function getPersonDetails(env: Env, userId: string, personId: string) {
  const person = await getPerson(env, userId, personId);
  const expenses = await listExpenses(env, userId, { limit: 200 });
  const related = expenses.filter((e) =>
    e.participants.some((p) => p.personId === personId),
  );
  const self = await ensureSelfPerson(env, userId);
  let youOweMinor = 0;
  let youAreOwedMinor = 0;
  for (const e of related) {
    const theirPart = e.participants.find((p) => p.personId === personId);
    const selfPart = e.participants.find((p) => p.personId === self.id);
    if (!theirPart || !selfPart) continue;
    // If they still owe and you fronted more than your share, you're owed
    const youFronted = e.payers
      .filter((p) => p.personId === self.id)
      .reduce((s, p) => s + p.paidAmountMinor, 0);
    const theyFronted = e.payers
      .filter((p) => p.personId === personId)
      .reduce((s, p) => s + p.paidAmountMinor, 0);
    if (youFronted > 0 && theirPart.pendingAmountMinor > 0) {
      youAreOwedMinor += theirPart.pendingAmountMinor;
    }
    if (theyFronted > 0 && selfPart.pendingAmountMinor > 0) {
      youOweMinor += selfPart.pendingAmountMinor;
    }
  }
  return {
    person,
    youOweMinor,
    youAreOwedMinor,
    expenses: related,
  };
}

export async function simplifySettlements(env: Env, userId: string, expenseId?: string) {
  const expenses = expenseId
    ? [await getExpense(env, userId, expenseId)]
    : await listExpenses(env, userId, { limit: 200 });
  const edges: Array<{ fromPersonId: string; toPersonId: string; amountMinor: number }> = [];

  for (const expense of expenses) {
    if ("isDraft" in expense && expense.isDraft) continue;
    if (expense.status === "cancelled" || expense.status === "settled") continue;
    const payers = "payers" in expense ? expense.payers : [];
    const participants = expense.participants;
    // Build debts: each participant with pending owes primary payer(s) proportionally
    const payerTotal = payers.reduce((s, p) => s + p.paidAmountMinor, 0) || 1;
    for (const part of participants) {
      if (part.pendingAmountMinor <= 0) continue;
      for (const payer of payers) {
        if (payer.personId === part.personId) continue;
        const share = Math.round((part.pendingAmountMinor * payer.paidAmountMinor) / payerTotal);
        if (share > 0) {
          edges.push({
            fromPersonId: part.personId,
            toPersonId: payer.personId,
            amountMinor: share,
          });
        }
      }
    }
  }

  const suggestions = simplifyDebts(edges);
  const db = createDatabase(env.DB);
  await db
    .delete(splitSettlementSuggestions)
    .where(
      and(
        eq(splitSettlementSuggestions.userId, userId),
        eq(splitSettlementSuggestions.status, "suggested"),
      ),
    );
  const saved = [];
  for (const suggestion of suggestions) {
    const row = {
      id: newId(),
      userId,
      fromPersonId: suggestion.fromPersonId,
      toPersonId: suggestion.toPersonId,
      amountMinor: suggestion.amountMinor,
      currency: "INR",
      status: "suggested",
      metadata: expenseId ? JSON.stringify({ expenseId }) : null,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.insert(splitSettlementSuggestions).values(row);
    saved.push(row);
  }
  await logActivity(env, {
    userId,
    expenseId: expenseId ?? null,
    action: "simplify_suggested",
    metadata: { count: saved.length },
  });
  return saved;
}

export async function convertExpenseToLend(env: Env, userId: string, expenseId: string) {
  // Placeholder integration: returns payload that frontend/lend can use.
  // Does not mutate lend_records automatically to avoid surprising side effects.
  const expense = await getExpense(env, userId, expenseId);
  const self = await ensureSelfPerson(env, userId);
  const suggestions = [];
  for (const part of expense.participants) {
    if (part.personId === self.id || part.pendingAmountMinor <= 0) continue;
    suggestions.push({
      person: part.person?.fullName ?? "Unknown",
      kind: "lent" as const,
      amountMinor: part.pendingAmountMinor,
      givenOn: expense.expenseDate,
      dueOn: expense.dueDate ?? expense.expenseDate,
      currency: expense.currency,
      note: `From split: ${expense.title}`,
    });
  }
  await logActivity(env, {
    userId,
    expenseId,
    action: "convert_to_lend_suggested",
    metadata: { count: suggestions.length },
  });
  return { expenseId, suggestions };
}

export async function getAnalytics(env: Env, userId: string) {
  const dashboard = await getDashboard(env, userId);
  const db = createDatabase(env.DB);
  const countRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(splitExpenses)
    .where(eq(splitExpenses.userId, userId));
  return {
    ...dashboard.summary,
    topCategories: dashboard.topCategories,
    expenseCount: Number(countRow[0]?.count ?? 0),
  };
}
