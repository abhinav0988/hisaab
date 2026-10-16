import { describe, expect, it } from "vitest";
import { processSplitReminders } from "./split-reminders";

type ReminderRow = {
  id: string;
  expenseId: string;
  channel: string;
  scheduledAt: string;
  frequency: string | null;
  status: string;
  sentAt: string | null;
  stopAfterSettlement: number;
};

function memoryDb(rows: ReminderRow[], expenses: Record<string, { status: string; isDraft: number }>) {
  const activities: Array<{ action: string; expenseId: string }> = [];
  const db = {
    rows,
    activities,
    prepare(sql: string) {
      const statement = {
        args: [] as unknown[],
        bind(...args: unknown[]) {
          statement.args = args;
          return statement;
        },
        async all() {
          if (sql.includes("FROM split_reminders r")) {
            const until = String(statement.args[0]);
            return {
              results: rows
                .filter((row) => row.status === "scheduled" && row.scheduledAt <= until)
                .map((row) => ({
                  id: row.id,
                  expenseId: row.expenseId,
                  userId: "user-1",
                  groupId: null,
                  channel: row.channel,
                  scheduledAt: row.scheduledAt,
                  frequency: row.frequency,
                  stopAfterSettlement: row.stopAfterSettlement,
                  expenseStatus: expenses[row.expenseId]?.status ?? "pending",
                  isDraft: expenses[row.expenseId]?.isDraft ?? 0,
                  message: null,
                })),
            };
          }
          return { results: [] };
        },
        async run() {
          if (sql.startsWith("UPDATE split_reminders SET status = 'cancelled'")) {
            const row = rows.find((item) => item.id === statement.args[1] && item.status === "scheduled");
            if (!row) return { meta: { changes: 0 } };
            row.status = "cancelled";
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("UPDATE split_reminders SET status = 'failed'")) {
            const row = rows.find((item) => item.id === statement.args[1] && item.status === "scheduled");
            if (!row) return { meta: { changes: 0 } };
            row.status = "failed";
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("UPDATE split_reminders SET status = 'sent'")) {
            const row = rows.find((item) => item.id === statement.args[2] && item.status === "scheduled");
            if (!row) return { meta: { changes: 0 } };
            row.status = "sent";
            row.sentAt = String(statement.args[0]);
            return { meta: { changes: 1 } };
          }
          if (sql.includes("INSERT INTO split_activities")) {
            activities.push({ action: sql.includes("reminder_sent") ? "reminder_sent" : "reminder_delivery_unavailable", expenseId: String(statement.args[1]) });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("INSERT INTO split_reminders")) {
            const source = rows.find((item) => item.id === statement.args[4]);
            if (source) {
              rows.push({ ...source, id: String(statement.args[0]), scheduledAt: String(statement.args[1]), status: "scheduled", sentAt: null });
            }
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return statement;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      for (const statement of statements) await statement.run();
      return [];
    },
  };
  return db;
}

describe("split reminder delivery", () => {
  it("delivers a due in-app reminder exactly once across cron retries", async () => {
    const db = memoryDb(
      [{ id: "r1", expenseId: "e1", channel: "in_app", scheduledAt: "2026-10-10T08:00:00.000Z", frequency: null, status: "scheduled", sentAt: null, stopAfterSettlement: 1 }],
      { e1: { status: "pending", isDraft: 0 } },
    );
    const env = { DB: db } as unknown as Env;
    const first = await processSplitReminders(env, new Date("2026-10-10T09:00:00.000Z"));
    const second = await processSplitReminders(env, new Date("2026-10-10T09:15:00.000Z"));
    expect(first).toMatchObject({ sent: 1, cancelled: 0, unavailable: 0, channel: "in_app" });
    expect(second.sent).toBe(0);
    expect(db.rows[0]).toMatchObject({ status: "sent", sentAt: "2026-10-10T09:00:00.000Z" });
    expect(db.activities.filter((a) => a.action === "reminder_sent")).toHaveLength(1);
  });

  it("does not deliver future reminders", async () => {
    const db = memoryDb(
      [{ id: "r1", expenseId: "e1", channel: "in_app", scheduledAt: "2026-10-12T08:00:00.000Z", frequency: null, status: "scheduled", sentAt: null, stopAfterSettlement: 1 }],
      { e1: { status: "pending", isDraft: 0 } },
    );
    const result = await processSplitReminders({ DB: db } as unknown as Env, new Date("2026-10-10T09:00:00.000Z"));
    expect(result.sent).toBe(0);
    expect(db.rows[0]?.status).toBe("scheduled");
  });

  it("cancels reminders for settled expenses instead of sending them", async () => {
    const db = memoryDb(
      [{ id: "r1", expenseId: "e1", channel: "in_app", scheduledAt: "2026-10-10T08:00:00.000Z", frequency: null, status: "scheduled", sentAt: null, stopAfterSettlement: 1 }],
      { e1: { status: "settled", isDraft: 0 } },
    );
    const result = await processSplitReminders({ DB: db } as unknown as Env, new Date("2026-10-10T09:00:00.000Z"));
    expect(result).toMatchObject({ sent: 0, cancelled: 1 });
    expect(db.rows[0]?.status).toBe("cancelled");
  });

  it("marks external channels as failed with an explicit reason rather than faking delivery", async () => {
    const db = memoryDb(
      [{ id: "r1", expenseId: "e1", channel: "email", scheduledAt: "2026-10-10T08:00:00.000Z", frequency: null, status: "scheduled", sentAt: null, stopAfterSettlement: 1 }],
      { e1: { status: "pending", isDraft: 0 } },
    );
    const result = await processSplitReminders({ DB: db } as unknown as Env, new Date("2026-10-10T09:00:00.000Z"));
    expect(result).toMatchObject({ sent: 0, unavailable: 1, externalChannels: "DELIVERY_CHANNEL_BLOCKED" });
    expect(db.rows[0]?.status).toBe("failed");
    expect(db.activities[0]?.action).toBe("reminder_delivery_unavailable");
  });

  it("re-schedules recurring reminders strictly in the future", async () => {
    const db = memoryDb(
      [{ id: "r1", expenseId: "e1", channel: "in_app", scheduledAt: "2026-10-01T08:00:00.000Z", frequency: "every_2_days", status: "scheduled", sentAt: null, stopAfterSettlement: 1 }],
      { e1: { status: "pending", isDraft: 0 } },
    );
    const result = await processSplitReminders({ DB: db } as unknown as Env, new Date("2026-10-10T09:00:00.000Z"));
    expect(result).toMatchObject({ sent: 1, rescheduled: 1 });
    expect(db.rows).toHaveLength(2);
    expect(db.rows[1]?.status).toBe("scheduled");
    expect(db.rows[1]?.scheduledAt).toBe("2026-10-11T08:00:00.000Z");
  });
});
