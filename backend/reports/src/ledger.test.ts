import { describe, expect, it } from "vitest";
import { incomeExpenseFor } from "./ledger";

describe("incomeExpenseFor", () => {
  it("counts income and expense rows", () => {
    expect(incomeExpenseFor({ transactionAt: "", type: "INCOME", amountMinor: 100 })).toEqual({
      income: 100,
      expense: 0,
    });
    expect(incomeExpenseFor({ transactionAt: "", type: "EXPENSE", amountMinor: 40 })).toEqual({
      income: 0,
      expense: 40,
    });
  });

  it("excludes unfiltered transfers from income and expense", () => {
    expect(
      incomeExpenseFor({
        transactionAt: "",
        type: "TRANSFER",
        amountMinor: 50,
        accountId: "a",
        destinationAccountId: "b",
      }),
    ).toEqual({ income: 0, expense: 0 });
  });

  it("treats a transfer as an outflow on the source bank and inflow on the destination", () => {
    const row = {
      transactionAt: "",
      type: "TRANSFER",
      amountMinor: 50,
      accountId: "source",
      destinationAccountId: "dest",
    };
    expect(incomeExpenseFor(row, ["source"])).toEqual({ income: 0, expense: 50 });
    expect(incomeExpenseFor(row, ["dest"])).toEqual({ income: 50, expense: 0 });
    expect(incomeExpenseFor(row, ["source", "dest"])).toEqual({ income: 50, expense: 50 });
  });
});
