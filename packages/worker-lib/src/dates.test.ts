import { describe, expect, it } from "vitest";
import { addFrequency, monthBounds } from "./dates";
import { timingSafeEqual } from "./http";

describe("date boundaries", () => {
  it("uses configured time zone for month start", () =>
    expect(monthBounds("2026-08", "Asia/Kolkata").from).toBe("2026-07-31T18:30:00.000Z"));
  it("advances recurring dates", () =>
    expect(addFrequency("2026-01-15T00:00:00.000Z", "WEEKLY")).toBe("2026-01-22T00:00:00.000Z"));
});

describe("timingSafeEqual", () => {
  it("accepts matching secrets", () => expect(timingSafeEqual("hisaab", "hisaab")).toBe(true));
  it("rejects different secrets of the same length", () =>
    expect(timingSafeEqual("hisaab", "hisaaB")).toBe(false));
  it("rejects different lengths", () => expect(timingSafeEqual("1", "11")).toBe(false));
});

describe("date boundaries", () => {
  it("uses configured time zone for month start", () =>
    expect(monthBounds("2026-08", "Asia/Kolkata").from).toBe("2026-07-31T18:30:00.000Z"));
  it("advances recurring dates", () =>
    expect(addFrequency("2026-01-15T00:00:00.000Z", "WEEKLY")).toBe("2026-01-22T00:00:00.000Z"));
});
