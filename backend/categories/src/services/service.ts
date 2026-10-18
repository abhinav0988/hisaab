import { categories, createDatabase } from "@hisaab/database";
import type { z } from "zod";
import type { categoryPatchSchema, categorySchema } from "@hisaab/validation";
import { and, eq, isNull, or } from "drizzle-orm";
import { AppError, audit, forbidden, newId, notFound, now } from "@hisaab/worker-lib";
import { canMutateCategory } from "../ownership";

type CreateCategory = z.infer<typeof categorySchema>;
type PatchCategory = z.infer<typeof categoryPatchSchema>;

async function assertParent(
  env: Env,
  userId: string,
  parentId: string | null | undefined,
  type: string,
) {
  if (!parentId) return null;
  const db = createDatabase(env.DB);
  const parent = await db.query.categories.findFirst({ where: eq(categories.id, parentId) });
  if (!parent || (parent.userId && parent.userId !== userId && !parent.isSystem)) {
    throw notFound("Parent category");
  }
  if (parent.parentId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Subcategories can only nest one level under a top-level category.",
    );
  }
  if (parent.type !== type) {
    throw new AppError(400, "VALIDATION_ERROR", "Subcategory type must match the parent category type.");
  }
  return parent;
}

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
  await assertParent(env, userId, input.parentId, input.type);
  const value = {
    id: newId(),
    userId,
    parentId: input.parentId ?? null,
    name: input.name,
    type: input.type,
    icon: input.icon,
    colour: input.colour,
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
  const nextType = input.type ?? existing.type;
  if (input.parentId !== undefined) {
    if (input.parentId === id) {
      throw new AppError(400, "VALIDATION_ERROR", "A category cannot be its own parent.");
    }
    await assertParent(env, userId, input.parentId, nextType);
  }
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
