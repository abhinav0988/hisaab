import { nextLendReminderRun, type lendReminderFrequencySchema } from "@hisaab/validation";
import type { z } from "zod";

type Frequency = z.infer<typeof lendReminderFrequencySchema>;

type DueReminder = {
  id: string;
  userId: string;
  frequency: Frequency;
  remindAt: string;
  nextRunAt: string;
  status: string;
  dueOn: string;
};

/**
 * In-app notices are the delivery channel this scheduler can actually write.
 * Auth email (Resend) is not bound on the recurring worker, so no email is sent.
 */
export async function processLendReminders(env: Env, now: Date) {
  const iso = now.toISOString();
  const due = await env.DB.prepare(
    `SELECT r.id, r.user_id AS userId, r.frequency, r.remind_at AS remindAt, r.next_run_at AS nextRunAt,
            l.status, l.due_on AS dueOn
     FROM lend_reminders r
     JOIN lend_records l ON l.id = r.lend_record_id AND l.user_id = r.user_id
     WHERE r.enabled = 1 AND r.next_run_at <= ?`,
  )
    .bind(iso)
    .all<DueReminder>();

  let surfaced = 0;
  for (const row of due.results) {
    if (row.status === "settled") {
      await env.DB.prepare("UPDATE lend_reminders SET enabled = 0, updated_at = ? WHERE id = ?")
        .bind(iso, row.id)
        .run();
      continue;
    }
    const inserted = await env.DB.prepare(
      `INSERT INTO lend_reminder_deliveries (id, reminder_id, user_id, slot, channel, created_at)
       VALUES (?, ?, ?, ?, 'in_app', ?)
       ON CONFLICT(reminder_id, slot, channel) DO NOTHING`,
    )
      .bind(crypto.randomUUID(), row.id, row.userId, row.nextRunAt, iso)
      .run();
    if (!inserted.meta.changes) continue;
    const next = nextLendReminderRun({
      frequency: row.frequency,
      remindAt: row.remindAt,
      dueOn: row.dueOn,
      from: row.nextRunAt,
      afterSend: true,
    });
    await env.DB.prepare(
      `UPDATE lend_reminders
       SET last_sent_at = ?, next_run_at = COALESCE(?, next_run_at), enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(iso, next.nextRunAt, next.enabled ? 1 : 0, iso, row.id)
      .run();
    surfaced += 1;
  }
  return { surfaced, channel: "in_app" as const, email: "DELIVERY_CHANNEL_BLOCKED" as const };
}
