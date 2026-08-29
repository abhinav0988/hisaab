import { eq } from "drizzle-orm";
import { ACCOUNT_CATALOG } from "./defaults";
import type { Database } from "./db";
import { accountCatalog, accounts, userPreferences } from "./schema";

function stamp() {
  return new Date().toISOString();
}

function flagOn(value: unknown) {
  return value === true || Number(value) === 1;
}

export async function ensureAccountCatalog(db: Database) {
  const existing = await db.query.accountCatalog.findMany();
  if (existing.length) return existing;
  const now = stamp();
  await db
    .insert(accountCatalog)
    .values(
      ACCOUNT_CATALOG.map((item) => ({
        ...item,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
  return db.query.accountCatalog.findMany();
}

export async function provisionUserAccounts(db: Database, userId: string, currency?: string) {
  const catalog = (await ensureAccountCatalog(db)).filter((item) => flagOn(item.isActive));
  const existing = await db.query.accounts.findMany({
    where: eq(accounts.userId, userId),
  });
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  const resolvedCurrency = currency ?? prefs?.defaultCurrency ?? "INR";
  const now = stamp();
  for (const item of catalog) {
    const linked = existing.find((row) => row.catalogId === item.id);
    const byType = existing.filter((row) => row.type === item.type);
    const primary = linked ?? byType[0];
    if (primary) {
      if (primary.catalogId !== item.id || primary.name !== item.name || !flagOn(primary.isActive)) {
        await db
          .update(accounts)
          .set({
            catalogId: item.id,
            name: item.name,
            type: item.type,
            isActive: true,
            updatedAt: now,
          })
          .where(eq(accounts.id, primary.id));
        primary.catalogId = item.id;
        primary.name = item.name;
        primary.isActive = true;
      }
      for (const extra of byType) {
        if (extra.id === primary.id) continue;
        if (flagOn(extra.isActive)) {
          await db
            .update(accounts)
            .set({ isActive: false, updatedAt: now })
            .where(eq(accounts.id, extra.id));
          extra.isActive = false;
        }
      }
      continue;
    }
    await db
      .insert(accounts)
      .values({
        id: crypto.randomUUID(),
        userId,
        catalogId: item.id,
        name: item.name,
        type: item.type,
        institutionName: null,
        openingBalanceMinor: 0,
        currency: resolvedCurrency,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
}
