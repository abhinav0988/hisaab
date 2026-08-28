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
