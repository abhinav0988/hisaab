import {
  accountCatalog,
  accounts,
  accountBalanceMinorSql,
  createDatabase,
  ensureAccountCatalog,
  provisionUserAccounts,
  transactions,
  userPreferences,
} from "@hisaab/database";
import type { z } from "zod";
import type { accountPatchSchema, accountSchema } from "@hisaab/validation";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { AppError, audit, notFound, now } from "@hisaab/worker-lib";
import { flagOn } from "../flags";

type PatchAccount = z.infer<typeof accountPatchSchema>;
type CreateAccount = z.infer<typeof accountSchema>;

export async function listAccountCatalog(env: Env) {
  const db = createDatabase(env.DB);
  await ensureAccountCatalog(db);
  const rows = await db
    .select()
    .from(accountCatalog)
    .orderBy(asc(accountCatalog.sortOrder), asc(accountCatalog.name));
  return rows
    .filter((item) => flagOn(item.isActive))
    .map((item) => ({
      ...item,
      isActive: true,
      sortOrder: Number(item.sortOrder ?? 0),
    }));
}

export async function listAccounts(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  await provisionUserAccounts(db, userId);
  const rows = await db
    .select({
      id: accounts.id,
      catalogId: accounts.catalogId,
      name: accounts.name,
      type: accounts.type,
      institutionName: accounts.institutionName,
      openingBalanceMinor: accounts.openingBalanceMinor,
      currentBalanceMinor: accountBalanceMinorSql,
      currency: accounts.currency,
      isActive: accounts.isActive,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      sortOrder: sql<number>`coalesce(${accountCatalog.sortOrder}, 99)`,
    })
    .from(accounts)
    .leftJoin(accountCatalog, eq(accounts.catalogId, accountCatalog.id))
    .leftJoin(
      transactions,
      and(
        isNull(transactions.deletedAt),
        or(
          eq(transactions.accountId, accounts.id),
          eq(transactions.destinationAccountId, accounts.id),
        ),
      ),
    )
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(sql`coalesce(${accountCatalog.sortOrder}, 99)`, accounts.name)
    .then((items) =>
      items.map((row) => ({
        ...row,
        isActive: Number(row.isActive) === 1,
        currentBalanceMinor: Number(row.currentBalanceMinor ?? 0),
        sortOrder: Number(row.sortOrder ?? 99),
      })),
    );
  const catalogued = rows.filter((item) => item.catalogId && item.isActive);
  const pool = catalogued.length ? catalogued : rows.filter((item) => item.isActive);
  const seen = new Set<string>();
  const unique = [];
  for (const row of pool) {
    const key = (row.catalogId || row.type).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const account = { ...row };
    delete (account as { sortOrder?: number }).sortOrder;
    unique.push(account);
  }
  return unique;
}
export async function getAccount(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, id), eq(accounts.userId, userId)),
  });
  if (!row) throw notFound("Account");
  const listed = (await listAccounts(env, userId)).find((item) => item.id === id);
  if (listed) return listed;
  return {
    ...row,
    isActive: Number(row.isActive) === 1,
    currentBalanceMinor: Number(row.openingBalanceMinor ?? 0),
  };
}
export async function updateAccount(env: Env, userId: string, id: string, input: PatchAccount) {
  const db = createDatabase(env.DB);
  const existing = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, id), eq(accounts.userId, userId)),
  });
  if (!existing) throw notFound("Account");
  await db
    .update(accounts)
    .set({ ...input, updatedAt: now() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  await audit(db, {
    userId,
    action: "UPDATE",
    entityType: "ACCOUNT",
    entityId: id,
    oldValue: { name: existing.name },
    newValue: input,
  });
  return getAccount(env, userId, id);
}
export async function deactivateAccount(env: Env, userId: string, id: string) {
  return updateAccount(env, userId, id, { isActive: false });
}

export async function listBankAccounts(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  await provisionUserAccounts(db, userId);
  const rows = await db
    .select({
      id: accounts.id,
      catalogId: accounts.catalogId,
      name: accounts.name,
      type: accounts.type,
      institutionName: accounts.institutionName,
      openingBalanceMinor: accounts.openingBalanceMinor,
      currentBalanceMinor: accountBalanceMinorSql,
      currency: accounts.currency,
      isActive: accounts.isActive,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        isNull(transactions.deletedAt),
        or(
          eq(transactions.accountId, accounts.id),
          eq(transactions.destinationAccountId, accounts.id),
        ),
      ),
    )
    .where(and(eq(accounts.userId, userId), eq(accounts.type, "BANK")))
    .groupBy(accounts.id)
    .orderBy(accounts.name)
    .then((items) =>
      items
        .filter((item) => Number(item.isActive) === 1)
        .map((row) => ({
          ...row,
          isActive: true,
          currentBalanceMinor: Number(row.currentBalanceMinor ?? 0),
        })),
    );
  return rows;
}

export async function createBankAccount(env: Env, userId: string, input: CreateAccount) {
  if (input.type !== "BANK") {
    throw new AppError(400, "INVALID_ACCOUNT_TYPE", "Only bank accounts can be added here.");
  }
  const db = createDatabase(env.DB);
  await provisionUserAccounts(db, userId);
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  const value = {
    id: crypto.randomUUID(),
    userId,
    catalogId: null,
    name: input.name,
    type: "BANK" as const,
    institutionName: input.institutionName ?? null,
    openingBalanceMinor: input.openingBalanceMinor,
    currency: input.currency ?? prefs?.defaultCurrency ?? "INR",
    isActive: input.isActive ?? true,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(accounts).values(value);
  await audit(db, {
    userId,
    action: "CREATE",
    entityType: "ACCOUNT",
    entityId: value.id,
    newValue: { name: value.name, type: value.type, institutionName: value.institutionName },
  });
  return {
    ...value,
    currentBalanceMinor: value.openingBalanceMinor,
  };
}

export function catalogOnlyError() {
  return new AppError(
    403,
    "ACCOUNT_CATALOG_ONLY",
    "Accounts are provided from the Hisaab catalog and cannot be created manually.",
  );
}
