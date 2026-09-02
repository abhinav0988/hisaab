import { and, eq } from "drizzle-orm";
import type { Database } from "./db";
import { accounts, creditFacilities, creditUtilisationMonths } from "./schema";

export type CreditSpendImpact = {
  facilityId: string;
  kind: "CARD" | "UPI";
  name: string;
  spentMinor: number;
  usedMinor: number;
  availableMinor: number;
  pendingMinor: number;
  dueOn: string | null;
};

function facilityKind(accountType: string) {
  if (accountType === "CREDIT_CARD") return "CARD" as const;
  if (accountType === "UPI") return "UPI" as const;
  return null;
}

export function creditSpendDelta(type: string, amountMinor: number) {
  const amount = Math.max(0, Math.trunc(amountMinor) || 0);
  if (type === "EXPENSE") return amount;
  if (type === "INCOME") return -amount;
  return 0;
}

async function snapshotCardMonth(db: Database, userId: string) {
  const cards = await db
    .select()
    .from(creditFacilities)
    .where(and(eq(creditFacilities.userId, userId), eq(creditFacilities.kind, "CARD")));
  const month = new Date().toISOString().slice(0, 7);
  const usedMinor = cards.reduce((sum, item) => sum + item.usedMinor, 0);
  const limitMinor = cards.reduce((sum, item) => sum + item.limitMinor, 0);
  const overdueMinor = cards.reduce((sum, item) => sum + item.overdueMinor, 0);
  const stamp = new Date().toISOString();
  const existing = await db.query.creditUtilisationMonths.findFirst({
    where: and(eq(creditUtilisationMonths.userId, userId), eq(creditUtilisationMonths.month, month)),
  });
  if (existing) {
    await db
      .update(creditUtilisationMonths)
      .set({ usedMinor, limitMinor, overdueMinor, updatedAt: stamp })
      .where(eq(creditUtilisationMonths.id, existing.id));
    return;
  }
  await db.insert(creditUtilisationMonths).values({
    id: crypto.randomUUID(),
    userId,
    month,
    usedMinor,
    limitMinor,
    overdueMinor,
    createdAt: stamp,
    updatedAt: stamp,
  });
}

export async function adjustCreditSpend(
  db: Database,
  input: {
    userId: string;
    accountId: string;
    facilityId?: string | null;
    deltaMinor: number;
  },
): Promise<CreditSpendImpact | null> {
  if (!input.deltaMinor) return null;
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, input.accountId), eq(accounts.userId, input.userId)),
  });
  if (!account) return null;
  const kind = facilityKind(account.type);
  if (!kind) return null;
  if (kind === "CARD" && !input.facilityId && input.deltaMinor > 0) return null;
  if (kind === "UPI" && !input.facilityId) return null;
  const rows = await db
    .select()
    .from(creditFacilities)
    .where(and(eq(creditFacilities.userId, input.userId), eq(creditFacilities.kind, kind)));
  const preferred =
    (input.facilityId ? rows.find((row) => row.id === input.facilityId && row.kind === kind) : undefined) ??
    (kind === "CARD"
      ? (rows.find((row) => row.accountId === input.accountId) ??
        (rows.length === 1 ? rows[0] : undefined) ??
        rows[0])
      : undefined);
  if (!preferred) return null;
  const usedMinor = Math.max(0, preferred.usedMinor + input.deltaMinor);
  const todaySpendMinor = Math.max(0, preferred.todaySpendMinor + input.deltaMinor);
  const holdMinor = preferred.holdMinor ?? 0;
  const availableMinor = Math.max(0, preferred.limitMinor - usedMinor - holdMinor);
  const pendingMinor =
    preferred.overdueMinor > 0
      ? preferred.overdueMinor
      : (preferred.minDueMinor ?? 0) > 0
        ? preferred.minDueMinor
        : usedMinor;
  const stamp = new Date().toISOString();
  await db
    .update(creditFacilities)
    .set({
      usedMinor,
      todaySpendMinor,
      accountId: preferred.accountId ?? input.accountId,
      updatedAt: stamp,
    })
    .where(and(eq(creditFacilities.id, preferred.id), eq(creditFacilities.userId, input.userId)));
  if (kind === "CARD") await snapshotCardMonth(db, input.userId);
  return {
    facilityId: preferred.id,
    kind,
    name: preferred.name,
    spentMinor: Math.max(0, input.deltaMinor),
    usedMinor,
    availableMinor,
    pendingMinor,
    dueOn: preferred.dueOn,
  };
}
