import { goalContributions, savingsGoals, createDatabase } from "@hisaab/database";
import type { goalContributionSchema, goalSchema } from "@hisaab/validation";
import { audit, newId, notFound, now } from "@hisaab/worker-lib";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { nextGoalSaved } from "../goals-logic";

type CreateGoal = z.infer<typeof goalSchema>;
type CreateContribution = z.infer<typeof goalContributionSchema>;

export async function listGoals(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db.query.savingsGoals.findMany({
    where: eq(savingsGoals.userId, userId),
    orderBy: desc(savingsGoals.createdAt),
  });
}

export async function createGoal(env: Env, userId: string, input: CreateGoal) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    name: input.name,
    icon: input.icon ?? "*",
    targetAmountMinor: input.targetAmountMinor,
    savedAmountMinor: input.savedAmountMinor ?? 0,
    currency: input.currency,
    targetDate: input.targetDate ?? null,
    notes: input.notes ?? null,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(savingsGoals).values(value);
  await audit(db, {
    userId,
    action: "CREATE",
    entityType: "SAVINGS_GOAL",
    entityId: value.id,
    newValue: input,
  });
  return value;
}

export async function getGoal(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.savingsGoals.findFirst({
    where: and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)),
  });
  if (!row) throw notFound("Goal");
  return row;
}

export async function listContributions(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select({
      id: goalContributions.id,
      goalId: goalContributions.goalId,
      goalName: savingsGoals.name,
      amountMinor: goalContributions.amountMinor,
      source: goalContributions.source,
      notes: goalContributions.notes,
      contributedAt: goalContributions.contributedAt,
    })
    .from(goalContributions)
    .innerJoin(savingsGoals, eq(savingsGoals.id, goalContributions.goalId))
    .where(eq(goalContributions.userId, userId))
    .orderBy(desc(goalContributions.contributedAt))
    .limit(20);
}

export async function addContribution(
  env: Env,
  userId: string,
  goalId: string,
  input: CreateContribution,
) {
  const goal = await getGoal(env, userId, goalId);
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    goalId,
    userId,
    amountMinor: input.amountMinor,
    source: "MANUAL",
    notes: input.notes ?? null,
    contributedAt: now(),
    createdAt: now(),
  };
  await db.insert(goalContributions).values(value);
  const nextSaved = nextGoalSaved(goal.savedAmountMinor, input.amountMinor);
  await db
    .update(savingsGoals)
    .set({ savedAmountMinor: nextSaved, updatedAt: now() })
    .where(eq(savingsGoals.id, goalId));
  await audit(db, {
    userId,
    action: "CREATE",
    entityType: "GOAL_CONTRIBUTION",
    entityId: value.id,
    newValue: input,
  });
  return { ...value, savedAmountMinor: nextSaved };
}

export async function updateGoal(
  env: Env,
  userId: string,
  id: string,
  input: Partial<CreateGoal> & { isActive?: boolean },
) {
  const existing = await getGoal(env, userId, id);
  const db = createDatabase(env.DB);
  const next = {
    name: input.name ?? existing.name,
    icon: input.icon ?? existing.icon,
    targetAmountMinor: input.targetAmountMinor ?? existing.targetAmountMinor,
    savedAmountMinor: input.savedAmountMinor ?? existing.savedAmountMinor,
    currency: input.currency ?? existing.currency,
    targetDate: input.targetDate === undefined ? existing.targetDate : input.targetDate,
    notes: input.notes === undefined ? existing.notes : input.notes,
    isActive: input.isActive ?? existing.isActive,
    updatedAt: now(),
  };
  await db
    .update(savingsGoals)
    .set(next)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  await audit(db, {
    userId,
    action: "UPDATE",
    entityType: "SAVINGS_GOAL",
    entityId: id,
    oldValue: existing,
    newValue: input,
  });
  return { ...existing, ...next };
}

export async function deleteGoal(env: Env, userId: string, id: string) {
  await getGoal(env, userId, id);
  const db = createDatabase(env.DB);
  await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  await audit(db, {
    userId,
    action: "DELETE",
    entityType: "SAVINGS_GOAL",
    entityId: id,
  });
}
