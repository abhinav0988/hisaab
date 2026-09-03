import { accounts, categories, createDatabase, recurringTransactions } from "@hisaab/database";
import type { recurringPatchSchema, recurringSchema } from "@hisaab/validation";
import type { z } from "zod";
import { and, eq, isNull, or } from "drizzle-orm";
import { AppError, newId, notFound, now } from "@hisaab/worker-lib";
import { nextRecurringRun } from "../schedule";

type CreateRecurring = z.infer<typeof recurringSchema>;
type PatchRecurring = z.infer<typeof recurringPatchSchema>;

async function validate(
  env: Env,
  userId: string,
  accountId: string,
  categoryId: string,
  type: string,
) {
  const db = createDatabase(env.DB);
  const [account, category] = await Promise.all([
    db.query.accounts.findFirst({
      where: and(eq(accounts.id, accountId), eq(accounts.userId, userId)),
    }),
    db.query.categories.findFirst({
      where: and(
        eq(categories.id, categoryId),
        or(isNull(categories.userId), eq(categories.userId, userId)),
      ),
    }),
  ]);
  if (!account) throw new AppError(400, "INVALID_ACCOUNT", "Select one of your accounts.");
  if (!category || category.type !== type)
    throw new AppError(400, "INVALID_CATEGORY", "Select a matching category.");
}
export async function listRecurring(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.userId, userId))
    .orderBy(recurringTransactions.nextRunAt);
}
export async function getRecurring(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.recurringTransactions.findFirst({
    where: and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)),
  });
  if (!row) throw notFound("Recurring transaction");
  return row;
}
export async function createRecurring(env: Env, userId: string, input: CreateRecurring) {
  await validate(env, userId, input.accountId, input.categoryId, input.type);
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    ...input,
    merchant: input.merchant ?? null,
    notes: input.notes ?? null,
    nextRunAt: input.startAt,
    lastRunAt: null,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(recurringTransactions).values(value);
  return value;
}
export async function updateRecurring(env: Env, userId: string, id: string, input: PatchRecurring) {
  const existing = await getRecurring(env, userId, id);
  const accountId = input.accountId ?? existing.accountId;
  const categoryId = input.categoryId ?? existing.categoryId;
  const type = input.type ?? existing.type;
  await validate(env, userId, accountId, categoryId, type);
  const db = createDatabase(env.DB);
  const changes = {
    ...input,
    ...(input.startAt ? { nextRunAt: input.startAt } : {}),
    updatedAt: now(),
  };
  await db
    .update(recurringTransactions)
    .set(changes)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
  return { ...existing, ...changes };
}
export async function setRecurringActive(env: Env, userId: string, id: string, isActive: boolean) {
  await getRecurring(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .update(recurringTransactions)
    .set({ isActive, updatedAt: now() })
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
  return { id, isActive };
}
export async function deleteRecurring(env: Env, userId: string, id: string) {
  await getRecurring(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .delete(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
}

export async function processRecurring(env: Env, scheduledAt = new Date()) {
  const due = await env.DB.prepare(
    "SELECT * FROM recurring_transactions WHERE is_active=1 AND next_run_at<=? ORDER BY next_run_at LIMIT 100",
  )
    .bind(scheduledAt.toISOString())
    .all<Record<string, string | number | null>>();
  let generated = 0;
  for (const row of due.results) {
    const recurringId = String(row.id);
    const scheduledFor = String(row.next_run_at);
    const existing = await env.DB.prepare(
      "SELECT id FROM recurring_occurrences WHERE recurring_transaction_id=? AND scheduled_for=?",
    )
      .bind(recurringId, scheduledFor)
      .first();
    const nextRun = nextRecurringRun(
      scheduledFor,
      String(row.frequency) as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
    );
    if (existing) {
      await env.DB.prepare(
        "UPDATE recurring_transactions SET last_run_at=?,next_run_at=?,updated_at=? WHERE id=? AND next_run_at=?",
      )
        .bind(scheduledFor, nextRun, now(), recurringId, scheduledFor)
        .run();
      continue;
    }
    const transactionId = newId();
    const occurrenceId = newId();
    const timestamp = now();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO transactions (id,user_id,account_id,category_id,recurring_transaction_id,type,amount_minor,currency,merchant,notes,transaction_at,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)",
        ).bind(
          transactionId,
          row.user_id,
          row.account_id,
          row.category_id,
          recurringId,
          row.type,
          row.amount_minor,
          row.currency,
          row.merchant,
          row.notes,
          scheduledFor,
          timestamp,
          timestamp,
        ),
        env.DB.prepare(
          "INSERT INTO recurring_occurrences (id,recurring_transaction_id,scheduled_for,generated_transaction_id,created_at) VALUES (?,?,?,?,?)",
        ).bind(occurrenceId, recurringId, scheduledFor, transactionId, timestamp),
        env.DB.prepare(
          "UPDATE recurring_transactions SET last_run_at=?,next_run_at=?,updated_at=? WHERE id=? AND next_run_at=?",
        ).bind(scheduledFor, nextRun, timestamp, recurringId, scheduledFor),
      ]);
      generated += 1;
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "recurring_occurrence_conflict",
          recurringId,
          scheduledFor,
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
  return { checked: due.results.length, generated };
}
