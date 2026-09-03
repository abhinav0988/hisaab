import { describe, expect, it } from "vitest";
import { incomeExpenseFor } from "./ledger";

describe("incomeExpenseFor", () => {
  it("counts a filtered transfer as a bank outflow or inflow", () => {
    const row = {
      transactionAt: "",
      type: "TRANSFER",
      amountMinor: 50,
      accountId: "source",
      destinationAccountId: "dest",
    };
    expect(incomeExpenseFor(row)).toEqual({ income: 0, expense: 0 });
    expect(incomeExpenseFor(row, ["source"])).toEqual({ income: 0, expense: 50 });
  });
});
