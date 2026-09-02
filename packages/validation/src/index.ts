import { z } from "zod";

export const currencySchema = z.enum(["INR", "NPR", "PKR", "BDT", "USD"]);
export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export const accountTypeSchema = z.enum([
  "CASH",
  "BANK",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "MOBILE_WALLET",
  "UPI",
  "OTHER",
]);
export const frequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export const idSchema = z.string().min(8).max(64);

export const countryCodeSchema = z.enum(["IN", "NP", "PK", "BD"]);
export const AUTH_COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "NP", name: "Nepal" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
] as const;
export const languageSchema = z.enum(["en", "hi", "bn", "ur", "ne"]);
export const passwordSchema = z
  .string()
  .min(8, "Use 8+ characters")
  .max(128)
  .regex(/[0-9]/, "Include a number");

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean(),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email("Enter a valid email address"),
  password: passwordSchema,
  countryCode: countryCodeSchema,
  rememberMe: z.boolean(),
});

export const accountCatalogItemSchema = z.object({
  id: z.string().min(8).max(64),
  type: accountTypeSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(160).nullable(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
});
export const accountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: accountTypeSchema,
  institutionName: z.string().trim().max(100).nullable().optional(),
  openingBalanceMinor: z.number().int().safe(),
  currency: currencySchema,
  isActive: z.boolean().default(true),
});
export const accountPatchSchema = accountSchema
  .omit({ type: true })
  .partial();

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: transactionTypeSchema,
  icon: z.string().trim().min(1).max(40),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const categoryPatchSchema = categorySchema.partial();

export const transactionSchema = z.object({
  accountId: idSchema,
  categoryId: idSchema,
  type: transactionTypeSchema,
  amountMinor: z.number().int().positive().safe(),
  currency: currencySchema,
  merchant: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  transactionAt: z.iso.datetime({ offset: true }),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  recurring: z.boolean().optional(),
  creditFacilityId: idSchema.optional(),
});
export const transactionPatchSchema = transactionSchema.partial();

export const budgetSchema = z.object({
  categoryId: idSchema.nullable().optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amountMinor: z.number().int().positive().safe(),
  alertPercentage: z.number().int().min(1).max(100).default(80),
});
export const budgetPatchSchema = budgetSchema.partial().omit({ month: true });

export const goalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(8).default("★"),
  targetAmountMinor: z.number().int().positive().safe(),
  savedAmountMinor: z.number().int().nonnegative().safe().optional(),
  currency: currencySchema,
  targetDate: z.string().nullable().optional(),
  notes: z.string().trim().max(200).nullable().optional(),
});
export const goalContributionSchema = z.object({
  amountMinor: z.number().int().positive().safe(),
  notes: z.string().trim().max(200).nullable().optional(),
});

export const isoDateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Use YYYY-MM-DD");
export const ipoStatusSchema = z.enum(["Applied", "In progress", "Allotted", "Not Allotted", "Listed"]);
export const lendKindSchema = z.enum(["lent", "borrowed"]);
export const lendStatusSchema = z.enum(["pending", "due", "settled"]);
export const creditFacilityKindSchema = z.enum(["CARD", "UPI"]);

export const investmentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40),
  detail: z.string().trim().max(120).nullable().optional(),
  investedMinor: z.number().int().nonnegative().safe(),
  currentMinor: z.number().int().nonnegative().safe(),
  sipMinor: z.number().int().nonnegative().safe().optional(),
  sipDay: z.string().trim().max(12).nullable().optional(),
  currency: currencySchema,
});
export const investmentPatchSchema = investmentSchema.partial();

export const ipoSchema = z.object({
  name: z.string().trim().min(1).max(80),
  appliedOn: isoDateSchema,
  allotmentOn: isoDateSchema.nullable().optional(),
  amountMinor: z.number().int().positive().safe(),
  lots: z.number().int().positive().max(1000),
  status: ipoStatusSchema,
  currency: currencySchema,
});
export const ipoPatchSchema = ipoSchema.partial();

export const LOAN_TYPES = ["Home Loan", "Personal Loan", "Gadget EMI", "Two Wheeler", "Other"] as const;
export type LoanTypeName = (typeof LOAN_TYPES)[number];

export const loanFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  lender: z.string().trim().min(1).max(80),
  rate: z.string().trim().max(20).optional().default(""),
  principalMinor: z.number().int().nonnegative().safe(),
  emiMinor: z.number().int().positive().safe(),
  totalEmis: z.number().int().positive().max(600),
  remainingEmis: z.number().int().nonnegative().max(600),
  emiDay: z.number().int().min(1).max(31),
  outstandingMinor: z.number().int().nonnegative().safe().optional(),
  dueOn: isoDateSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  currency: currencySchema,
});
export const loanSchema = loanFieldsSchema.refine((value) => value.remainingEmis <= value.totalEmis, {
  message: "Remaining EMIs cannot exceed total EMIs",
  path: ["remainingEmis"],
});
export const loanPatchSchema = loanFieldsSchema.partial();

export const creditFacilitySchema = z.object({
  kind: creditFacilityKindSchema,
  name: z.string().trim().min(1).max(80),
  provider: z.string().trim().max(80).nullable().optional(),
  mask: z.string().trim().max(24).nullable().optional(),
  accountId: idSchema.nullable().optional(),
  limitMinor: z.number().int().nonnegative().safe(),
  usedMinor: z.number().int().nonnegative().safe().optional(),
  todaySpendMinor: z.number().int().nonnegative().safe().optional(),
  overdueMinor: z.number().int().nonnegative().safe().optional(),
  holdMinor: z.number().int().nonnegative().safe().optional(),
  minDueMinor: z.number().int().nonnegative().safe().optional(),
  dueOn: isoDateSchema.nullable().optional(),
  cycleStartOn: isoDateSchema.nullable().optional(),
  currency: currencySchema,
});
export const creditFacilityPatchSchema = creditFacilitySchema.partial().omit({ kind: true });

export const lendRecordSchema = z.object({
  person: z.string().trim().min(1).max(80),
  relation: z.string().trim().max(40).nullable().optional(),
  kind: lendKindSchema,
  amountMinor: z.number().int().positive().safe(),
  givenOn: isoDateSchema,
  dueOn: isoDateSchema,
  status: lendStatusSchema.optional(),
  currency: currencySchema,
});
export const lendRecordPatchSchema = lendRecordSchema.partial();

export const recurringSchema = transactionSchema
  .omit({ tags: true, recurring: true, transactionAt: true, creditFacilityId: true })
  .extend({
    frequency: frequencySchema,
    startAt: z.iso.datetime({ offset: true }),
  });
export const recurringPatchSchema = recurringSchema.partial();

export const profilePatchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  countryCode: countryCodeSchema.optional(),
  defaultCurrency: currencySchema.optional(),
  timezone: z.string().min(1).max(80).optional(),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: languageSchema.optional(),
  profileNote: z.string().trim().max(240).nullable().optional(),
  smartNotifications: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  appLockEnabled: z.boolean().optional(),
});

export const transactionQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  category_id: idSchema.optional(),
  account_id: idSchema.optional(),
  type: transactionTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "amount_desc", "amount_asc"]).default("newest"),
});

export function majorToMinor(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Enter a valid monetary amount");
  const [whole = "0", fraction = ""] = normalized.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error("Amount is too large");
  return minor;
}

export function savingsRate(incomeMinor: number, expenseMinor: number): number {
  return incomeMinor <= 0
    ? 0
    : Math.round(((incomeMinor - expenseMinor) / incomeMinor) * 10000) / 100;
}

export function budgetUsage(amountMinor: number, spentMinor: number) {
  const percentageUsed =
    amountMinor <= 0 ? 0 : Math.round((spentMinor / amountMinor) * 10000) / 100;
  return { spentMinor, remainingMinor: amountMinor - spentMinor, percentageUsed };
}

export function ordinal(value: number) {
  const n = Math.trunc(value);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function isoDateFromParts(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const clamped = Math.min(Math.max(1, Math.trunc(day)), lastDay);
  const date = new Date(year, monthIndex, clamped);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarToday(from = new Date()) {
  return isoDateFromParts(from.getFullYear(), from.getMonth(), from.getDate());
}

export function addCalendarMonths(iso: string, delta: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const monthIndex = Number(match[2]) - 1 + delta;
  const year = Number(match[1]) + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return isoDateFromParts(year, month, Number(match[3]));
}

export function daysUntil(iso: string, from = new Date()) {
  const today = Date.parse(`${calendarToday(from)}T00:00:00`);
  const target = Date.parse(`${iso}T00:00:00`);
  if (!Number.isFinite(today) || !Number.isFinite(target)) return 0;
  return Math.round((target - today) / 86_400_000);
}

export function emiDueCopy(dueOn: string, from = new Date()) {
  const days = daysUntil(dueOn, from);
  if (days < 0) {
    const n = Math.abs(days);
    return { tone: "overdue" as const, label: `Overdue ${n} day${n === 1 ? "" : "s"}` };
  }
  if (days === 0) return { tone: "pending" as const, label: "Due today" };
  return { tone: "upcoming" as const, label: `In ${days} day${days === 1 ? "" : "s"}` };
}

export type EmiInstallmentStatus = "paid" | "pending" | "overdue" | "upcoming";

export function loanSchedule(input: {
  emiMinor: number;
  totalEmis: number;
  remainingEmis: number;
  dueOn: string;
  now?: Date;
}) {
  const totalEmis = Math.max(0, Math.trunc(input.totalEmis) || 0);
  const remainingEmis = Math.max(0, Math.trunc(input.remainingEmis) || 0);
  const remaining = totalEmis > 0 ? Math.min(remainingEmis, totalEmis) : remainingEmis;
  const paidEmis = totalEmis > 0 ? Math.max(0, totalEmis - remaining) : 0;
  const today = calendarToday(input.now);
  const amountMinor = Math.max(0, Math.trunc(input.emiMinor) || 0);
  const items: Array<{
    installment: number;
    dueOn: string;
    amountMinor: number;
    status: EmiInstallmentStatus;
  }> = [];
  for (let paid = paidEmis; paid >= 1; paid -= 1) {
    items.push({
      installment: paid,
      dueOn: addCalendarMonths(input.dueOn, -(paidEmis - paid + 1)),
      amountMinor,
      status: "paid",
    });
  }
  for (let index = 0; index < remaining; index += 1) {
    const dueOn = addCalendarMonths(input.dueOn, index);
    items.push({
      installment: paidEmis + index + 1,
      dueOn,
      amountMinor,
      status: dueOn < today ? "overdue" : index === 0 ? "pending" : "upcoming",
    });
  }
  return items.sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.installment - right.installment);
}

export function applyPaidEmi(input: {
  remainingEmis: number;
  dueOn: string;
  emiMinor: number;
  principalMinor: number;
  totalEmis: number;
  emiDay: number;
}) {
  if (input.remainingEmis <= 0) return null;
  const remainingEmis = input.remainingEmis - 1;
  const dueOn = remainingEmis > 0 ? addCalendarMonths(input.dueOn, 1) : input.dueOn;
  const summary = loanSummary({
    principalMinor: input.principalMinor,
    emiMinor: input.emiMinor,
    totalEmis: input.totalEmis,
    remainingEmis,
    emiDay: input.emiDay,
  });
  return {
    remainingEmis,
    dueOn,
    outstandingMinor: summary.remainingPayableMinor,
    progress: Math.min(100, Math.max(0, Math.round(summary.completionPct))),
    paidMinor: summary.paidMinor,
  };
}

export function nextEmiDate(emiDay: number, from = new Date()) {
  const day = Math.min(31, Math.max(1, Math.trunc(emiDay) || 1));
  const year = from.getFullYear();
  const month = from.getMonth();
  const today = `${year}-${String(month + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const thisMonth = isoDateFromParts(year, month, day);
  if (thisMonth >= today) return thisMonth;
  const nextMonth = month + 1;
  return isoDateFromParts(year + Math.floor(nextMonth / 12), nextMonth % 12, day);
}

export type LoanSummaryInput = {
  principalMinor: number;
  emiMinor: number;
  totalEmis: number;
  remainingEmis: number;
  emiDay: number;
  now?: Date;
};

export function loanSummary(input: LoanSummaryInput) {
  const emiMinor = Math.max(0, Math.trunc(input.emiMinor) || 0);
  const principalMinor = Math.max(0, Math.trunc(input.principalMinor) || 0);
  const totalEmis = Math.max(0, Math.trunc(input.totalEmis) || 0);
  const remainingEmis = Math.max(0, Math.trunc(input.remainingEmis) || 0);
  const cappedRemaining = totalEmis > 0 ? Math.min(remainingEmis, totalEmis) : remainingEmis;
  const paidEmis = totalEmis > 0 ? Math.max(0, totalEmis - cappedRemaining) : 0;
  const paidMinor = paidEmis * emiMinor;
  const remainingPayableMinor = cappedRemaining * emiMinor;
  const totalPayableMinor = totalEmis * emiMinor;
  const interestMinor = Math.max(0, totalPayableMinor - principalMinor);
  const completionPct = totalEmis > 0 ? Math.round((paidEmis / totalEmis) * 1000) / 10 : 0;
  return {
    paidEmis,
    paidMinor,
    remainingEmis: cappedRemaining,
    remainingPayableMinor,
    totalPayableMinor,
    interestMinor,
    completionPct,
    nextDue: nextEmiDate(input.emiDay, input.now),
  };
}

export function creditSummary(input: {
  limitMinor: number;
  usedMinor: number;
  overdueMinor?: number;
  todaySpendMinor?: number;
  holdMinor?: number;
  minDueMinor?: number;
}) {
  const limitMinor = Math.max(0, Math.trunc(input.limitMinor) || 0);
  const usedMinor = Math.max(0, Math.trunc(input.usedMinor) || 0);
  const overdueMinor = Math.max(0, Math.trunc(input.overdueMinor ?? 0) || 0);
  const todaySpendMinor = Math.max(0, Math.trunc(input.todaySpendMinor ?? 0) || 0);
  const holdMinor = Math.max(0, Math.trunc(input.holdMinor ?? 0) || 0);
  const minDueMinor = Math.max(0, Math.trunc(input.minDueMinor ?? 0) || 0);
  const committedMinor = usedMinor + holdMinor;
  const availableMinor = Math.max(0, limitMinor - committedMinor);
  const usedPct = limitMinor > 0 ? Math.round((committedMinor / limitMinor) * 1000) / 10 : 0;
  return {
    limitMinor,
    usedMinor,
    overdueMinor,
    todaySpendMinor,
    holdMinor,
    minDueMinor,
    availableMinor,
    usedPct,
  };
}

export function creditSpendDelta(type: string, amountMinor: number) {
  const amount = Math.max(0, Math.trunc(amountMinor) || 0);
  if (type === "EXPENSE") return amount;
  if (type === "INCOME") return -amount;
  return 0;
}

export function nextCreditBalances(input: {
  usedMinor: number;
  holdMinor?: number;
  limitMinor: number;
  todaySpendMinor?: number;
  overdueMinor?: number;
  minDueMinor?: number;
  deltaMinor: number;
}) {
  const summary = creditSummary(input);
  const usedMinor = Math.max(0, summary.usedMinor + Math.trunc(input.deltaMinor || 0));
  const todaySpendMinor = Math.max(0, summary.todaySpendMinor + Math.trunc(input.deltaMinor || 0));
  const availableMinor = Math.max(0, summary.limitMinor - usedMinor - summary.holdMinor);
  const pendingMinor = cardDueAmount(summary) || usedMinor;
  return {
    usedMinor,
    todaySpendMinor,
    availableMinor,
    pendingMinor,
    spentMinor: Math.max(0, Math.trunc(input.deltaMinor || 0)),
  };
}

function pctOf(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export function creditOverview(input: {
  limitMinor: number;
  usedMinor: number;
  overdueMinor?: number;
  holdMinor?: number;
}) {
  const summary = creditSummary(input);
  return {
    limitMinor: summary.limitMinor,
    usedMinor: summary.usedMinor,
    availableMinor: summary.availableMinor,
    overdueMinor: summary.overdueMinor,
    holdMinor: summary.holdMinor,
    usedPct: summary.usedPct,
    availablePct: pctOf(summary.availableMinor, summary.limitMinor),
    overduePct: pctOf(summary.overdueMinor, summary.limitMinor),
    holdPct: pctOf(summary.holdMinor, summary.limitMinor),
  };
}

export function cardDueAmount(input: { overdueMinor?: number; minDueMinor?: number }) {
  const overdueMinor = Math.max(0, Math.trunc(input.overdueMinor ?? 0) || 0);
  const minDueMinor = Math.max(0, Math.trunc(input.minDueMinor ?? 0) || 0);
  return overdueMinor > 0 ? overdueMinor : minDueMinor;
}

export function cardPendingMinor(input: {
  overdueMinor?: number;
  minDueMinor?: number;
  usedMinor?: number;
}) {
  return cardDueAmount(input) || Math.max(0, Math.trunc(input.usedMinor ?? 0) || 0);
}

export function cardPaidThisCycle(lastPaidOn: string | null | undefined, dueOn: string | null | undefined, from = new Date()) {
  if (!lastPaidOn) return false;
  const today = calendarToday(from);
  if (dueOn && dueOn <= today) return false;
  return lastPaidOn.slice(0, 7) === today.slice(0, 7);
}

export function applyCardPayment(input: {
  usedMinor: number;
  overdueMinor: number;
  minDueMinor: number;
  dueOn: string | null;
  lastPaidOn?: string | null;
  now?: Date;
}) {
  if (cardPaidThisCycle(input.lastPaidOn, input.dueOn, input.now)) return null;
  const usedMinor = Math.max(0, Math.trunc(input.usedMinor) || 0);
  const overdueMinor = Math.max(0, Math.trunc(input.overdueMinor) || 0);
  const minDueMinor = Math.max(0, Math.trunc(input.minDueMinor) || 0);
  const paidMinor = cardDueAmount({ overdueMinor, minDueMinor });
  if (paidMinor <= 0) return null;
  return {
    usedMinor: Math.max(0, usedMinor - Math.min(paidMinor, usedMinor)),
    overdueMinor: 0,
    lastPaidOn: calendarToday(input.now),
    dueOn: input.dueOn ? addCalendarMonths(input.dueOn, 1) : input.dueOn,
    paidMinor,
  };
}
