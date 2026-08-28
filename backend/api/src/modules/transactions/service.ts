import {
  accounts,
  categories,
  createDatabase,
  tags,
  transactionTags,
  transactions,
  userPreferences,
} from "@hisaab/database";
import type {
  transactionPatchSchema,
  transactionQuerySchema,
  transactionSchema,
} from "@hisaab/validation";
import type { z } from "zod";
import { and, eq, isNull, or } from "drizzle-orm";
import { audit } from "../../shared/audit";
import { AppError, notFound } from "../../shared/errors";
import { newId, now } from "../../shared/http";

type CreateTransaction = z.infer<typeof transactionSchema>;
type PatchTransaction = z.infer<typeof transactionPatchSchema>;
type Query = z.infer<typeof transactionQuerySchema>;
async function validateReferences(
  env: Env,
  userId: string,
  input: { accountId: string; categoryId: string; type: string; currency: string },
) {
  const db = createDatabase(env.DB);
  const [account, category, preferences] = await Promise.all([
    db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, input.accountId),
        eq(accounts.userId, userId),
        eq(accounts.isActive, true),
      ),
    }),
    db.query.categories.findFirst({
      where: and(
        eq(categories.id, input.categoryId),
        or(isNull(categories.userId), eq(categories.userId, userId)),
      ),
    }),
    db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) }),
  ]);
  if (!account) throw new AppError(400, "INVALID_ACCOUNT", "Select one of your active accounts.");
  if (!category || category.type !== input.type)
    throw new AppError(400, "INVALID_CATEGORY", "Select a category matching the transaction type.");
  const currency = preferences?.defaultCurrency ?? account.currency;
  if (input.currency !== currency || account.currency !== currency)
    throw new AppError(400, "CURRENCY_MISMATCH", `Transactions must use ${currency}.`);
}

export async function listTransactions(env: Env, userId: string, query: Query) {
  const conditions = ["t.user_id = ?", "t.deleted_at IS NULL"];
  const values: unknown[] = [userId];
  if (query.from) {
    conditions.push("t.transaction_at >= ?");
    values.push(query.from);
  }
  if (query.to) {
    conditions.push("t.transaction_at < ?");
    values.push(query.to);
  }
  if (query.category_id) {
    conditions.push("t.category_id = ?");
    values.push(query.category_id);
  }
  if (query.account_id) {
    conditions.push("t.account_id = ?");
    values.push(query.account_id);
  }
  if (query.type) {
    conditions.push("t.type = ?");
    values.push(query.type);
  }
  if (query.search) {
    conditions.push("(t.merchant LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\')");
    const term = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
    values.push(term, term);
  }
  const order = {
    newest: "t.transaction_at DESC",
    oldest: "t.transaction_at ASC",
    amount_desc: "t.amount_minor DESC",
    amount_asc: "t.amount_minor ASC",
  }[query.sort];
  const where = conditions.join(" AND ");
  const offset = (query.page - 1) * query.limit;
  const statement = `SELECT t.id, t.account_id AS accountId, t.category_id AS categoryId, t.type, t.amount_minor AS amountMinor, t.currency, t.merchant, t.notes, t.transaction_at AS transactionAt, a.name AS accountName, c.name AS categoryName, c.icon AS categoryIcon, c.colour AS categoryColour FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN categories c ON c.id=t.category_id WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`;
  const [rows, count] = await Promise.all([
    env.DB.prepare(statement)
      .bind(...values, query.limit, offset)
      .all(),
    env.DB.prepare(`SELECT count(*) AS total FROM transactions t WHERE ${where}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);
  const total = count?.total ?? 0;
  return {
    items: rows.results,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getTransaction(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.id, id),
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ),
  });
  if (!row) throw notFound("Transaction");
  return row;
}
export async function createTransaction(env: Env, userId: string, input: CreateTransaction) {
  await validateReferences(env, userId, input);
  const db = createDatabase(env.DB);
  const { tags: tagNames, ...data } = input;
  delete data.recurring;
  const value = {
    id: newId(),
    userId,
    ...data,
    merchant: data.merchant ?? null,
    notes: data.notes ?? null,
    recurringTransactionId: null,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  await db.insert(transactions).values(value);
  for (const name of [...new Set(tagNames ?? [])]) {
    let tag = await db.query.tags.findFirst({
      where: and(eq(tags.userId, userId), eq(tags.name, name)),
    });
    if (!tag) {
      tag = { id: newId(), userId, name, createdAt: now() };
      await db.insert(tags).values(tag);
    }
    await db
      .insert(transactionTags)
      .values({ transactionId: value.id, tagId: tag.id })
      .onConflictDoNothing();
  }
  await audit(db, {
    userId,
    action: "CREATE",
    entityType: "TRANSACTION",
    entityId: value.id,
    newValue: {
      type: value.type,
      amountMinor: value.amountMinor,
      accountId: value.accountId,
      categoryId: value.categoryId,
    },
  });
  return value;
}
export async function updateTransaction(
  env: Env,
  userId: string,
  id: string,
  input: PatchTransaction,
) {
  const existing = await getTransaction(env, userId, id);
  const merged = {
    accountId: input.accountId ?? existing.accountId,
    categoryId: input.categoryId ?? existing.categoryId,
    type: input.type ?? existing.type,
    currency: input.currency ?? existing.currency,
  };
  await validateReferences(env, userId, merged);
  const db = createDatabase(env.DB);
  const { tags: tagNames, ...data } = input;
  delete data.recurring;
  await db
    .update(transactions)
    .set({ ...data, updatedAt: now() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  if (tagNames) {
    await db.delete(transactionTags).where(eq(transactionTags.transactionId, id));
    for (const name of [...new Set(tagNames)]) {
      let tag = await db.query.tags.findFirst({
        where: and(eq(tags.userId, userId), eq(tags.name, name)),
      });
      if (!tag) {
        tag = { id: newId(), userId, name, createdAt: now() };
        await db.insert(tags).values(tag);
      }
      await db
        .insert(transactionTags)
        .values({ transactionId: id, tagId: tag.id })
        .onConflictDoNothing();
    }
  }
  await audit(db, {
    userId,
    action: "UPDATE",
    entityType: "TRANSACTION",
    entityId: id,
    oldValue: { type: existing.type, amountMinor: existing.amountMinor },
    newValue: data,
  });
  return getTransaction(env, userId, id);
}
export async function deleteTransaction(env: Env, userId: string, id: string) {
  await getTransaction(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .update(transactions)
    .set({ deletedAt: now(), updatedAt: now() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  await audit(db, { userId, action: "DELETE", entityType: "TRANSACTION", entityId: id });
}
