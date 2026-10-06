import { z } from "zod";

const currencySchema = z.enum(["INR", "NPR", "PKR", "BDT", "USD"]);
const idSchema = z.string().min(8).max(64);
const isoDateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Use YYYY-MM-DD");

export const splitMethodSchema = z.enum(["equal", "exact", "percentage", "shares", "itemwise"]);
export const splitExpenseStatusSchema = z.enum([
  "draft",
  "pending",
  "partially_paid",
  "partially_settled",
  "almost_settled",
  "settled",
  "overdue",
  "overpaid",
  "cancelled",
]);
export const splitParticipantStatusSchema = z.enum([
  "pending",
  "partially_paid",
  "paid",
  "overpaid",
  "waived",
]);
export const splitRelationshipSchema = z.enum(["friend", "family", "colleague", "other"]);
export const splitGroupTypeSchema = z.enum(["shared", "personal"]);
export const splitPaymentMethodSchema = z.enum([
  "upi",
  "cash",
  "bank_transfer",
  "card",
  "other",
]);
export const splitAdjustmentTypeSchema = z.enum([
  "discount",
  "waived",
  "correction",
  "refund",
  "other",
]);
export const splitReminderChannelSchema = z.enum(["in_app", "email", "whatsapp", "sms"]);

export const splitPersonSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(24).nullable().optional(),
  countryCode: z.string().trim().max(4).optional().default("IN"),
  email: z
    .union([z.email().max(120), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  relationship: splitRelationshipSchema.optional().default("friend"),
  photoUrl: z.string().trim().max(500).nullable().optional(),
  isSelf: z.boolean().optional(),
});
export const splitPersonPatchSchema = splitPersonSchema.partial();

export const splitGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  groupType: splitGroupTypeSchema.optional().default("shared"),
  currency: currencySchema.optional().default("INR"),
  defaultSplitMethod: splitMethodSchema.optional().default("equal"),
  defaultDueDays: z.number().int().min(0).max(365).optional().default(7),
  allowMemberAdd: z.boolean().optional().default(true),
  allowMemberEdit: z.boolean().optional().default(true),
  allowMemberSettle: z.boolean().optional().default(true),
  sendNotifications: z.boolean().optional().default(true),
  memberPersonIds: z.array(idSchema).max(50).optional().default([]),
});
export const splitGroupPatchSchema = splitGroupSchema.partial().omit({ memberPersonIds: true });

export const splitPayerInputSchema = z.object({
  personId: idSchema,
  paidAmountMinor: z.number().int().positive().safe(),
});

export const splitParticipantInputSchema = z.object({
  personId: idSchema,
  sharePercentageBps: z.number().int().min(0).max(10000).optional(),
  shareValue: z.number().int().positive().max(10000).optional(),
  shareAmountMinor: z.number().int().nonnegative().safe().optional(),
});

export const splitItemInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().int().positive().max(9999).optional().default(1),
  priceMinor: z.number().int().nonnegative().safe(),
  kind: z.enum(["item", "tax", "tip"]).optional().default("item"),
  personIds: z.array(idSchema).min(1).max(50),
});

export const splitExpenseSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(200).nullable().optional(),
    category: z.string().trim().min(1).max(60),
    totalAmountMinor: z.number().int().positive().safe(),
    currency: currencySchema.optional().default("INR"),
    expenseDate: isoDateSchema,
    expenseTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    groupId: idSchema.nullable().optional(),
    splitMethod: splitMethodSchema.optional().default("equal"),
    dueDate: isoDateSchema.nullable().optional(),
    noteForParticipants: z.string().trim().max(200).nullable().optional(),
    allowPartialPayments: z.boolean().optional().default(true),
    sendNotifications: z.boolean().optional().default(true),
    isDraft: z.boolean().optional().default(false),
    receiptId: idSchema.nullable().optional(),
    payers: z.array(splitPayerInputSchema).min(1).max(20),
    participants: z.array(splitParticipantInputSchema).min(1).max(50),
    items: z.array(splitItemInputSchema).max(100).optional(),
    reminder: z
      .object({
        enabled: z.boolean(),
        channels: z.array(splitReminderChannelSchema).max(4).optional(),
        firstReminderDaysBefore: z.number().int().min(0).max(30).optional(),
        frequencyDays: z.number().int().min(1).max(30).optional(),
        recurring: z.boolean().optional(),
        stopAfterSettlement: z.boolean().optional(),
        message: z.string().trim().max(200).nullable().optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const payerTotal = value.payers.reduce((sum, p) => sum + p.paidAmountMinor, 0);
    if (payerTotal !== value.totalAmountMinor) {
      ctx.addIssue({
        code: "custom",
        message: "Payer amounts must equal the expense total",
        path: ["payers"],
      });
    }
    const personIds = value.participants.map((p) => p.personId);
    if (new Set(personIds).size !== personIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate participants are not allowed",
        path: ["participants"],
      });
    }
  });

export const splitExpensePatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(200).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  dueDate: isoDateSchema.nullable().optional(),
  noteForParticipants: z.string().trim().max(200).nullable().optional(),
  status: splitExpenseStatusSchema.optional(),
  sendNotifications: z.boolean().optional(),
  allowPartialPayments: z.boolean().optional(),
});

export const splitPaymentSchema = z.object({
  participantId: idSchema,
  payerPersonId: idSchema,
  receiverPersonId: idSchema,
  amountMinor: z.number().int().positive().safe(),
  method: splitPaymentMethodSchema.optional().default("upi"),
  referenceId: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
  proofUrl: z.string().trim().max(500).nullable().optional(),
  paymentDate: isoDateSchema,
  isFinalSettlement: z.boolean().optional().default(false),
});

export const splitAdjustmentSchema = z.object({
  participantId: idSchema,
  amountMinor: z.number().int().safe(),
  type: splitAdjustmentTypeSchema,
  reason: z.string().trim().max(200).nullable().optional(),
});

export const splitReceiptUploadSchema = z.object({
  fileUrl: z.string().trim().min(1).max(500),
  fileName: z.string().trim().max(180).nullable().optional(),
  mimeType: z
    .enum(["image/jpeg", "image/png", "application/pdf"])
    .nullable()
    .optional(),
  fileSizeBytes: z.number().int().positive().max(10_485_760).nullable().optional(),
});

/** Largest-remainder allocation so shares always sum exactly to totalMinor. */
export function allocateEqual(totalMinor: number, count: number): number[] {
  if (count <= 0) throw new Error("Participant count must be positive");
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error("Invalid total");
  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function allocateByShares(totalMinor: number, shares: number[]): number[] {
  if (shares.length === 0) throw new Error("Shares required");
  if (shares.some((s) => !Number.isSafeInteger(s) || s <= 0)) throw new Error("Invalid share");
  const totalShares = shares.reduce((a, b) => a + b, 0);
  const raw = shares.map((s) => (totalMinor * s) / totalShares);
  const floors = raw.map((v) => Math.floor(v));
  let leftover = totalMinor - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - floors[i]! }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (const entry of order) {
    if (leftover <= 0) break;
    result[entry.i]! += 1;
    leftover -= 1;
  }
  return result;
}

/** percentages are basis points (10000 = 100%). */
export function allocateByPercentage(totalMinor: number, percentageBps: number[]): number[] {
  if (percentageBps.length === 0) throw new Error("Percentages required");
  const sum = percentageBps.reduce((a, b) => a + b, 0);
  if (sum !== 10_000) throw new Error("Percentages must total 100%");
  return allocateByShares(totalMinor, percentageBps);
}

export function allocateExact(amounts: number[], totalMinor: number) {
  const sum = amounts.reduce((a, b) => a + b, 0);
  return {
    ok: sum === totalMinor,
    allocatedMinor: sum,
    remainingMinor: totalMinor - sum,
  };
}

export type SplitItemAllocationInput = {
  name: string;
  quantity: number;
  priceMinor: number;
  kind: "item" | "tax" | "tip";
  personIds: string[];
};

/**
 * Item-wise split. Tax/tip with empty personIds (or kind tax/tip) split among
 * all participants proportional to their item subtotals when mode is proportional,
 * otherwise equally among allParticipants.
 */
export function allocateItemwise(input: {
  items: SplitItemAllocationInput[];
  allPersonIds: string[];
  taxTipMode?: "equal" | "proportional";
}): Record<string, number> {
  const mode = input.taxTipMode ?? "proportional";
  const totals: Record<string, number> = Object.fromEntries(
    input.allPersonIds.map((id) => [id, 0]),
  );
  const itemSubtotals: Record<string, number> = Object.fromEntries(
    input.allPersonIds.map((id) => [id, 0]),
  );

  for (const item of input.items) {
    if (item.kind !== "item") continue;
    const line = item.priceMinor * item.quantity;
    const ids = item.personIds.length ? item.personIds : input.allPersonIds;
    const parts = allocateEqual(line, ids.length);
    ids.forEach((id, i) => {
      totals[id] = (totals[id] ?? 0) + parts[i]!;
      itemSubtotals[id] = (itemSubtotals[id] ?? 0) + parts[i]!;
    });
  }

  for (const item of input.items) {
    if (item.kind === "item") continue;
    const line = item.priceMinor * item.quantity;
    const ids =
      item.personIds.length > 0
        ? item.personIds
        : input.allPersonIds;
    if (mode === "equal" || item.personIds.length > 0) {
      const parts = allocateEqual(line, ids.length);
      ids.forEach((id, i) => {
        totals[id] = (totals[id] ?? 0) + parts[i]!;
      });
    } else {
      const weights = ids.map((id) => Math.max(itemSubtotals[id] ?? 0, 0));
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const parts =
        weightSum === 0
          ? allocateEqual(line, ids.length)
          : allocateByShares(line, weights.map((w) => (w === 0 ? 1 : w)));
      ids.forEach((id, i) => {
        totals[id] = (totals[id] ?? 0) + parts[i]!;
      });
    }
  }

  return totals;
}

export function computeParticipantShares(input: {
  totalAmountMinor: number;
  method: z.infer<typeof splitMethodSchema>;
  participants: Array<{
    personId: string;
    sharePercentageBps?: number;
    shareValue?: number;
    shareAmountMinor?: number;
  }>;
  items?: SplitItemAllocationInput[];
}): Array<{
  personId: string;
  sharePercentageBps: number;
  shareValue: number;
  shareAmountMinor: number;
}> {
  const { totalAmountMinor, method, participants } = input;
  if (participants.length === 0) throw new Error("At least one participant is required");

  if (method === "equal") {
    const amounts = allocateEqual(totalAmountMinor, participants.length);
    return participants.map((p, i) => ({
      personId: p.personId,
      sharePercentageBps: Math.round(10_000 / participants.length),
      shareValue: 1,
      shareAmountMinor: amounts[i]!,
    }));
  }

  if (method === "exact") {
    const amounts = participants.map((p) => p.shareAmountMinor ?? 0);
    const check = allocateExact(amounts, totalAmountMinor);
    if (!check.ok) throw new Error(`Exact amounts must equal total (remaining ${check.remainingMinor})`);
    return participants.map((p, i) => ({
      personId: p.personId,
      sharePercentageBps:
        totalAmountMinor === 0 ? 0 : Math.round((amounts[i]! * 10_000) / totalAmountMinor),
      shareValue: 1,
      shareAmountMinor: amounts[i]!,
    }));
  }

  if (method === "percentage") {
    const bps = participants.map((p) => p.sharePercentageBps ?? 0);
    const amounts = allocateByPercentage(totalAmountMinor, bps);
    return participants.map((p, i) => ({
      personId: p.personId,
      sharePercentageBps: bps[i]!,
      shareValue: 1,
      shareAmountMinor: amounts[i]!,
    }));
  }

  if (method === "shares") {
    const shares = participants.map((p) => p.shareValue ?? 1);
    const amounts = allocateByShares(totalAmountMinor, shares);
    const totalShares = shares.reduce((a, b) => a + b, 0);
    return participants.map((p, i) => ({
      personId: p.personId,
      sharePercentageBps: Math.round((shares[i]! * 10_000) / totalShares),
      shareValue: shares[i]!,
      shareAmountMinor: amounts[i]!,
    }));
  }

  // itemwise
  if (!input.items?.length) throw new Error("Items are required for item-wise split");
  const map = allocateItemwise({
    items: input.items,
    allPersonIds: participants.map((p) => p.personId),
  });
  const amounts = participants.map((p) => map[p.personId] ?? 0);
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum !== totalAmountMinor) {
    throw new Error(`Item-wise total ${sum} does not match expense total ${totalAmountMinor}`);
  }
  return participants.map((p, i) => ({
    personId: p.personId,
    sharePercentageBps:
      totalAmountMinor === 0 ? 0 : Math.round((amounts[i]! * 10_000) / totalAmountMinor),
    shareValue: 1,
    shareAmountMinor: amounts[i]!,
  }));
}

export function participantSettlementStatus(
  adjustedShareMinor: number,
  paidAmountMinor: number,
): z.infer<typeof splitParticipantStatusSchema> {
  if (adjustedShareMinor <= 0 && paidAmountMinor <= 0) return "waived";
  if (paidAmountMinor <= 0) return "pending";
  if (paidAmountMinor < adjustedShareMinor) return "partially_paid";
  if (paidAmountMinor === adjustedShareMinor) return "paid";
  return "overpaid";
}

export function pendingAmount(adjustedShareMinor: number, paidAmountMinor: number) {
  return Math.max(0, adjustedShareMinor - paidAmountMinor);
}

export function overpaidAmount(adjustedShareMinor: number, paidAmountMinor: number) {
  return Math.max(0, paidAmountMinor - adjustedShareMinor);
}

export function deriveExpenseStatus(input: {
  participants: Array<{ adjustedShareMinor: number; paidAmountMinor: number }>;
  dueDate?: string | null;
  today?: string;
  cancelled?: boolean;
}): z.infer<typeof splitExpenseStatusSchema> {
  if (input.cancelled) return "cancelled";
  const totalShare = input.participants.reduce((s, p) => s + p.adjustedShareMinor, 0);
  const totalPaid = input.participants.reduce((s, p) => s + p.paidAmountMinor, 0);
  const totalPending = input.participants.reduce(
    (s, p) => s + pendingAmount(p.adjustedShareMinor, p.paidAmountMinor),
    0,
  );
  const anyOverpaid = input.participants.some((p) => p.paidAmountMinor > p.adjustedShareMinor);

  if (totalPending === 0 && totalPaid >= totalShare) {
    return anyOverpaid && totalPaid > totalShare ? "overpaid" : "settled";
  }

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.dueDate && input.dueDate < today && totalPending > 0) return "overdue";

  if (totalPaid === 0) return "pending";

  const settledRatio = totalShare === 0 ? 1 : totalPaid / totalShare;
  if (settledRatio >= 0.9) return "almost_settled";
  if (settledRatio > 0) return "partially_settled";
  return "partially_paid";
}

/**
 * Net balance for a person after an expense:
 * +contribution (as payer) - own share + settlements received - settlements paid
 * Positive = others owe them / they are owed.
 */
export function netBalanceForPerson(input: {
  personId: string;
  payerContributionMinor: number;
  shareAmountMinor: number;
  settlementPaidMinor: number;
  settlementReceivedMinor: number;
}) {
  return (
    input.payerContributionMinor -
    input.shareAmountMinor -
    input.settlementPaidMinor +
    input.settlementReceivedMinor
  );
}

export type DebtEdge = { fromPersonId: string; toPersonId: string; amountMinor: number };

/** Simplify pairwise debts into a minimal set of settlement suggestions. Does not mutate ledger. */
export function simplifyDebts(edges: DebtEdge[]): DebtEdge[] {
  const net: Record<string, number> = {};
  for (const edge of edges) {
    if (edge.amountMinor <= 0 || edge.fromPersonId === edge.toPersonId) continue;
    net[edge.fromPersonId] = (net[edge.fromPersonId] ?? 0) - edge.amountMinor;
    net[edge.toPersonId] = (net[edge.toPersonId] ?? 0) + edge.amountMinor;
  }

  const debtors = Object.entries(net)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amount: -v }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, amount: v }))
    .sort((a, b) => b.amount - a.amount);

  const suggestions: DebtEdge[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const pay = Math.min(debtor.amount, creditor.amount);
    if (pay > 0) {
      suggestions.push({
        fromPersonId: debtor.id,
        toPersonId: creditor.id,
        amountMinor: pay,
      });
    }
    debtor.amount -= pay;
    creditor.amount -= pay;
    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }
  return suggestions;
}

export interface ReceiptParserService {
  uploadReceipt(input: {
    fileUrl: string;
    fileName?: string | null;
    mimeType?: string | null;
  }): Promise<{ receiptId: string; ocrStatus: string }>;
  extractMerchant(payload: unknown): string | null;
  extractDate(payload: unknown): string | null;
  extractItems(payload: unknown): Array<{ name: string; priceMinor: number; quantity: number }>;
  extractSubtotal(payload: unknown): number | null;
  extractTax(payload: unknown): number | null;
  extractTotal(payload: unknown): number | null;
}

/** Dev-only mock OCR — never use in production send paths. */
export function createMockReceiptParser(): ReceiptParserService {
  return {
    async uploadReceipt() {
      return { receiptId: `mock_${Date.now()}`, ocrStatus: "extracted" };
    },
    extractMerchant() {
      return "THE FOOD CAFE";
    },
    extractDate() {
      return new Date().toISOString().slice(0, 10);
    },
    extractItems() {
      return [{ name: "Dinner", priceMinor: 78750, quantity: 1 }];
    },
    extractSubtotal() {
      return 70000;
    },
    extractTax() {
      return 8750;
    },
    extractTotal() {
      return 78750;
    },
  };
}
