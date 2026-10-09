import { lendReminderSchema, nextLendReminderRun } from "@hisaab/validation";
import { AppError, newId, now } from "@hisaab/worker-lib";
import type { z } from "zod";
import { getLendRecord } from "./service";

type ReminderInput = z.infer<typeof lendReminderSchema>;

type ReminderRow = {
  id: string;
  lendRecordId: string;
  enabled: number;
  remindAt: string;
  frequency: ReminderInput["frequency"];
  lastSentAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
};

function mapReminder(row: ReminderRow) {
  return {
    id: row.id,
    lendRecordId: row.lendRecordId,
    enabled: row.enabled === 1,
    remindAt: row.remindAt,
    frequency: row.frequency,
    lastSentAt: row.lastSentAt,
    nextRunAt: row.nextRunAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getLendReminder(env: Env, userId: string, lendRecordId: string) {
  await getLendRecord(env, userId, lendRecordId);
  const reminder = await env.DB.prepare(
    `SELECT id, lend_record_id AS lendRecordId, enabled, remind_at AS remindAt, frequency,
            last_sent_at AS lastSentAt, next_run_at AS nextRunAt, created_at AS createdAt, updated_at AS updatedAt
     FROM lend_reminders WHERE lend_record_id = ? AND user_id = ?`,
  )
    .bind(lendRecordId, userId)
    .first<ReminderRow>();
  const notices = await env.DB.prepare(
    `SELECT id, slot, channel, created_at AS createdAt
     FROM lend_reminder_deliveries
     WHERE reminder_id = ? AND user_id = ?
     ORDER BY created_at DESC LIMIT 20`,
  )
    .bind(reminder?.id ?? "", userId)
    .all<{ id: string; slot: string; channel: string; createdAt: string }>();
  return { reminder: reminder ? mapReminder(reminder) : null, notices: reminder ? notices.results : [] };
}

export async function putLendReminder(env: Env, userId: string, lendRecordId: string, input: ReminderInput) {
  const record = await getLendRecord(env, userId, lendRecordId);
  if (record.status === "settled" || record.repaymentStatus === "REPAID" || record.repaymentStatus === "OVERPAID") {
    throw new AppError(409, "REMINDER_SETTLED", "Settled records do not send reminders.");
  }
  const schedule = nextLendReminderRun({
    frequency: input.frequency,
    remindAt: input.remindAt,
    dueOn: record.dueOn,
    from: input.remindAt,
    afterSend: false,
  });
  if (!schedule.nextRunAt) throw new AppError(400, "INVALID_REMINDER", "Choose a valid reminder time.");
  const existing = await env.DB.prepare("SELECT id, created_at AS createdAt FROM lend_reminders WHERE lend_record_id = ? AND user_id = ?")
    .bind(lendRecordId, userId)
    .first<{ id: string; createdAt: string }>();
  const timestamp = now();
  const id = existing?.id ?? newId();
  if (existing) {
    await env.DB.prepare(
      `UPDATE lend_reminders
       SET enabled = ?, remind_at = ?, frequency = ?, next_run_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(input.enabled ? 1 : 0, input.remindAt, input.frequency, schedule.nextRunAt, timestamp, id, userId)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO lend_reminders
        (id, lend_record_id, user_id, enabled, remind_at, frequency, last_sent_at, next_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    )
      .bind(id, lendRecordId, userId, input.enabled ? 1 : 0, input.remindAt, input.frequency, schedule.nextRunAt, timestamp, timestamp)
      .run();
  }
  return getLendReminder(env, userId, lendRecordId);
}

export async function deleteLendReminder(env: Env, userId: string, lendRecordId: string) {
  await getLendRecord(env, userId, lendRecordId);
  const existing = await env.DB.prepare("SELECT id FROM lend_reminders WHERE lend_record_id = ? AND user_id = ?")
    .bind(lendRecordId, userId)
    .first<{ id: string }>();
  if (!existing) throw new AppError(404, "NOT_FOUND", "Reminder was not found.");
  await env.DB.prepare("DELETE FROM lend_reminders WHERE id = ? AND user_id = ?").bind(existing.id, userId).run();
}
