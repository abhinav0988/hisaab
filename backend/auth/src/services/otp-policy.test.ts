import { describe, expect, it } from "vitest";
import { shouldExposeSignupOtp } from "./otp-policy";

describe("shouldExposeSignupOtp", () => {
  it("returns the code in local and e2e environments but not production", () => {
    expect(shouldExposeSignupOtp({ ENVIRONMENT: "development" })).toBe(true);
    expect(shouldExposeSignupOtp({ ENVIRONMENT: "production" })).toBe(false);
    expect(
      shouldExposeSignupOtp({ ENVIRONMENT: "production", E2E_DISABLE_RATE_LIMIT: "1" }),
    ).toBe(true);
    expect(shouldExposeSignupOtp({ ENVIRONMENT: "production", AUTH_DEV_EXPOSE_OTP: "true" })).toBe(
      true,
    );
  });
});
