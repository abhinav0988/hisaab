import { describe, expect, it } from "vitest";
import { processLendReminders } from "./lend-reminders";

function memoryDb() {
  const reminders = [
    {
      id: "rem-1",
      userId: "user-1",
      frequency: "ONCE" as const,
      remindAt: "2026-10-09T08:00:00.000Z",
      nextRunAt: "2026-10-09T08:00:00.000Z",
      status: "pending",
      dueOn: "2026-10-12",
      enabled: 1,
    },
  ];
  const deliveries: Array<{ reminderId: string; slot: string; channel: string }> = [];
  return {
    reminders,
    deliveries,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all() {
              if (sql.includes("FROM lend_reminders")) {
                return { results: reminders.filter((row) => row.enabled === 1 && row.nextRunAt <= String(args[0])) };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes("INSERT INTO lend_reminder_deliveries")) {
                const slot = String(args[3]);
                const reminderId = String(args[1]);
                if (deliveries.some((row) => row.reminderId === reminderId && row.slot === slot && row.channel === "in_app")) {
                  return { meta: { changes: 0 } };
                }
                deliveries.push({ reminderId, slot, channel: "in_app" });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE lend_reminders")) {
                const row = reminders.find((item) => item.id === args[4]);
                if (row) {
                  row.enabled = Number(args[2]);
                  row.nextRunAt = String(args[1] ?? row.nextRunAt);
                }
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

describe("lend reminder delivery", () => {
  it("surfaces one in-app notice and ignores a cron retry for the same slot", async () => {
    const db = memoryDb();
    const env = { DB: db } as unknown as Env;
    const first = await processLendReminders(env, new Date("2026-10-09T09:00:00.000Z"));
    const second = await processLendReminders(env, new Date("2026-10-09T09:05:00.000Z"));
    expect(first).toMatchObject({ surfaced: 1, channel: "in_app", email: "DELIVERY_CHANNEL_BLOCKED" });
    expect(second.surfaced).toBe(0);
    expect(db.deliveries).toHaveLength(1);
    expect(db.reminders[0]?.enabled).toBe(0);
  });
});
