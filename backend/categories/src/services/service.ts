import { categories, createDatabase } from "@hisaab/database";
import type { z } from "zod";
import type { categoryPatchSchema, categorySchema } from "@hisaab/validation";
import { and, eq, isNull, or } from "drizzle-orm";
import { audit, forbidden, newId, notFound, now } from "@hisaab/worker-lib";
import { canMutateCategory } from "../ownership";

type CreateCategory = z.infer<typeof categorySchema>;
type PatchCategory = z.infer<typeof categoryPatchSchema>;
export async function listCategories(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, userId)))
    .orderBy(categories.type, categories.name);
}
export async function createCategory(env: Env, userId: string, input: CreateCategory) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    ...input,
    isSystem: false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(categories).values(value);
  await audit(db, {
    userId,
    action: "CREATE",
    entityType: "CATEGORY",
    entityId: value.id,
    newValue: input,
  });
  return value;
}
async function ownCategory(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.categories.findFirst({ where: eq(categories.id, id) });
  if (!row || !canMutateCategory(row, userId)) {
    if (!row) throw notFound("Category");
    throw forbidden();
  }
  return row;
}
export async function updateCategory(env: Env, userId: string, id: string, input: PatchCategory) {
  const existing = await ownCategory(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .update(categories)
    .set({ ...input, updatedAt: now() })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  await audit(db, {
    userId,
    action: "UPDATE",
    entityType: "CATEGORY",
    entityId: id,
    oldValue: existing,
    newValue: input,
  });
  return { ...existing, ...input };
}
export async function deleteCategory(env: Env, userId: string, id: string) {
  await ownCategory(env, userId, id);
  const db = createDatabase(env.DB);
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  await audit(db, { userId, action: "DELETE", entityType: "CATEGORY", entityId: id });
}
