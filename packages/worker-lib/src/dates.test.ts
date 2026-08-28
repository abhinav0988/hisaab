import { describe, expect, it } from "vitest";
import { addFrequency, monthBounds } from "./dates";

describe("date boundaries", () => {
  it("uses configured time zone for month start", () =>
    expect(monthBounds("2026-08", "Asia/Kolkata").from).toBe("2026-07-31T18:30:00.000Z"));
  it("advances recurring dates", () =>
    expect(addFrequency("2026-01-15T00:00:00.000Z", "WEEKLY")).toBe("2026-01-22T00:00:00.000Z"));
});
