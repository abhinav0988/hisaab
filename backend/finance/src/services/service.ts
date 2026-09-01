import {
  accounts,
  createDatabase,
  creditFacilities,
  creditUtilisationMonths,
  investments,
  ipoApplications,
  lendRecords,
  loans,
  userPreferences,
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
import {
  applyCardPayment,
  applyPaidEmi,
  cardPaidThisCycle,
  creditOverview,
  loanSchedule,
  loanSummary,
} from "@hisaab/validation";
import { AppError, currentMonth, monthBounds, newId, notFound, now } from "@hisaab/worker-lib";
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

function derivedLoanFields(input: {
  principalMinor: number;
  emiMinor: number;
  totalEmis: number;
  remainingEmis: number;
  emiDay: number;
}) {
  const summary = loanSummary(input);
  return {
    outstandingMinor: summary.remainingPayableMinor,
    dueOn: summary.nextDue,
    progress: Math.min(100, Math.max(0, Math.round(summary.completionPct))),
  };
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

export async function getLoanSchedule(env: Env, userId: string, id: string) {
  const loan = await getLoan(env, userId, id);
  return {
    loanId: loan.id,
    items: loanSchedule({
      emiMinor: loan.emiMinor,
      totalEmis: loan.totalEmis,
      remainingEmis: loan.remainingEmis,
      dueOn: loan.dueOn,
    }),
  };
}

export async function payLoanEmi(env: Env, userId: string, id: string) {
  const existing = await getLoan(env, userId, id);
  const paid = applyPaidEmi({
    remainingEmis: existing.remainingEmis,
    dueOn: existing.dueOn,
    emiMinor: existing.emiMinor,
    principalMinor: existing.principalMinor,
    totalEmis: existing.totalEmis,
    emiDay: existing.emiDay,
  });
  if (!paid) throw new AppError(400, "EMI_PAID", "All EMIs on this loan are already paid.");
  const db = createDatabase(env.DB);
  const changes = {
    remainingEmis: paid.remainingEmis,
    dueOn: paid.dueOn,
    outstandingMinor: paid.outstandingMinor,
    progress: paid.progress,
    updatedAt: now(),
  };
  await db.update(loans).set(changes).where(and(eq(loans.id, id), eq(loans.userId, userId)));
  return { ...existing, ...changes };
}

export async function createLoan(env: Env, userId: string, input: LoanInput) {
  const db = createDatabase(env.DB);
  const remainingEmis = input.remainingEmis;
  const totalEmis = input.totalEmis;
  const derived = derivedLoanFields({
    principalMinor: input.principalMinor,
    emiMinor: input.emiMinor,
    totalEmis,
    remainingEmis,
    emiDay: input.emiDay,
  });
  const value = {
    id: newId(),
    userId,
    name: input.name,
    lender: input.lender,
    rate: input.rate ?? "",
    principalMinor: input.principalMinor,
    emiMinor: input.emiMinor,
    outstandingMinor: derived.outstandingMinor,
    dueOn: derived.dueOn,
    totalEmis,
    remainingEmis,
    emiDay: input.emiDay,
    progress: derived.progress,
    currency: input.currency,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(loans).values(value);
  return value;
}

export async function updateLoan(env: Env, userId: string, id: string, input: LoanPatch) {
  const existing = await getLoan(env, userId, id);
  const merged = {
    name: input.name ?? existing.name,
    lender: input.lender ?? existing.lender,
    rate: input.rate ?? existing.rate,
    principalMinor: input.principalMinor ?? existing.principalMinor,
    emiMinor: input.emiMinor ?? existing.emiMinor,
    totalEmis: input.totalEmis ?? existing.totalEmis,
    remainingEmis: input.remainingEmis ?? existing.remainingEmis,
    emiDay: input.emiDay ?? existing.emiDay,
    currency: input.currency ?? existing.currency,
  };
  if (merged.totalEmis > 0 && merged.remainingEmis > merged.totalEmis) {
    throw new AppError(400, "INVALID_LOAN", "Remaining EMIs cannot exceed total EMIs.");
  }
  const derived = derivedLoanFields(merged);
  const db = createDatabase(env.DB);
  const changes = { ...merged, ...derived, updatedAt: now() };
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

async function userTimezone(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  return prefs?.timezone ?? "UTC";
}

async function snapshotCardUtilisation(env: Env, userId: string) {
  const cards = await listCreditFacilities(env, userId, "CARD");
  const month = currentMonth(await userTimezone(env, userId));
  const usedMinor = cards.reduce((sum, item) => sum + item.usedMinor, 0);
  const limitMinor = cards.reduce((sum, item) => sum + item.limitMinor, 0);
  const overdueMinor = cards.reduce((sum, item) => sum + item.overdueMinor, 0);
  const db = createDatabase(env.DB);
  const existing = await db.query.creditUtilisationMonths.findFirst({
    where: and(eq(creditUtilisationMonths.userId, userId), eq(creditUtilisationMonths.month, month)),
  });
  if (existing) {
    await db
      .update(creditUtilisationMonths)
      .set({ usedMinor, limitMinor, overdueMinor, updatedAt: now() })
      .where(eq(creditUtilisationMonths.id, existing.id));
    return;
  }
  await db.insert(creditUtilisationMonths).values({
    id: newId(),
    userId,
    month,
    usedMinor,
    limitMinor,
    overdueMinor,
    createdAt: now(),
    updatedAt: now(),
  });
}

async function cardSpending(env: Env, userId: string) {
  const timezone = await userTimezone(env, userId);
  const bounds = monthBounds(currentMonth(timezone), timezone);
  const rows = await env.DB.prepare(
    `SELECT c.id AS id, c.name AS name, c.colour AS colour, coalesce(sum(t.amount_minor),0) AS amountMinor
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ?
       AND t.deleted_at IS NULL
       AND t.type = 'EXPENSE'
       AND t.transaction_at >= ?
       AND t.transaction_at < ?
       AND t.account_id IN (
         SELECT id FROM accounts WHERE user_id = ? AND type = 'CREDIT_CARD'
         UNION
         SELECT account_id FROM credit_facilities
         WHERE user_id = ? AND kind = 'CARD' AND account_id IS NOT NULL
       )
     GROUP BY c.id
     ORDER BY amountMinor DESC`,
  )
    .bind(userId, bounds.from, bounds.to, userId, userId)
    .all<{ id: string; name: string; colour: string | null; amountMinor: number }>();
  return (rows.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    colour: row.colour,
    amountMinor: Number(row.amountMinor ?? 0),
  }));
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
    holdMinor: input.holdMinor ?? 0,
    minDueMinor: input.minDueMinor ?? 0,
    dueOn: input.dueOn ?? null,
    cycleStartOn: input.cycleStartOn ?? null,
    lastPaidOn: null as string | null,
    currency: input.currency,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.insert(creditFacilities).values(value);
  if (value.kind === "CARD") await snapshotCardUtilisation(env, userId);
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
  const next = { ...existing, ...changes };
  if (next.kind === "CARD") await snapshotCardUtilisation(env, userId);
  return next;
}

export async function deleteCreditFacility(env: Env, userId: string, id: string) {
  const existing = await getCreditFacility(env, userId, id);
  const db = createDatabase(env.DB);
  await db
    .delete(creditFacilities)
    .where(and(eq(creditFacilities.id, id), eq(creditFacilities.userId, userId)));
  if (existing.kind === "CARD") await snapshotCardUtilisation(env, userId);
}

export async function payCreditFacility(env: Env, userId: string, id: string) {
  const existing = await getCreditFacility(env, userId, id);
  if (existing.kind !== "CARD") {
    throw new AppError(400, "NOT_A_CARD", "Only credit cards can be marked as paid.");
  }
  if (cardPaidThisCycle(existing.lastPaidOn, existing.dueOn)) {
    throw new AppError(400, "CARD_PAID", "This card's due is already marked paid for this cycle.");
  }
  const paid = applyCardPayment({
    usedMinor: existing.usedMinor,
    overdueMinor: existing.overdueMinor,
    minDueMinor: existing.minDueMinor,
    dueOn: existing.dueOn,
    lastPaidOn: existing.lastPaidOn,
  });
  if (!paid) {
    throw new AppError(400, "NOTHING_DUE", "Add a minimum due or overdue amount before marking this paid.");
  }
  const db = createDatabase(env.DB);
  const changes = {
    usedMinor: paid.usedMinor,
    overdueMinor: paid.overdueMinor,
    lastPaidOn: paid.lastPaidOn,
    dueOn: paid.dueOn,
    updatedAt: now(),
  };
  await db
    .update(creditFacilities)
    .set(changes)
    .where(and(eq(creditFacilities.id, id), eq(creditFacilities.userId, userId)));
  await snapshotCardUtilisation(env, userId);
  return { ...existing, ...changes };
}

export async function getCreditDashboard(env: Env, userId: string) {
  const cards = await listCreditFacilities(env, userId, "CARD");
  const overview = creditOverview({
    limitMinor: cards.reduce((sum, item) => sum + item.limitMinor, 0),
    usedMinor: cards.reduce((sum, item) => sum + item.usedMinor, 0),
    overdueMinor: cards.reduce((sum, item) => sum + item.overdueMinor, 0),
  });
  const db = createDatabase(env.DB);
  const months = await db
    .select()
    .from(creditUtilisationMonths)
    .where(eq(creditUtilisationMonths.userId, userId))
    .orderBy(creditUtilisationMonths.month);
  const trend = months.slice(-6).map((row) => ({
    month: row.month,
    usedMinor: row.usedMinor,
    limitMinor: row.limitMinor,
    overdueMinor: row.overdueMinor,
    usedPct: creditOverview({
      limitMinor: row.limitMinor,
      usedMinor: row.usedMinor,
      overdueMinor: row.overdueMinor,
    }).usedPct,
  }));
  return { cards, overview, trend, spending: await cardSpending(env, userId) };
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
