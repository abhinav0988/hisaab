import {
  budgets,
  categories,
  createDatabase,
  transactions,
  userPreferences,
} from "@hisaab/database";
import type { budgetPatchSchema, budgetSchema } from "@hisaab/validation";
import { budgetUsage } from "@hisaab/validation";
import type { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AppError, audit, monthBounds, newId, notFound, now } from "@hisaab/worker-lib";

type CreateBudget = z.infer<typeof budgetSchema>;
type PatchBudget = z.infer<typeof budgetPatchSchema>;

export async function listBudgets(env: Env, userId: string, month: string) {
  const db = createDatabase(env.DB);
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  const bounds = monthBounds(month, prefs?.timezone ?? "UTC");
  const rows = await db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      month: budgets.month,
      amountMinor: budgets.amountMinor,
      alertPercentage: budgets.alertPercentage,
      spentMinor: sql<number>`coalesce(sum(case when ${transactions.type}='EXPENSE' then ${transactions.amountMinor} else 0 end), 0)`,
    })
    .from(budgets)
    .leftJoin(categories, eq(categories.id, budgets.categoryId))
    .leftJoin(
      transactions,
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.type, "EXPENSE"),
        sql`${transactions.transactionAt} >= ${bounds.from}`,
        sql`${transactions.transactionAt} < ${bounds.to}`,
        sql`(${budgets.categoryId} IS NULL OR ${transactions.categoryId} = ${budgets.categoryId})`,
      ),
    )
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month)))
    .groupBy(budgets.id)
    .orderBy(categories.name);
  return rows.map((row) => ({ ...row, ...budgetUsage(row.amountMinor, Number(row.spentMinor)) }));
}
export async function getBudget(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.budgets.findFirst({
    where: and(eq(budgets.id, id), eq(budgets.userId, userId)),
  });
  if (!row) throw notFound("Budget");
  return row;
}
export async function createBudget(env: Env, userId: string, input: CreateBudget) {
  const db = createDatabase(env.DB);
  const categoryId = input.categoryId ?? null;
  const existing = await db.query.budgets.findFirst({
    where: and(
      eq(budgets.userId, userId),
      eq(budgets.month, input.month),
      categoryId ? eq(budgets.categoryId, categoryId) : isNull(budgets.categoryId),
    ),
  });
  if (existing)
    throw new AppError(
      409,
      "BUDGET_EXISTS",
      categoryId
        ? "A budget already exists for this category and month."
        : "An overall budget already exists for this month.",
    );
  const value = { id: newId(), userId, ...input, categoryId, createdAt: now(), updatedAt: now() };
  await db.insert(budgets).values(value);
  await audit(db, {
    userId,
    action: "CREATE",
    entityType: "BUDGET",
    entityId: value.id,
    newValue: input,
  });
  return value;
}
export async function updateBudget(env: Env, userId: string, id: string, input: PatchBudget) {
  const existing = await getBudget(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .update(budgets)
    .set({ ...input, updatedAt: now() })
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  await audit(db, {
    userId,
    action: "UPDATE",
    entityType: "BUDGET",
    entityId: id,
    oldValue: existing,
    newValue: input,
  });
  return { ...existing, ...input };
}
export async function deleteBudget(env: Env, userId: string, id: string) {
  await getBudget(env, userId, id);
  const db = createDatabase(env.DB);
  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  await audit(db, { userId, action: "DELETE", entityType: "BUDGET", entityId: id });
}
