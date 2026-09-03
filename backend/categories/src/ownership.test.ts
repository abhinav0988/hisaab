import { describe, expect, it } from "vitest";
import { canMutateCategory } from "./ownership";

describe("canMutateCategory", () => {
  it("allows only the owner to change a non-system category", () => {
    expect(canMutateCategory({ userId: "u1", isSystem: false }, "u1")).toBe(true);
    expect(canMutateCategory({ userId: "u1", isSystem: true }, "u1")).toBe(false);
    expect(canMutateCategory({ userId: null, isSystem: false }, "u1")).toBe(false);
    expect(canMutateCategory({ userId: "u2", isSystem: false }, "u1")).toBe(false);
  });
});
