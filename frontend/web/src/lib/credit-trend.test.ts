import { describe, expect, it } from "vitest";
import { buildSpendingTrend, cardOutstandingDelta } from "./credit-trend";

describe("cardOutstandingDelta", () => {
  it("increases outstanding for expenses and decreases for payments", () => {
    expect(cardOutstandingDelta("EXPENSE", 50000)).toBe(50000);
    expect(cardOutstandingDelta("INCOME", 20000)).toBe(-20000);
    expect(cardOutstandingDelta("TRANSFER", 10000)).toBe(0);
  });
});

describe("buildSpendingTrend", () => {
  it("reconstructs outstanding from dated spend and payment, not a flat current balance", () => {
    const now = new Date("2026-09-03T12:00:00");
    const pack = buildSpendingTrend(
      [
        {
          id: "spend",
          type: "EXPENSE",
          amountMinor: 100000,
          transactionAt: "2026-09-02T08:00:00.000Z",
        },
        {
          id: "pay",
          type: "INCOME",
          amountMinor: 40000,
          transactionAt: "2026-09-03T08:00:00.000Z",
        },
      ],
      100000,
      160000,
      500000,
      now,
    );
    const first = pack.points[0]!;
    const last = pack.points.at(-1)!;
    const beforePay = pack.points.at(-2)!;
    expect(last.outstandingMinor).toBe(160000);
    expect(beforePay.outstandingMinor).toBe(200000);
    expect(first.outstandingMinor).toBe(100000);
    expect(last.spendMinor).toBe(100000);
  });
});
