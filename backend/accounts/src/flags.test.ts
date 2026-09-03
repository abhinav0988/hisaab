import { describe, expect, it } from "vitest";
import { flagOn } from "./flags";

describe("flagOn", () => {
  it("treats sqlite 1/true as active and 0/false as inactive", () => {
    expect(flagOn(true)).toBe(true);
    expect(flagOn(1)).toBe(true);
    expect(flagOn("1")).toBe(true);
    expect(flagOn(false)).toBe(false);
    expect(flagOn(0)).toBe(false);
    expect(flagOn(null)).toBe(false);
  });
});
