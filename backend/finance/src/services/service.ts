import {
  accounts,
  createDatabase,
  creditFacilities,
  investments,
  ipoApplications,
  lendRecords,
  loans,
} from "@hisaab/database";
import type {
  creditFacilityKindSchema,
  creditFacilityPatchSchema,
  creditFacilitySchema,
  investmentPatchSchema,
  investmentSchema,
  ipoPatchSchema,
  ipoSchema,
  lendRecordPatchSchema,
  lendRecordSchema,
  loanPatchSchema,
  loanSchema,
} from "@hisaab/validation";
import { AppError, newId, notFound, now } from "@hisaab/worker-lib";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";

type InvestmentInput = z.infer<typeof investmentSchema>;
type InvestmentPatch = z.infer<typeof investmentPatchSchema>;
type IpoInput = z.infer<typeof ipoSchema>;
type IpoPatch = z.infer<typeof ipoPatchSchema>;
type LoanInput = z.infer<typeof loanSchema>;
type LoanPatch = z.infer<typeof loanPatchSchema>;
type CreditInput = z.infer<typeof creditFacilitySchema>;
type CreditPatch = z.infer<typeof creditFacilityPatchSchema>;
type LendInput = z.infer<typeof lendRecordSchema>;
type LendPatch = z.infer<typeof lendRecordPatchSchema>;
type CreditKind = z.infer<typeof creditFacilityKindSchema>;

function defined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export async function listInvestments(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(investments)
    .where(eq(investments.userId, userId))
    .orderBy(desc(investments.createdAt));
}

export async function getInvestment(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.investments.findFirst({
    where: and(eq(investments.id, id), eq(investments.userId, userId)),
  });
  if (!row) throw notFound("Investment");
  return row;
}

export async function createInvestment(env: Env, userId: string, input: InvestmentInput) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    name: input.name,
    type: input.type,
    detail: input.detail ?? null,
    investedMinor: input.investedMinor,
    currentMinor: input.currentMinor,
    sipMinor: input.sipMinor ?? 0,
    sipDay: input.sipDay ?? null,
    currency: input.currency,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(investments).values(value);
  return value;
}

export async function updateInvestment(env: Env, userId: string, id: string, input: InvestmentPatch) {
  const existing = await getInvestment(env, userId, id);
  const db = createDatabase(env.DB);
  const changes = { ...defined(input), updatedAt: now() };
  await db
    .update(investments)
    .set(changes)
    .where(and(eq(investments.id, id), eq(investments.userId, userId)));
  return { ...existing, ...changes };
}

export async function deleteInvestment(env: Env, userId: string, id: string) {
  await getInvestment(env, userId, id);
  const db = createDatabase(env.DB);
  await db.delete(investments).where(and(eq(investments.id, id), eq(investments.userId, userId)));
}

export async function listIpos(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(ipoApplications)
    .where(eq(ipoApplications.userId, userId))
    .orderBy(desc(ipoApplications.createdAt));
}

export async function getIpo(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.ipoApplications.findFirst({
    where: and(eq(ipoApplications.id, id), eq(ipoApplications.userId, userId)),
  });
  if (!row) throw notFound("IPO application");
  return row;
}

export async function createIpo(env: Env, userId: string, input: IpoInput) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    name: input.name,
    appliedOn: input.appliedOn,
    allotmentOn: input.allotmentOn ?? null,
    amountMinor: input.amountMinor,
    lots: input.lots,
    status: input.status,
    currency: input.currency,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(ipoApplications).values(value);
  return value;
}

export async function updateIpo(env: Env, userId: string, id: string, input: IpoPatch) {
  const existing = await getIpo(env, userId, id);
  const db = createDatabase(env.DB);
  const changes = { ...defined(input), updatedAt: now() };
  await db
    .update(ipoApplications)
    .set(changes)
    .where(and(eq(ipoApplications.id, id), eq(ipoApplications.userId, userId)));
  return { ...existing, ...changes };
}

export async function deleteIpo(env: Env, userId: string, id: string) {
  await getIpo(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .delete(ipoApplications)
    .where(and(eq(ipoApplications.id, id), eq(ipoApplications.userId, userId)));
}

export async function listLoans(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db.select().from(loans).where(eq(loans.userId, userId)).orderBy(desc(loans.createdAt));
}

export async function getLoan(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.loans.findFirst({
    where: and(eq(loans.id, id), eq(loans.userId, userId)),
  });
  if (!row) throw notFound("Loan");
  return row;
}

export async function createLoan(env: Env, userId: string, input: LoanInput) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    name: input.name,
    lender: input.lender,
    rate: input.rate,
    emiMinor: input.emiMinor,
    outstandingMinor: input.outstandingMinor,
    dueOn: input.dueOn,
    remainingEmis: input.remainingEmis ?? 0,
    progress: input.progress ?? 0,
    currency: input.currency,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(loans).values(value);
  return value;
}

export async function updateLoan(env: Env, userId: string, id: string, input: LoanPatch) {
  const existing = await getLoan(env, userId, id);
  const db = createDatabase(env.DB);
  const changes = { ...defined(input), updatedAt: now() };
  await db.update(loans).set(changes).where(and(eq(loans.id, id), eq(loans.userId, userId)));
  return { ...existing, ...changes };
}

export async function deleteLoan(env: Env, userId: string, id: string) {
  await getLoan(env, userId, id);
  const db = createDatabase(env.DB);
  await db.delete(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
}

async function assertOwnAccount(env: Env, userId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const db = createDatabase(env.DB);
  const row = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.userId, userId)),
  });
  if (!row) throw new AppError(400, "INVALID_ACCOUNT", "Select one of your accounts.");
}

export async function listCreditFacilities(env: Env, userId: string, kind?: CreditKind) {
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(creditFacilities)
    .where(
      kind
        ? and(eq(creditFacilities.userId, userId), eq(creditFacilities.kind, kind))
        : eq(creditFacilities.userId, userId),
    )
    .orderBy(desc(creditFacilities.createdAt));
}

export async function getCreditFacility(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.creditFacilities.findFirst({
    where: and(eq(creditFacilities.id, id), eq(creditFacilities.userId, userId)),
  });
  if (!row) throw notFound("Credit facility");
  return row;
}

export async function createCreditFacility(env: Env, userId: string, input: CreditInput) {
  await assertOwnAccount(env, userId, input.accountId);
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    kind: input.kind,
    name: input.name,
    provider: input.provider ?? null,
    mask: input.mask ?? null,
    accountId: input.accountId ?? null,
    limitMinor: input.limitMinor,
    usedMinor: input.usedMinor ?? 0,
    todaySpendMinor: input.todaySpendMinor ?? 0,
    overdueMinor: input.overdueMinor ?? 0,
    dueOn: input.dueOn ?? null,
    currency: input.currency,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(creditFacilities).values(value);
  return value;
}

export async function updateCreditFacility(env: Env, userId: string, id: string, input: CreditPatch) {
  const existing = await getCreditFacility(env, userId, id);
  if (input.accountId !== undefined) await assertOwnAccount(env, userId, input.accountId);
  const db = createDatabase(env.DB);
  const changes = { ...defined(input), updatedAt: now() };
  await db
    .update(creditFacilities)
    .set(changes)
    .where(and(eq(creditFacilities.id, id), eq(creditFacilities.userId, userId)));
  return { ...existing, ...changes };
}

export async function deleteCreditFacility(env: Env, userId: string, id: string) {
  await getCreditFacility(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .delete(creditFacilities)
    .where(and(eq(creditFacilities.id, id), eq(creditFacilities.userId, userId)));
}

export async function listLendRecords(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select()
    .from(lendRecords)
    .where(eq(lendRecords.userId, userId))
    .orderBy(desc(lendRecords.createdAt));
}

export async function getLendRecord(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.lendRecords.findFirst({
    where: and(eq(lendRecords.id, id), eq(lendRecords.userId, userId)),
  });
  if (!row) throw notFound("Lend record");
  return row;
}

export async function createLendRecord(env: Env, userId: string, input: LendInput) {
  const db = createDatabase(env.DB);
  const value = {
    id: newId(),
    userId,
    person: input.person,
    relation: input.relation ?? null,
    kind: input.kind,
    amountMinor: input.amountMinor,
    givenOn: input.givenOn,
    dueOn: input.dueOn,
    status: input.status ?? "pending",
    currency: input.currency,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(lendRecords).values(value);
  return value;
}

export async function updateLendRecord(env: Env, userId: string, id: string, input: LendPatch) {
  const existing = await getLendRecord(env, userId, id);
  const db = createDatabase(env.DB);
  const changes = { ...defined(input), updatedAt: now() };
  await db
    .update(lendRecords)
    .set(changes)
    .where(and(eq(lendRecords.id, id), eq(lendRecords.userId, userId)));
  return { ...existing, ...changes };
}

export async function deleteLendRecord(env: Env, userId: string, id: string) {
  await getLendRecord(env, userId, id);
  const db = createDatabase(env.DB);
  await db.delete(lendRecords).where(and(eq(lendRecords.id, id), eq(lendRecords.userId, userId)));
}
