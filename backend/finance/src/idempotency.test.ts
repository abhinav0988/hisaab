import { describe, expect, it } from "vitest";
import { parseIdempotencyKey } from "./idempotency";

describe("payment idempotency keys", () => {
  it("accepts a client key and rejects a short or unsafe one", () => {
    expect(parseIdempotencyKey(undefined)).toBeNull();
    expect(parseIdempotencyKey("loan-pay-001")).toBe("loan-pay-001");
    expect(() => parseIdempotencyKey("bad key")).toThrow(/Idempotency-Key/);
    expect(() => parseIdempotencyKey("short")).toThrow(/Idempotency-Key/);
  });
});
