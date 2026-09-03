import { describe, expect, it } from "vitest";
import {
  lastTenDaySpend,
  merchantTone,
  niceAxis,
  paymentMode,
  percentChange,
  previousTenDaySpend,
  visiblePageNumbers,
} from "./tx-insights";
import type { Account, Transaction } from "@hisaab/types";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: "1",
  accountId: "a1",
  categoryId: "c1",
  type: "EXPENSE",
  amountMinor: 10000,
  currency: "INR",
  merchant: "Cafe",
  notes: null,
  transactionAt: "2026-09-03T08:00:00.000Z",
  ...overrides,
});

describe("merchantTone", () => {
  it("maps income and common merchants to the V21 icon families", () => {
    expect(merchantTone(tx({ type: "INCOME", categoryName: "Salary" }))).toBe("salary");
    expect(merchantTone(tx({ merchant: "Swiggy", categoryName: "Food and Dining" }))).toBe("food");
    expect(merchantTone(tx({ merchant: "Uber", categoryName: "Transport" }))).toBe("transport");
  });
});

describe("paymentMode", () => {
  it("labels UPI and cards from the account type", () => {
    expect(paymentMode({ type: "UPI", institutionName: "GPay", name: "UPI", id: "1" } as Account)).toEqual({
      method: "UPI",
      provider: "GPay",
    });
    expect(paymentMode({ type: "CREDIT_CARD", institutionName: null, name: "HDFC", id: "2" } as Account).method).toBe(
      "Card",
    );
  });
});

describe("ten-day spend", () => {
  it("buckets expenses into the last 10 local days and compares the previous 10", () => {
    const now = new Date(2026, 8, 3);
    const items = [
      tx({ transactionAt: "2026-09-03T10:00:00", amountMinor: 20000, type: "EXPENSE" }),
      tx({ id: "2", transactionAt: "2026-08-20T10:00:00", amountMinor: 10000, type: "EXPENSE" }),
      tx({ id: "3", transactionAt: "2026-09-03T11:00:00", amountMinor: 50000, type: "INCOME" }),
    ];
    const days = lastTenDaySpend(items, now);
    expect(days).toHaveLength(10);
    expect(days.at(-1)?.minor).toBe(20000);
    expect(previousTenDaySpend(items, now)).toBe(10000);
    expect(percentChange(20000, 10000).label).toMatch(/100\.0%/);
  });
});

describe("niceAxis", () => {
  it("rounds the chart ceiling to a readable rupee step", () => {
    expect(niceAxis(585000)).toBe(1000000);
  });
});

describe("visiblePageNumbers", () => {
  it("keeps a five-page window around the current page", () => {
    expect(visiblePageNumbers(1, 9)).toEqual([1, 2, 3, 4, 5]);
    expect(visiblePageNumbers(8, 9)).toEqual([5, 6, 7, 8, 9]);
  });
});
