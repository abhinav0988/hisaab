import { describe, expect, it } from "vitest";
import {
  splitWizardIssues,
  zodFieldErrors,
  allocateByPercentage,
  allocateByShares,
  allocateEqual,
  allocateExact,
  allocateItemwise,
  computeParticipantShares,
  deriveExpenseStatus,
  netBalanceForPerson,
  overpaidAmount,
  participantSettlementStatus,
  pendingAmount,
  simplifyDebts,
  splitExpenseSchema,
} from "./split-money";

describe("allocateEqual", () => {
  it("splits evenly when divisible", () => {
    expect(allocateEqual(600_000, 4)).toEqual([150_000, 150_000, 150_000, 150_000]);
  });

  it("handles uneven rounding so sum equals total (₹100 / 3)", () => {
    const parts = allocateEqual(10_000, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(parts).toEqual([3334, 3333, 3333]);
  });
});

describe("allocateByPercentage", () => {
  it("allocates by basis points totaling 100%", () => {
    const parts = allocateByPercentage(600_000, [4000, 2500, 2000, 1500]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(600_000);
    expect(parts[0]).toBe(240_000);
  });

  it("rejects non-100% totals", () => {
    expect(() => allocateByPercentage(100, [5000, 4000])).toThrow(/100%/);
  });
});

describe("allocateByShares", () => {
  it("supports 2:1:1 shares", () => {
    const parts = allocateByShares(600_000, [2, 1, 1]);
    expect(parts).toEqual([300_000, 150_000, 150_000]);
  });

  it("supports ₹4,000 as 2:1:1", () => {
    expect(allocateByShares(400_000, [2, 1, 1])).toEqual([200_000, 100_000, 100_000]);
  });
});

describe("currency precision edges", () => {
  it.each([1, 105, 9999, 10000, 150050, 9_999_999])(
    "equal split of %s paise across 3 people still sums exactly",
    (total) => {
      const parts = allocateEqual(total, 3);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    },
  );
});

describe("allocateExact", () => {
  it("validates exact amounts", () => {
    expect(allocateExact([200_000, 150_000, 100_000, 150_000], 600_000)).toEqual({
      ok: true,
      allocatedMinor: 600_000,
      remainingMinor: 0,
    });
    expect(allocateExact([100, 100], 300).remainingMinor).toBe(100);
  });
});

describe("allocateItemwise", () => {
  it("splits items, tax and tip across participants", () => {
    const totals = allocateItemwise({
      allPersonIds: ["a", "b", "c", "d"],
      items: [
        { name: "Pizza", quantity: 1, priceMinor: 80_000, kind: "item", personIds: ["a", "b"] },
        { name: "Coffee", quantity: 1, priceMinor: 40_000, kind: "item", personIds: ["c", "d"] },
        { name: "Tax", quantity: 1, priceMinor: 24_000, kind: "tax", personIds: [] },
        { name: "Tip", quantity: 1, priceMinor: 16_000, kind: "tip", personIds: [] },
      ],
    });
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    expect(sum).toBe(160_000);
  });
});

describe("computeParticipantShares", () => {
  it("equal split among 4 people", () => {
    const shares = computeParticipantShares({
      totalAmountMinor: 600_000,
      method: "equal",
      participants: [
        { personId: "p1" },
        { personId: "p2" },
        { personId: "p3" },
        { personId: "p4" },
      ],
    });
    expect(shares.every((s) => s.shareAmountMinor === 150_000)).toBe(true);
  });
});

describe("partial payments and overpayment", () => {
  it("tracks pending across multiple payments", () => {
    const share = 150_000;
    let paid = 0;
    paid += 50_000;
    expect(pendingAmount(share, paid)).toBe(100_000);
    expect(participantSettlementStatus(share, paid)).toBe("partially_paid");
    paid += 40_000;
    expect(pendingAmount(share, paid)).toBe(60_000);
    paid += 60_000;
    expect(pendingAmount(share, paid)).toBe(0);
    expect(participantSettlementStatus(share, paid)).toBe("paid");
  });

  it("detects overpayment", () => {
    expect(overpaidAmount(150_000, 200_000)).toBe(50_000);
    expect(participantSettlementStatus(150_000, 200_000)).toBe("overpaid");
  });

  it("applies adjustment / waiver to pending", () => {
    const original = 150_000;
    const adjusted = original - 20_000;
    const paid = 100_000;
    expect(pendingAmount(adjusted, paid)).toBe(30_000);
  });
});

describe("multiple payers vs settlement", () => {
  it("keeps payer contribution separate from settlement", () => {
    // Abhinav paid 4000, Rohit paid 2000; equal shares 1500 each
    const abhinav = netBalanceForPerson({
      personId: "a",
      payerContributionMinor: 400_000,
      shareAmountMinor: 150_000,
      settlementPaidMinor: 0,
      settlementReceivedMinor: 0,
    });
    const rohit = netBalanceForPerson({
      personId: "r",
      payerContributionMinor: 200_000,
      shareAmountMinor: 150_000,
      settlementPaidMinor: 0,
      settlementReceivedMinor: 0,
    });
    expect(abhinav).toBe(250_000);
    expect(rohit).toBe(50_000);
  });
});

describe("deriveExpenseStatus", () => {
  it("marks overdue when due date passed with pending", () => {
    expect(
      deriveExpenseStatus({
        participants: [{ adjustedShareMinor: 100, paidAmountMinor: 0 }],
        dueDate: "2020-01-01",
        today: "2026-10-05",
      }),
    ).toBe("overdue");
  });

  it("marks settled when fully paid", () => {
    expect(
      deriveExpenseStatus({
        participants: [
          { adjustedShareMinor: 50, paidAmountMinor: 50 },
          { adjustedShareMinor: 50, paidAmountMinor: 50 },
        ],
        today: "2026-10-05",
      }),
    ).toBe("settled");
  });

  it("marks almost settled near completion", () => {
    expect(
      deriveExpenseStatus({
        participants: [
          { adjustedShareMinor: 100, paidAmountMinor: 100 },
          { adjustedShareMinor: 100, paidAmountMinor: 90 },
        ],
        today: "2026-10-05",
      }),
    ).toBe("almost_settled");
  });
});

describe("simplifyDebts", () => {
  it("collapses A→B and B→C into A→C", () => {
    const result = simplifyDebts([
      { fromPersonId: "a", toPersonId: "b", amountMinor: 50_000 },
      { fromPersonId: "b", toPersonId: "c", amountMinor: 50_000 },
    ]);
    expect(result).toEqual([{ fromPersonId: "a", toPersonId: "c", amountMinor: 50_000 }]);
  });
});

describe("splitExpenseSchema", () => {
  it("requires payer total to match expense total", () => {
    const base = {
      title: "Dinner",
      category: "Food & Dining",
      totalAmountMinor: 600_000,
      expenseDate: "2026-10-05",
      payers: [{ personId: "person01", paidAmountMinor: 600_000 }],
      participants: [
        { personId: "person01" },
        { personId: "person02" },
      ],
    };
    expect(splitExpenseSchema.safeParse(base).success).toBe(true);
    expect(
      splitExpenseSchema.safeParse({
        ...base,
        payers: [{ personId: "person01", paidAmountMinor: 100 }],
      }).success,
    ).toBe(false);
  });
});

describe("create wizard issue mapping", () => {
  const valid = {
    title: "Snacks",
    category: "Food",
    totalAmountMinor: 10_000,
    expenseDate: "2026-10-16",
    expenseTime: "20:30",
    payers: [{ personId: "person-rohit-01", paidAmountMinor: 10_000 }],
    participants: [{ personId: "person-self-01" }, { personId: "person-rohit-01" }, { personId: "person-priya-01" }],
    reminder: { enabled: true, channels: ["in_app"], firstReminderDaysBefore: 2, frequencyDays: 2 },
  };

  it("accepts the ₹100 / 3 payload the web wizard sends", () => {
    expect(splitExpenseSchema.safeParse(valid).success).toBe(true);
  });

  it("routes every failing field to the wizard step that owns it, earliest first", () => {
    const parsed = splitExpenseSchema.safeParse({
      ...valid,
      expenseTime: "20:30:00",
      payers: [{ personId: "person-rohit-01", paidAmountMinor: 0 }],
      participants: [{ personId: "person-self-01" }, { personId: "person-self-01" }],
      reminder: { enabled: true, frequencyDays: 0 },
    });
    expect(parsed.success).toBe(false);
    const issues = splitWizardIssues(zodFieldErrors(parsed.error!));
    expect(issues.map((issue) => issue.step)).toEqual([...issues.map((issue) => issue.step)].sort());
    expect(issues[0]).toMatchObject({ step: 1, field: "date", label: "Time", path: "expenseTime" });
    expect(issues.find((issue) => issue.path === "payers.0.paidAmountMinor")).toMatchObject({ step: 2, field: "payer" });
    expect(issues.find((issue) => issue.path === "participants")).toMatchObject({ step: 3, field: "people" });
    expect(issues.find((issue) => issue.path === "reminder.frequencyDays")).toMatchObject({ step: 5, field: "reminder" });
  });

  it("maps server field errors with unknown roots to the details step instead of dropping them", () => {
    expect(splitWizardIssues({ form: ["Something is off"] })).toEqual([
      { step: 1, field: "form", label: "Expense", message: "Something is off", path: "form" },
    ]);
  });
});
