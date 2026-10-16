import { describe, expect, it } from "vitest";
import {
  allocateByWeights,
  checkRepayment,
  computeSplitLedger,
  ledgerExpenseStatus,
  type LedgerInput,
} from "./split-ledger";
import { computeParticipantShares } from "./split-money";

const YOU = "p-you-0001";
const RAHUL = "p-rahul-01";
const PRIYA = "p-priya-01";
const NEHA = "p-neha-001";

function part(personId: string, share: number) {
  return { id: `part-${personId}`, personId, shareAmountMinor: share };
}
function balance(ledger: ReturnType<typeof computeSplitLedger>, personId: string) {
  return ledger.balances.find((row) => row.personId === personId)!;
}

describe("single payer (₹900, you paid, three equal shares)", () => {
  const ledger = computeSplitLedger({
    totalAmountMinor: 90_000,
    payers: [{ personId: YOU, paidAmountMinor: 90_000 }],
    participants: [part(YOU, 30_000), part(RAHUL, 30_000), part(PRIYA, 30_000)],
  });

  it("never makes you owe yourself", () => {
    expect(balance(ledger, YOU)).toMatchObject({
      adjustedShareMinor: 30_000,
      owedMinor: 0,
      receivableMinor: 60_000,
      status: "paid",
    });
    expect(ledger.obligations.some((edge) => edge.debtorPersonId === YOU)).toBe(false);
  });

  it("collects ₹600 from the other two", () => {
    expect(ledger.summary.collectibleMinor).toBe(60_000);
    expect(ledger.summary.remainingMinor).toBe(60_000);
    expect(ledger.obligations).toEqual([
      { debtorPersonId: PRIYA, creditorPersonId: YOU, amountMinor: 30_000 },
      { debtorPersonId: RAHUL, creditorPersonId: YOU, amountMinor: 30_000 },
    ]);
  });
});

describe("single payer with repayments (₹1,200, Rahul repaid ₹100, Priya ₹400)", () => {
  const ledger = computeSplitLedger({
    totalAmountMinor: 120_000,
    payers: [{ personId: YOU, paidAmountMinor: 120_000 }],
    participants: [part(YOU, 40_000), part(RAHUL, 40_000), part(PRIYA, 40_000)],
    payments: [
      { payerPersonId: RAHUL, receiverPersonId: YOU, amountMinor: 10_000, paymentDate: "2026-10-02" },
      { payerPersonId: PRIYA, receiverPersonId: YOU, amountMinor: 40_000, paymentDate: "2026-10-03" },
    ],
  });

  it("reports received, remaining and progress against the collectible amount", () => {
    expect(ledger.summary).toMatchObject({
      collectibleMinor: 80_000,
      collectedMinor: 50_000,
      remainingMinor: 30_000,
      settledBps: 6_250,
      settledPercent: 62.5,
    });
  });

  it("shows each person's paid and remaining amounts", () => {
    expect(balance(ledger, RAHUL)).toMatchObject({ repaymentSentMinor: 10_000, owedMinor: 30_000, status: "partially_paid" });
    expect(balance(ledger, PRIYA)).toMatchObject({ repaymentSentMinor: 40_000, owedMinor: 0, status: "paid" });
    expect(balance(ledger, YOU)).toMatchObject({ repaymentReceivedMinor: 50_000, receivableMinor: 30_000, lastPaymentDate: "2026-10-03" });
  });

  it("is partially settled until Rahul pays", () => {
    expect(ledgerExpenseStatus({ summary: ledger.summary, today: "2026-10-14" })).toBe("partially_settled");
  });
});

describe("multiple payers (₹1,200: you ₹700, Rahul ₹500, Priya ₹0)", () => {
  const input: LedgerInput = {
    totalAmountMinor: 120_000,
    payers: [
      { personId: YOU, paidAmountMinor: 70_000 },
      { personId: RAHUL, paidAmountMinor: 50_000 },
    ],
    participants: [part(YOU, 40_000), part(RAHUL, 40_000), part(PRIYA, 40_000)],
  };
  const ledger = computeSplitLedger(input);

  it("routes Priya's debt to both creditors instead of the first payer", () => {
    expect(balance(ledger, YOU).initialNetMinor).toBe(30_000);
    expect(balance(ledger, RAHUL).initialNetMinor).toBe(10_000);
    expect(balance(ledger, PRIYA).initialNetMinor).toBe(-40_000);
    expect(ledger.obligations).toHaveLength(2);
    expect(ledger.obligations).toContainEqual({ debtorPersonId: PRIYA, creditorPersonId: YOU, amountMinor: 30_000 });
    expect(ledger.obligations).toContainEqual({ debtorPersonId: PRIYA, creditorPersonId: RAHUL, amountMinor: 10_000 });
    expect(ledger.summary.collectibleMinor).toBe(40_000);
  });

  it("rejects repayments to the wrong receiver or beyond the obligation", () => {
    expect(checkRepayment(ledger, { payerPersonId: PRIYA, receiverPersonId: RAHUL, amountMinor: 20_000 })).toMatchObject({
      ok: false,
      code: "PAYMENT_EXCEEDS_OBLIGATION",
      remainingMinor: 10_000,
    });
    expect(checkRepayment(ledger, { payerPersonId: RAHUL, receiverPersonId: YOU, amountMinor: 100 })).toMatchObject({
      ok: false,
      code: "NO_OBLIGATION",
    });
    expect(checkRepayment(ledger, { payerPersonId: PRIYA, receiverPersonId: PRIYA, amountMinor: 100 })).toMatchObject({
      ok: false,
      code: "SELF_PAYMENT",
    });
    expect(checkRepayment(ledger, { payerPersonId: PRIYA, receiverPersonId: YOU, amountMinor: 0 })).toMatchObject({
      ok: false,
      code: "INVALID_AMOUNT",
    });
    expect(checkRepayment(ledger, { payerPersonId: PRIYA, receiverPersonId: RAHUL, amountMinor: 10_000 })).toEqual({
      ok: true,
      remainingBeforeMinor: 10_000,
      remainingAfterMinor: 0,
    });
  });

  it("keeps the remaining edge after Priya repays Rahul", () => {
    const after = computeSplitLedger({
      ...input,
      payments: [{ payerPersonId: PRIYA, receiverPersonId: RAHUL, amountMinor: 10_000 }],
    });
    expect(after.obligations).toEqual([{ debtorPersonId: PRIYA, creditorPersonId: YOU, amountMinor: 30_000 }]);
    expect(balance(after, RAHUL).receivableMinor).toBe(0);
    expect(after.summary.remainingMinor).toBe(30_000);
  });
});

describe("adjustments", () => {
  const base: LedgerInput = {
    totalAmountMinor: 120_000,
    payers: [{ personId: YOU, paidAmountMinor: 120_000 }],
    participants: [part(YOU, 40_000), part(RAHUL, 40_000), part(PRIYA, 40_000)],
  };

  it("absorbs a waiver into the payer so the ledger stays balanced", () => {
    const ledger = computeSplitLedger({
      ...base,
      adjustments: [{ participantId: `part-${RAHUL}`, amountMinor: -10_000 }],
    });
    expect(balance(ledger, RAHUL).owedMinor).toBe(30_000);
    expect(balance(ledger, YOU)).toMatchObject({ absorbedMinor: 10_000, receivableMinor: 70_000 });
    expect(ledger.summary.collectibleMinor).toBe(70_000);
  });

  it("marks a fully waived participant as waived", () => {
    const ledger = computeSplitLedger({
      ...base,
      adjustments: [{ participantId: `part-${PRIYA}`, amountMinor: -40_000 }],
    });
    expect(balance(ledger, PRIYA).status).toBe("waived");
  });

  it("turns a repayment above a later-reduced share into a refund owed back", () => {
    const ledger = computeSplitLedger({
      ...base,
      adjustments: [{ participantId: `part-${RAHUL}`, amountMinor: -10_000 }],
      payments: [
        { payerPersonId: RAHUL, receiverPersonId: YOU, amountMinor: 40_000 },
        { payerPersonId: PRIYA, receiverPersonId: YOU, amountMinor: 40_000 },
      ],
    });
    expect(balance(ledger, RAHUL)).toMatchObject({ overpaidMinor: 10_000, receivableMinor: 10_000, status: "overpaid" });
    expect(ledger.obligations).toEqual([{ debtorPersonId: YOU, creditorPersonId: RAHUL, amountMinor: 10_000 }]);
    expect(ledger.summary.hasOverpayment).toBe(true);
  });
});

describe("statuses", () => {
  const ledger = computeSplitLedger({
    totalAmountMinor: 10_000,
    payers: [{ personId: YOU, paidAmountMinor: 10_000 }],
    participants: [part(YOU, 5_000), part(RAHUL, 5_000)],
  });
  it("is overdue after the due date with money outstanding", () => {
    expect(ledgerExpenseStatus({ summary: ledger.summary, dueDate: "2026-10-01", today: "2026-10-14" })).toBe("overdue");
  });
  it("respects draft and cancelled", () => {
    expect(ledgerExpenseStatus({ summary: ledger.summary, isDraft: true, today: "2026-10-14" })).toBe("draft");
    expect(ledgerExpenseStatus({ summary: ledger.summary, cancelled: true, today: "2026-10-14" })).toBe("cancelled");
  });
  it("is settled when a person paid their own share alone", () => {
    const solo = computeSplitLedger({
      totalAmountMinor: 5_000,
      payers: [{ personId: YOU, paidAmountMinor: 5_000 }],
      participants: [part(YOU, 5_000)],
    });
    expect(solo.summary).toMatchObject({ collectibleMinor: 0, remainingMinor: 0, settledBps: 10_000 });
    expect(ledgerExpenseStatus({ summary: solo.summary, today: "2026-10-14" })).toBe("settled");
  });
});

describe("allocateByWeights", () => {
  it("is exact for amounts that cannot divide evenly", () => {
    expect(allocateByWeights(10_000, [1, 1, 1])).toEqual([3_334, 3_333, 3_333]);
    expect(allocateByWeights(1, [1, 1, 1])).toEqual([1, 0, 0]);
  });
  it("stays exact for very large amounts", () => {
    const total = 9_000_000_000_000;
    const parts = allocateByWeights(total, [3_333, 3_333, 3_334]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(total);
  });
});

describe("item-wise tax, tip and discount", () => {
  it("spreads untagged tax by item subtotal and applies a discount", () => {
    const shares = computeParticipantShares({
      totalAmountMinor: 1_000 + 500 + 150 + 90 - 300,
      method: "itemwise",
      participants: [{ personId: YOU }, { personId: RAHUL }, { personId: PRIYA }],
      items: [
        { name: "Pizza", quantity: 1, priceMinor: 1_000, kind: "item", personIds: [YOU, RAHUL] },
        { name: "Juice", quantity: 1, priceMinor: 500, kind: "item", personIds: [RAHUL] },
        { name: "GST", quantity: 1, priceMinor: 150, kind: "tax", personIds: [] },
        { name: "Tip", quantity: 1, priceMinor: 90, kind: "tip", personIds: [YOU, RAHUL, PRIYA] },
        { name: "Coupon", quantity: 1, priceMinor: 300, kind: "discount", personIds: [] },
      ],
    });
    const byId = Object.fromEntries(shares.map((row) => [row.personId, row.shareAmountMinor]));
    // Subtotals 500 / 1000 / 0. Tax 150 → 50 / 100 / 0. Tip 90 → 30 each. Coupon 300 → 100 / 200 / 0.
    expect(byId).toEqual({ [YOU]: 480, [RAHUL]: 930, [PRIYA]: 30 });
    expect(shares.reduce((sum, row) => sum + row.shareAmountMinor, 0)).toBe(1_440);
  });

  it("rejects items assigned to someone outside the split", () => {
    expect(() =>
      computeParticipantShares({
        totalAmountMinor: 100,
        method: "itemwise",
        participants: [{ personId: YOU }],
        items: [{ name: "Tea", quantity: 1, priceMinor: 100, kind: "item", personIds: [RAHUL] }],
      }),
    ).toThrow(/not in this split/);
  });
});

/** Seeded PRNG so failures are reproducible. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("financial invariants (property test, 3,000 random expenses)", () => {
  const people = [YOU, RAHUL, PRIYA, NEHA, "p-arjun-01", "p-meera-01"];

  it("holds for random shares, payers, adjustments and valid repayments", () => {
    const random = rng(20261014);
    const pick = (n: number) => Math.floor(random() * n);
    for (let run = 0; run < 3_000; run += 1) {
      const total = 1 + pick(5_000_000);
      const count = 1 + pick(people.length);
      const members = people.slice(0, count);
      const method = (["equal", "shares", "percentage"] as const)[pick(3)]!;
      const participants = computeParticipantShares({
        totalAmountMinor: total,
        method,
        participants: members.map((personId, index) => ({
          personId,
          shareValue: 1 + pick(5),
          sharePercentageBps:
            index === members.length - 1 ? 10_000 - Math.floor(10_000 / members.length) * (members.length - 1) : Math.floor(10_000 / members.length),
        })),
      }).map((row) => part(row.personId, row.shareAmountMinor));

      // Invariant 1: shares sum to the total.
      expect(participants.reduce((sum, row) => sum + row.shareAmountMinor, 0)).toBe(total);

      const payerCount = 1 + pick(Math.min(3, people.length));
      const payerIds = [...people].sort(() => random() - 0.5).slice(0, payerCount);
      const payerSplit = allocateByWeights(total, payerIds.map(() => 1 + pick(9)));
      const payers = payerIds
        .map((personId, index) => ({ personId, paidAmountMinor: payerSplit[index]! }))
        .filter((payer) => payer.paidAmountMinor > 0);

      // Invariant 2: upfront contributions sum to the total.
      expect(payers.reduce((sum, payer) => sum + payer.paidAmountMinor, 0)).toBe(total);

      const adjustments =
        random() < 0.3 && participants.length > 0
          ? [{ participantId: participants[0]!.id, amountMinor: -pick(participants[0]!.shareAmountMinor + 1) }]
          : [];
      let input: LedgerInput = { totalAmountMinor: total, payers, participants, adjustments, payments: [] };
      let ledger = computeSplitLedger(input);

      // Repay random amounts along current obligation edges only.
      for (let step = 0; step < 4 && ledger.obligations.length > 0; step += 1) {
        const edge = ledger.obligations[pick(ledger.obligations.length)]!;
        const amount = 1 + pick(edge.amountMinor);
        const check = checkRepayment(ledger, {
          payerPersonId: edge.debtorPersonId,
          receiverPersonId: edge.creditorPersonId,
          amountMinor: amount,
        });
        expect(check.ok).toBe(true);
        const before = ledger.summary.remainingMinor;
        input = {
          ...input,
          payments: [
            ...(input.payments ?? []),
            { payerPersonId: edge.debtorPersonId, receiverPersonId: edge.creditorPersonId, amountMinor: amount },
          ],
        };
        ledger = computeSplitLedger(input);
        // Invariant 5: a repayment reduces the outstanding total by exactly its amount.
        expect(ledger.summary.remainingMinor).toBe(before - amount);
      }

      // Invariant 3: positions are zero-sum, so total owed equals total receivable.
      const owed = ledger.balances.reduce((sum, row) => sum + row.owedMinor, 0);
      const receivable = ledger.balances.reduce((sum, row) => sum + row.receivableMinor, 0);
      expect(owed).toBe(receivable);
      expect(ledger.balances.reduce((sum, row) => sum + row.netMinor, 0)).toBe(0);
      // Obligation edges carry exactly the outstanding money and nobody owes themselves (invariant 4).
      expect(ledger.obligations.reduce((sum, edge) => sum + edge.amountMinor, 0)).toBe(owed);
      expect(ledger.obligations.every((edge) => edge.debtorPersonId !== edge.creditorPersonId)).toBe(true);
      // Invariant 6: absorption allocates every unassigned paisa.
      expect(ledger.balances.reduce((sum, row) => sum + row.adjustedShareMinor + row.absorbedMinor, 0)).toBe(total);
      // Invariant 7: valid repayments never overshoot an obligation.
      expect(ledger.balances.every((row) => row.overpaidMinor === 0)).toBe(true);
      expect(ledger.summary.collectedMinor).toBeLessThanOrEqual(ledger.summary.collectibleMinor);
    }
  });
});
