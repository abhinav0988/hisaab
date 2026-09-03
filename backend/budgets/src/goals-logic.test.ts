import { describe, expect, it } from "vitest";
import { goalStatus, nextGoalSaved } from "./goals-logic";

describe("nextGoalSaved", () => {
  it("adds a contribution to the saved balance", () => {
    expect(nextGoalSaved(50000, 25000)).toBe(75000);
  });
});

describe("goalStatus", () => {
  it("marks paused, completed, overdue, and active states", () => {
    expect(
      goalStatus({ isActive: true, savedAmountMinor: 10, targetAmountMinor: 100 }),
    ).toBe("active");
    expect(
      goalStatus({ isActive: false, savedAmountMinor: 10, targetAmountMinor: 100 }),
    ).toBe("paused");
    expect(
      goalStatus({ isActive: false, savedAmountMinor: 100, targetAmountMinor: 100 }),
    ).toBe("completed");
    expect(
      goalStatus({
        isActive: true,
        savedAmountMinor: 10,
        targetAmountMinor: 100,
        targetDate: "2026-01-01",
        today: "2026-09-03",
      }),
    ).toBe("overdue");
  });
});
