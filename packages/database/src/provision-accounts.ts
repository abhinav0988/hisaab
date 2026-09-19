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

/** Catalog stub vs a bank the user explicitly linked on the Bank page. */
function isUserLinkedBank(row: {
  type: string;
  catalogId: string | null;
  institutionName: string | null;
  name: string;
}) {
  if (row.type !== "BANK") return false;
  if (!row.catalogId) return true;
  return Boolean(row.institutionName?.trim());
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
    // Never adopt a user-linked bank (custom institution / null catalog) as the catalog stub.
    const pristineByType = existing.find(
      (row) =>
        row.type === item.type &&
        !isUserLinkedBank(row) &&
        (row.catalogId === item.id || row.name === item.name),
    );
    const primary = linked ?? pristineByType;
    if (primary) {
      const patch: {
        catalogId?: string;
        name?: string;
        type?: typeof item.type;
        isActive?: boolean;
        updatedAt: string;
      } = { updatedAt: now };
      if (primary.catalogId !== item.id) patch.catalogId = item.id;
      if (!flagOn(primary.isActive)) patch.isActive = true;
      // Only restore the catalog label on an uncustomized stub — never wipe bank edits.
      if (!isUserLinkedBank(primary) && primary.name !== item.name) {
        patch.name = item.name;
      }
      if (patch.catalogId || patch.name || patch.isActive !== undefined) {
        await db
          .update(accounts)
          .set({
            ...(patch.catalogId ? { catalogId: patch.catalogId } : {}),
            ...(patch.name ? { name: patch.name } : {}),
            type: item.type,
            ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
            updatedAt: now,
          })
          .where(eq(accounts.id, primary.id));
        if (patch.catalogId) primary.catalogId = patch.catalogId;
        if (patch.name) primary.name = patch.name;
        if (patch.isActive !== undefined) primary.isActive = patch.isActive;
      }
      for (const extra of byTypeExtras(existing, item.type, primary.id)) {
        if (!extra.catalogId) continue;
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

function byTypeExtras(
  existing: Array<{ id: string; type: string; catalogId: string | null; isActive: boolean | number }>,
  type: string,
  primaryId: string,
) {
  return existing.filter((row) => row.type === type && row.id !== primaryId);
}
