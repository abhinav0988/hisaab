import { accounts, accountBalanceMinorSql, createDatabase, transactions } from "@hisaab/database";
import type { z } from "zod";
import type { accountSchema, accountPatchSchema } from "@hisaab/validation";
import { and, eq, isNull } from "drizzle-orm";
import { audit } from "../../shared/audit";
import { notFound } from "../../shared/errors";
import { newId, now } from "../../shared/http";

type CreateAccount = z.infer<typeof accountSchema>;
type PatchAccount = z.infer<typeof accountPatchSchema>;
export async function listAccounts(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select({
      id: accounts.id,
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
      and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)),
    )
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(accounts.name);
}
export async function getAccount(env: Env, userId: string, id: string) {
  const row = (await listAccounts(env, userId)).find((item) => item.id === id);
  if (!row) throw notFound("Account");
  return row;
}
export async function createAccount(env: Env, userId: string, input: CreateAccount) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    ...input,
    institutionName: input.institutionName ?? null,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(accounts).values(value);
  await audit(db, {
    userId,
    action: "CREATE",
    entityType: "ACCOUNT",
    entityId: value.id,
    newValue: { name: value.name, type: value.type },
  });
  return { ...value, currentBalanceMinor: value.openingBalanceMinor };
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
