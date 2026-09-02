import { describe, expect, it } from "vitest";
import { adjustCreditSpend, creditSpendDelta } from "./credit-spend";

describe("creditSpendDelta", () => {
  it("returns positive delta for expenses and negative for income", () => {
    expect(creditSpendDelta("EXPENSE", 50000)).toBe(50000);
    expect(creditSpendDelta("INCOME", 50000)).toBe(-50000);
    expect(creditSpendDelta("EXPENSE", 0)).toBe(0);
  });
});

describe("adjustCreditSpend", () => {
  it("requires a facility id for card spend", async () => {
    const db = {
    query: {
      accounts: {
        findFirst: async () => ({ id: "acct-cc", type: "CREDIT_CARD", userId: "user-1" }),
      },
      creditUtilisationMonths: {
        findFirst: async () => null,
      },
    },
    insert: () => ({
      values: async () => undefined,
    }),
      select: () => ({
        from: () => ({
          where: async () => [
            {
              id: "fac-1",
              userId: "user-1",
              kind: "CARD",
              accountId: "acct-cc",
              name: "HDFC",
              usedMinor: 100000,
              todaySpendMinor: 0,
              holdMinor: 0,
              limitMinor: 5000000,
              overdueMinor: 0,
              minDueMinor: 0,
              dueOn: null,
            },
          ],
        }),
      }),
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    };

    const withoutFacility = await adjustCreditSpend(db as never, {
      userId: "user-1",
      accountId: "acct-cc",
      deltaMinor: 50000,
    });
    expect(withoutFacility).toBeNull();

    const withFacility = await adjustCreditSpend(db as never, {
      userId: "user-1",
      accountId: "acct-cc",
      facilityId: "fac-1",
      deltaMinor: 50000,
    });
    expect(withFacility).toMatchObject({
      facilityId: "fac-1",
      spentMinor: 50000,
      usedMinor: 150000,
      availableMinor: 4850000,
    });
  });
});
