import { describe, expect, it } from "vitest";
import { profileRegionDefaults } from "./patch";

describe("profileRegionDefaults", () => {
  it("fills INR and Asia/Kolkata for India", () => {
    expect(profileRegionDefaults("IN")).toMatchObject({
      defaultCurrency: "INR",
      timezone: "Asia/Kolkata",
    });
    expect(profileRegionDefaults("IN", { defaultCurrency: "NPR" })).toEqual({
      timezone: "Asia/Kolkata",
    });
  });

  it("returns nothing when the country is missing", () => {
    expect(profileRegionDefaults(null)).toEqual({});
  });
});
