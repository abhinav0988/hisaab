import { describe, expect, it } from "vitest";
import { expensePeriods, previousMonth } from "./services/service";

function fakeEnv(result: { lastMonth: number; thisYear: number } | null) {
  const calls: { sql: string; binds: unknown[] }[] = [];
  const env = {
    DB: {
      prepare(sql: string) {
        return {
          bind(...binds: unknown[]) {
            calls.push({ sql, binds });
            return { first: async () => result };
          },
        };
      },
    },
  } as unknown as Env;
  return { env, calls };
}

describe("previousMonth", () => {
  it("steps back within a year and across January", () => {
    expect(previousMonth("2026-10")).toBe("2026-09");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("expensePeriods", () => {
  it("bounds last month and the calendar year in the user timezone", async () => {
    const { env, calls } = fakeEnv({ lastMonth: 1200, thisYear: 9800 });
    const result = await expensePeriods(
      env,
      "user-1",
      "2026-10",
      "2026-10-31T18:30:00.000Z",
      "Asia/Kolkata",
    );
    expect(result).toEqual({ spentLastMonth: 1200, spentThisYear: 9800 });
    expect(calls[0]?.binds).toEqual([
      "2026-08-31T18:30:00.000Z",
      "2026-09-30T18:30:00.000Z",
      "2025-12-31T18:30:00.000Z",
      "user-1",
      "2025-12-31T18:30:00.000Z",
      "2026-10-31T18:30:00.000Z",
    ]);
  });

  it("reaches into the previous year for January's last month", async () => {
    const { env, calls } = fakeEnv(null);
    const result = await expensePeriods(env, "user-1", "2026-01", "2026-02-01T00:00:00.000Z", "UTC");
    expect(result).toEqual({ spentLastMonth: 0, spentThisYear: 0 });
    expect(calls[0]?.binds.slice(0, 3)).toEqual([
      "2025-12-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
    expect(calls[0]?.binds[4]).toBe("2025-12-01T00:00:00.000Z");
  });
});
