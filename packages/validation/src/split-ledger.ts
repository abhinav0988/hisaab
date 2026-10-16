/**
 * Deterministic Split Money ledger.
 *
 * Accounting model (all amounts are integer minor units, one currency per expense):
 * - Upfront payment: what a person paid the merchant for the bill.
 * - Share: what a person should bear. Adjustments change a participant's share.
 * - Absorption: when adjustments make shares sum to less than the bill (discounts,
 *   waivers, refunds), the shortfall is borne by the upfront payers in proportion to
 *   what they paid. This keeps the ledger zero-sum.
 * - Repayment: a recorded settlement transfer from one person to another. It is a
 *   separate event from the upfront bill payment.
 *
 * Net position = upfront − share − absorbed + repayments sent − repayments received.
 * Positive means the person should receive money; negative means they owe money.
 * Positions always sum to zero, so total owed always equals total receivable.
 */

export type LedgerPayer = { personId: string; paidAmountMinor: number };
export type LedgerParticipant = { id: string; personId: string; shareAmountMinor: number };
export type LedgerAdjustment = { participantId: string; amountMinor: number };
export type LedgerPayment = {
  id?: string;
  payerPersonId: string;
  receiverPersonId: string;
  amountMinor: number;
  status?: string;
  paymentDate?: string | null;
};

export type LedgerInput = {
  totalAmountMinor: number;
  payers: LedgerPayer[];
  participants: LedgerParticipant[];
  adjustments?: LedgerAdjustment[];
  payments?: LedgerPayment[];
};

export type LedgerPersonStatus = "pending" | "partially_paid" | "paid" | "overpaid" | "waived";

export type LedgerBalance = {
  personId: string;
  participantId: string | null;
  upfrontPaidMinor: number;
  shareMinor: number;
  adjustedShareMinor: number;
  absorbedMinor: number;
  /** Position created by the bill itself, before any repayment. */
  initialNetMinor: number;
  repaymentSentMinor: number;
  repaymentReceivedMinor: number;
  /** Current position after repayments. */
  netMinor: number;
  owedMinor: number;
  receivableMinor: number;
  /** Original debt from the bill (0 for people who paid at least their share). */
  originalDebtMinor: number;
  /** Original amount others owed this person because of the bill. */
  originalReceivableMinor: number;
  /** Repayment sent beyond the original debt (only possible after a later adjustment). */
  overpaidMinor: number;
  lastPaymentDate: string | null;
  status: LedgerPersonStatus;
};

export type LedgerObligation = {
  debtorPersonId: string;
  creditorPersonId: string;
  amountMinor: number;
};

export type LedgerSummary = {
  totalAmountMinor: number;
  upfrontPaidMinor: number;
  sharesMinor: number;
  absorbedMinor: number;
  /** Money that must move between people because of the bill. */
  collectibleMinor: number;
  repaymentsRecordedMinor: number;
  /** Portion of the collectible amount already repaid. */
  collectedMinor: number;
  remainingMinor: number;
  /** Basis points of collectible already repaid; 10000 when nothing needs to move. */
  settledBps: number;
  settledPercent: number;
  hasOverpayment: boolean;
};

export type SplitLedger = {
  balances: LedgerBalance[];
  /** Who must pay whom right now. Repayments are only accepted along these edges. */
  obligations: LedgerObligation[];
  /** Who owed whom before any repayment, for display. */
  originalObligations: LedgerObligation[];
  summary: LedgerSummary;
};

function assertMinor(value: number, label: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer amount in minor units`);
}

/** Largest-remainder allocation of `amount` by integer weights, exact and deterministic. */
export function allocateByWeights(amount: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const big = BigInt(amount);
  const bigTotal = BigInt(totalWeight);
  const floors = weights.map((weight) => (big * BigInt(weight)) / bigTotal);
  const remainders = weights.map((weight, index) => ({
    index,
    rest: big * BigInt(weight) - floors[index]! * bigTotal,
  }));
  let leftover = big - floors.reduce((sum, value) => sum + value, 0n);
  remainders.sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1));
  const result = floors.map((value) => Number(value));
  for (const entry of remainders) {
    if (leftover <= 0n) break;
    result[entry.index]! += 1;
    leftover -= 1n;
  }
  return result;
}

/**
 * Matches debtors to creditors. Preferred pairs (refunds back to whoever overpaid)
 * are settled first, then the rest is matched greedily in stable person-id order.
 */
export function matchPositions(
  input: Map<string, number>,
  preferred: Array<{ debtorPersonId: string; creditorPersonId: string; capMinor: number }> = [],
): LedgerObligation[] {
  const positions = new Map(input);
  const edges: LedgerObligation[] = [];
  const addEdge = (debtorPersonId: string, creditorPersonId: string, amountMinor: number) => {
    const existing = edges.find(
      (edge) => edge.debtorPersonId === debtorPersonId && edge.creditorPersonId === creditorPersonId,
    );
    if (existing) existing.amountMinor += amountMinor;
    else edges.push({ debtorPersonId, creditorPersonId, amountMinor });
    positions.set(debtorPersonId, positions.get(debtorPersonId)! + amountMinor);
    positions.set(creditorPersonId, positions.get(creditorPersonId)! - amountMinor);
  };
  for (const pair of preferred) {
    const debt = -(positions.get(pair.debtorPersonId) ?? 0);
    const credit = positions.get(pair.creditorPersonId) ?? 0;
    const amount = Math.min(debt, credit, pair.capMinor);
    if (amount > 0) addEdge(pair.debtorPersonId, pair.creditorPersonId, amount);
  }
  const debtors = [...positions.entries()]
    .filter(([, value]) => value < 0)
    .map(([personId, value]) => ({ personId, amount: -value }))
    .sort((a, b) => a.personId.localeCompare(b.personId));
  const creditors = [...positions.entries()]
    .filter(([, value]) => value > 0)
    .map(([personId, value]) => ({ personId, amount: value }))
    .sort((a, b) => a.personId.localeCompare(b.personId));
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) addEdge(debtor.personId, creditor.personId, amount);
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }
  return edges;
}

export function computeSplitLedger(input: LedgerInput): SplitLedger {
  assertMinor(input.totalAmountMinor, "Total");
  const people = new Map<string, LedgerBalance>();
  const touch = (personId: string) => {
    let row = people.get(personId);
    if (!row) {
      row = {
        personId,
        participantId: null,
        upfrontPaidMinor: 0,
        shareMinor: 0,
        adjustedShareMinor: 0,
        absorbedMinor: 0,
        initialNetMinor: 0,
        repaymentSentMinor: 0,
        repaymentReceivedMinor: 0,
        netMinor: 0,
        owedMinor: 0,
        receivableMinor: 0,
        originalDebtMinor: 0,
        originalReceivableMinor: 0,
        overpaidMinor: 0,
        lastPaymentDate: null,
        status: "paid",
      };
      people.set(personId, row);
    }
    return row;
  };

  for (const payer of input.payers) {
    assertMinor(payer.paidAmountMinor, "Payer amount");
    touch(payer.personId).upfrontPaidMinor += payer.paidAmountMinor;
  }
  const adjustmentsByParticipant = new Map<string, number>();
  for (const adjustment of input.adjustments ?? []) {
    assertMinor(adjustment.amountMinor, "Adjustment");
    adjustmentsByParticipant.set(
      adjustment.participantId,
      (adjustmentsByParticipant.get(adjustment.participantId) ?? 0) + adjustment.amountMinor,
    );
  }
  for (const participant of input.participants) {
    assertMinor(participant.shareAmountMinor, "Share");
    const row = touch(participant.personId);
    row.participantId = participant.id;
    row.shareMinor += participant.shareAmountMinor;
    row.adjustedShareMinor += Math.max(
      0,
      participant.shareAmountMinor + (adjustmentsByParticipant.get(participant.id) ?? 0),
    );
  }

  const upfrontPaidMinor = [...people.values()].reduce((sum, row) => sum + row.upfrontPaidMinor, 0);
  const sharesMinor = [...people.values()].reduce((sum, row) => sum + row.adjustedShareMinor, 0);
  // Shortfall (positive) is absorbed by payers; an excess (negative) credits them back.
  const absorbedMinor = upfrontPaidMinor - sharesMinor;
  const payerRows = [...people.values()]
    .filter((row) => row.upfrontPaidMinor > 0)
    .sort((a, b) => a.personId.localeCompare(b.personId));
  const absorbedParts = allocateByWeights(
    Math.abs(absorbedMinor),
    payerRows.map((row) => row.upfrontPaidMinor),
  );
  payerRows.forEach((row, index) => {
    row.absorbedMinor = Math.sign(absorbedMinor) * absorbedParts[index]!;
  });

  for (const row of people.values()) {
    row.initialNetMinor = row.upfrontPaidMinor - row.adjustedShareMinor - row.absorbedMinor;
  }
  const originalPositions = new Map([...people.values()].map((row) => [row.personId, row.initialNetMinor]));
  const originalObligations = matchPositions(originalPositions);

  let repaymentsRecordedMinor = 0;
  for (const payment of input.payments ?? []) {
    if (payment.status && payment.status !== "completed") continue;
    if (payment.payerPersonId === payment.receiverPersonId) continue;
    assertMinor(payment.amountMinor, "Payment");
    const payer = touch(payment.payerPersonId);
    const receiver = touch(payment.receiverPersonId);
    payer.repaymentSentMinor += payment.amountMinor;
    receiver.repaymentReceivedMinor += payment.amountMinor;
    repaymentsRecordedMinor += payment.amountMinor;
    if (payment.paymentDate) {
      for (const row of [payer, receiver]) {
        if (!row.lastPaymentDate || payment.paymentDate > row.lastPaymentDate) {
          row.lastPaymentDate = payment.paymentDate;
        }
      }
    }
  }

  let collectibleMinor = 0;
  let remainingMinor = 0;
  let hasOverpayment = false;
  for (const row of people.values()) {
    row.netMinor = row.initialNetMinor + row.repaymentSentMinor - row.repaymentReceivedMinor;
    row.owedMinor = Math.max(0, -row.netMinor);
    row.receivableMinor = Math.max(0, row.netMinor);
    row.originalDebtMinor = Math.max(0, -row.initialNetMinor);
    row.originalReceivableMinor = Math.max(0, row.initialNetMinor);
    row.overpaidMinor =
      row.originalDebtMinor > 0 ? Math.max(0, row.repaymentSentMinor - row.originalDebtMinor) : 0;
    if (row.overpaidMinor > 0) hasOverpayment = true;
    collectibleMinor += row.originalDebtMinor;
    remainingMinor += row.owedMinor;
    if (row.originalDebtMinor > 0) {
      row.status =
        row.overpaidMinor > 0
          ? "overpaid"
          : row.owedMinor === 0
            ? "paid"
            : row.repaymentSentMinor > 0
              ? "partially_paid"
              : "pending";
    } else {
      row.status =
        row.participantId && row.shareMinor > 0 && row.adjustedShareMinor === 0 && row.upfrontPaidMinor === 0
          ? "waived"
          : "paid";
    }
  }

  const collectedMinor = Math.max(0, collectibleMinor - Math.min(collectibleMinor, remainingMinor));
  const settledBps =
    collectibleMinor === 0
      ? remainingMinor === 0
        ? 10_000
        : 0
      : Math.floor((collectedMinor * 10_000) / collectibleMinor);

  const positions = new Map([...people.values()].map((row) => [row.personId, row.netMinor]));
  const refundPairs = (input.payments ?? [])
    .filter((payment) => (!payment.status || payment.status === "completed") && payment.payerPersonId !== payment.receiverPersonId)
    .map((payment) => ({
      debtorPersonId: payment.receiverPersonId,
      creditorPersonId: payment.payerPersonId,
      capMinor: payment.amountMinor,
    }));
  return {
    balances: [...people.values()],
    obligations: matchPositions(positions, refundPairs),
    originalObligations,
    summary: {
      totalAmountMinor: input.totalAmountMinor,
      upfrontPaidMinor,
      sharesMinor,
      absorbedMinor,
      collectibleMinor,
      repaymentsRecordedMinor,
      collectedMinor,
      remainingMinor,
      settledBps,
      settledPercent: settledBps / 100,
      hasOverpayment,
    },
  };
}

export type LedgerExpenseStatus =
  | "draft"
  | "pending"
  | "partially_settled"
  | "almost_settled"
  | "settled"
  | "overdue"
  | "cancelled";

export function ledgerExpenseStatus(input: {
  summary: LedgerSummary;
  isDraft?: boolean;
  cancelled?: boolean;
  dueDate?: string | null;
  today: string;
}): LedgerExpenseStatus {
  if (input.cancelled) return "cancelled";
  if (input.isDraft) return "draft";
  const { remainingMinor, collectedMinor, settledBps } = input.summary;
  if (remainingMinor === 0) return "settled";
  if (input.dueDate && input.dueDate < input.today) return "overdue";
  if (collectedMinor === 0) return "pending";
  return settledBps >= 9_000 ? "almost_settled" : "partially_settled";
}

export type PaymentCheck =
  | { ok: true; remainingBeforeMinor: number; remainingAfterMinor: number }
  | { ok: false; code: string; message: string; remainingMinor?: number };

/** A repayment must follow a current obligation edge and may not exceed it. */
export function checkRepayment(
  ledger: SplitLedger,
  payment: { payerPersonId: string; receiverPersonId: string; amountMinor: number },
): PaymentCheck {
  if (!Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Enter an amount greater than zero." };
  }
  if (payment.payerPersonId === payment.receiverPersonId) {
    return { ok: false, code: "SELF_PAYMENT", message: "A person cannot repay themselves." };
  }
  const edge = ledger.obligations.find(
    (item) =>
      item.debtorPersonId === payment.payerPersonId && item.creditorPersonId === payment.receiverPersonId,
  );
  if (!edge) {
    return {
      ok: false,
      code: "NO_OBLIGATION",
      message: "This person does not owe the selected receiver anything on this expense.",
      remainingMinor: 0,
    };
  }
  if (payment.amountMinor > edge.amountMinor) {
    return {
      ok: false,
      code: "PAYMENT_EXCEEDS_OBLIGATION",
      message: `Only ${edge.amountMinor} is still owed to this receiver.`,
      remainingMinor: edge.amountMinor,
    };
  }
  return {
    ok: true,
    remainingBeforeMinor: edge.amountMinor,
    remainingAfterMinor: edge.amountMinor - payment.amountMinor,
  };
}
