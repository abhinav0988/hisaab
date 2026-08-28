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

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: accountTypeSchema,
  institutionName: z.string().trim().max(100).nullable().optional(),
  openingBalanceMinor: z.number().int().safe(),
  currency: currencySchema,
  isActive: z.boolean().default(true),
});
export const accountPatchSchema = accountSchema.partial();

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

export const recurringSchema = transactionSchema
  .omit({ tags: true, recurring: true, transactionAt: true })
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
