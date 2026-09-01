import { describe, expect, it } from "vitest";
import { budgetUsage, majorToMinor, savingsRate, signInSchema, signUpSchema } from "./index";

describe("financial helpers", () => {
  it("converts decimal strings without floating point storage", () =>
    expect(majorToMinor("1000.50")).toBe(100050));
  it("rejects excess decimal places", () => expect(() => majorToMinor("1.001")).toThrow());
  it("calculates budget overage", () =>
    expect(budgetUsage(10000, 12000)).toEqual({
      spentMinor: 12000,
      remainingMinor: -2000,
      percentageUsed: 120,
    }));
  it("handles zero-income savings rates", () => expect(savingsRate(0, 100)).toBe(0));
});

describe("finance module validation", () => {
  it("accepts an investment payload", async () => {
    const { investmentSchema } = await import("./index");
    expect(
      investmentSchema.safeParse({
        name: "Nifty 50 Index",
        type: "Index MF",
        investedMinor: 12000000,
        currentMinor: 12675000,
        currency: "INR",
      }).success,
    ).toBe(true);
  });

  it("accepts a loan schedule payload and rejects remaining past total", async () => {
    const { loanSchema } = await import("./index");
    const base = {
      name: "Home Loan",
      lender: "HDFC Bank",
      principalMinor: 100000000,
      emiMinor: 1850000,
      totalEmis: 60,
      remainingEmis: 41,
      emiDay: 10,
      currency: "INR" as const,
    };
    expect(loanSchema.safeParse(base).success).toBe(true);
    expect(loanSchema.safeParse({ ...base, rate: "" }).success).toBe(true);
    expect(loanSchema.safeParse({ ...base, remainingEmis: 61 }).success).toBe(false);
  });

  it("accepts a credit card payload with billing dates", async () => {
    const { creditFacilitySchema, creditSummary } = await import("./index");
    expect(
      creditFacilitySchema.safeParse({
        kind: "CARD",
        name: "HDFC Regalia",
        mask: "•••• 1234",
        limitMinor: 15000000,
        usedMinor: 4500000,
        overdueMinor: 500000,
        todaySpendMinor: 4500000,
        cycleStartOn: "2026-09-01",
        dueOn: "2026-09-15",
        currency: "INR",
      }).success,
    ).toBe(true);
    expect(creditSummary({ limitMinor: 15000000, usedMinor: 4500000, overdueMinor: 500000, todaySpendMinor: 4500000 })).toEqual({
      limitMinor: 15000000,
      usedMinor: 4500000,
      overdueMinor: 500000,
      todaySpendMinor: 4500000,
      holdMinor: 0,
      minDueMinor: 0,
      availableMinor: 10500000,
      usedPct: 30,
    });
    expect(
      creditSummary({
        limitMinor: 15000000,
        usedMinor: 4500000,
        holdMinor: 250000,
        todaySpendMinor: 850000,
      }),
    ).toMatchObject({
      holdMinor: 250000,
      todaySpendMinor: 850000,
      availableMinor: 10250000,
      usedPct: 31.7,
    });
  });

  it("marks a card payment as done and advances the due date", async () => {
    const { applyCardPayment, cardDueAmount, cardPaidThisCycle, creditOverview } = await import("./index");
    expect(cardDueAmount({ overdueMinor: 525000, minDueMinor: 300000 })).toBe(525000);
    expect(cardDueAmount({ overdueMinor: 0, minDueMinor: 300000 })).toBe(300000);
    expect(
      creditOverview({ limitMinor: 25000000, usedMinor: 9245000, overdueMinor: 525000 }),
    ).toEqual({
      limitMinor: 25000000,
      usedMinor: 9245000,
      availableMinor: 15755000,
      overdueMinor: 525000,
      usedPct: 37,
      availablePct: 63,
      overduePct: 2.1,
    });
    expect(
      applyCardPayment({
        usedMinor: 5875000,
        overdueMinor: 0,
        minDueMinor: 300000,
        dueOn: "2026-09-15",
        now: new Date(2026, 8, 1),
      }),
    ).toEqual({
      usedMinor: 5575000,
      overdueMinor: 0,
      lastPaidOn: "2026-09-01",
      dueOn: "2026-10-15",
      paidMinor: 300000,
    });
    expect(
      applyCardPayment({
        usedMinor: 5875000,
        overdueMinor: 0,
        minDueMinor: 300000,
        dueOn: "2026-10-15",
        lastPaidOn: "2026-09-01",
        now: new Date(2026, 8, 1),
      }),
    ).toBeNull();
    expect(cardPaidThisCycle("2026-09-01", "2026-10-15", new Date(2026, 8, 1))).toBe(true);
    expect(cardPaidThisCycle("2026-09-01", "2026-10-15", new Date(2026, 9, 1))).toBe(false);
  });
});

describe("loan summary", () => {
  it("matches the add-loan live summary example", async () => {
    const { loanSummary, nextEmiDate, ordinal } = await import("./index");
    expect(ordinal(10)).toBe("10th");
    expect(ordinal(1)).toBe("1st");
    expect(nextEmiDate(10, new Date(2026, 8, 1))).toBe("2026-09-10");
    expect(nextEmiDate(10, new Date(2026, 8, 10))).toBe("2026-09-10");
    expect(nextEmiDate(10, new Date(2026, 8, 11))).toBe("2026-10-10");
    expect(
      loanSummary({
        principalMinor: 100000000,
        emiMinor: 1850000,
        totalEmis: 60,
        remainingEmis: 41,
        emiDay: 10,
        now: new Date(2026, 8, 1),
      }),
    ).toEqual({
      paidEmis: 19,
      paidMinor: 35150000,
      remainingEmis: 41,
      remainingPayableMinor: 75850000,
      totalPayableMinor: 111000000,
      interestMinor: 11000000,
      completionPct: 31.7,
      nextDue: "2026-09-10",
    });
  });

  it("builds a remaining EMI schedule from the next due date", async () => {
    const { addCalendarMonths, emiDueCopy, loanSchedule } = await import("./index");
    expect(addCalendarMonths("2026-09-10", 1)).toBe("2026-10-10");
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(emiDueCopy("2026-09-10", new Date(2026, 8, 1)).label).toBe("In 9 days");
    expect(emiDueCopy("2026-09-01", new Date(2026, 8, 5)).label).toBe("Overdue 4 days");
    const items = loanSchedule({
      emiMinor: 1850000,
      totalEmis: 60,
      remainingEmis: 41,
      dueOn: "2026-09-10",
      now: new Date(2026, 8, 1),
    });
    expect(items).toHaveLength(60);
    expect(items[0]).toMatchObject({ installment: 1, status: "paid" });
    expect(items[18]).toMatchObject({ installment: 19, dueOn: "2026-08-10", status: "paid" });
    expect(items[19]).toMatchObject({ installment: 20, dueOn: "2026-09-10", status: "pending" });
    expect(items[20]).toMatchObject({ installment: 21, dueOn: "2026-10-10", status: "upcoming" });
  });

  it("marks the current EMI as paid and advances the next due date", async () => {
    const { applyPaidEmi } = await import("./index");
    expect(
      applyPaidEmi({
        remainingEmis: 41,
        dueOn: "2026-09-10",
        emiMinor: 1850000,
        principalMinor: 100000000,
        totalEmis: 60,
        emiDay: 10,
      }),
    ).toEqual({
      remainingEmis: 40,
      dueOn: "2026-10-10",
      outstandingMinor: 74000000,
      progress: 33,
      paidMinor: 37000000,
    });
    expect(
      applyPaidEmi({
        remainingEmis: 0,
        dueOn: "2026-09-10",
        emiMinor: 1850000,
        principalMinor: 100000000,
        totalEmis: 60,
        emiDay: 10,
      }),
    ).toBeNull();
  });
});

describe("registration validation", () => {
  it("rejects passwords without a number", () => {
    expect(
      signUpSchema.safeParse({
        name: "A User",
        email: "a@example.com",
        password: "password",
        countryCode: "IN",
        rememberMe: true,
      }).success,
    ).toBe(false);
  });
  it("accepts the premium auth signup shape", () => {
    expect(
      signUpSchema.safeParse({
        name: "Asha Sharma",
        email: "asha@example.com",
        password: "Secure123",
        countryCode: "IN",
        rememberMe: true,
      }).success,
    ).toBe(true);
  });
  it("accepts sign-in credentials", () => {
    expect(
      signInSchema.safeParse({
        email: "asha@example.com",
        password: "Secure123",
        rememberMe: true,
      }).success,
    ).toBe(true);
  });
});
