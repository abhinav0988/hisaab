import { describe, expect, it } from "vitest";
import { transferDestinationError } from "./transfer";

describe("transferDestinationError", () => {
  it("ignores income and expense", () => {
    expect(transferDestinationError({ type: "EXPENSE", accountId: "a" })).toBeNull();
  });

  it("requires a different destination account", () => {
    expect(transferDestinationError({ type: "TRANSFER", accountId: "a" })).toMatch(/destination/);
    expect(
      transferDestinationError({ type: "TRANSFER", accountId: "a", destinationAccountId: "a" }),
    ).toMatch(/different/);
    expect(
      transferDestinationError({ type: "TRANSFER", accountId: "a", destinationAccountId: "b" }),
    ).toBeNull();
  });
});
