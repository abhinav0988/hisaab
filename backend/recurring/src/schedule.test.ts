import { describe, expect, it } from "vitest";
import { nextRecurringRun, shouldSkipDuplicateOccurrence } from "./schedule";

describe("nextRecurringRun", () => {
  it("advances weekly and monthly schedules", () => {
    expect(nextRecurringRun("2026-01-15T00:00:00.000Z", "WEEKLY")).toBe("2026-01-22T00:00:00.000Z");
    expect(nextRecurringRun("2026-01-15T00:00:00.000Z", "MONTHLY")).toBe("2026-02-15T00:00:00.000Z");
  });
});

describe("shouldSkipDuplicateOccurrence", () => {
  it("skips when an occurrence row already exists", () => {
    expect(shouldSkipDuplicateOccurrence("occ-1")).toBe(true);
    expect(shouldSkipDuplicateOccurrence(null)).toBe(false);
  });
});
