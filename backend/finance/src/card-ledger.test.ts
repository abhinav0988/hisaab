import { describe, expect, it } from "vitest";
import { mapCardLedgerRow } from "./card-ledger";

describe("mapCardLedgerRow", () => {
  it("normalizes amounts and keeps payment vs spend types", () => {
    expect(
      mapCardLedgerRow({
        id: "1",
        type: "INCOME",
        amountMinor: 40000,
        transactionAt: "2026-09-03T00:00:00.000Z",
      }),
    ).toMatchObject({ type: "INCOME", amountMinor: 40000 });
    expect(
      mapCardLedgerRow({
        id: "2",
        type: "EXPENSE",
        amountMinor: "1500" as unknown as number,
        transactionAt: "2026-09-02T00:00:00.000Z",
      }).amountMinor,
    ).toBe(1500);
  });
});
