import {
  accountCatalog,
  accounts,
  createDatabase,
  ensureAccountCatalog,
  provisionUserAccounts,
  transactions,
} from "@hisaab/database";
import type { z } from "zod";
import type { accountPatchSchema } from "@hisaab/validation";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { AppError, audit, notFound, now } from "@hisaab/worker-lib";

type PatchAccount = z.infer<typeof accountPatchSchema>;

function flagOn(value: unknown) {
  return value === true || Number(value) === 1;
}

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
      currentBalanceMinor: sql<number>`${accounts.openingBalanceMinor} + coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else -${transactions.amountMinor} end), 0)`,
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
      and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)),
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

export function catalogOnlyError() {
  return new AppError(
    403,
    "ACCOUNT_CATALOG_ONLY",
    "Accounts are provided from the Hisaab catalog and cannot be created manually.",
  );
}
