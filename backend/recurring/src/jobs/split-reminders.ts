type DueSplitReminder = {
  id: string;
  expenseId: string;
  userId: string;
  groupId: string | null;
  channel: string;
  scheduledAt: string;
  frequency: string | null;
  stopAfterSettlement: number;
  expenseStatus: string;
  isDraft: number;
  message: string | null;
};

const CLOSED_STATUSES = new Set(["settled", "cancelled", "overpaid"]);

/** `every_N_days` → N, otherwise null (one-off reminder). */
function repeatDays(frequency: string | null) {
  const match = /^every_(\d+)_days$/.exec(frequency ?? "");
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isInteger(days) && days > 0 ? days : null;
}

/**
 * Delivers due Split Money reminders.
 *
 * Only the in-app channel can be written by this worker: the reminder row itself
 * flips to `sent` (with `sent_at`) and an activity row is logged, which is what the
 * expense detail screens show. Email / WhatsApp / SMS have no connected provider on
 * this worker, so those rows are marked `failed` with an explicit reason instead of
 * pretending they were delivered.
 *
 * Every state change uses a conditional UPDATE on `status = 'scheduled'`, so a cron
 * retry (or two overlapping runs) can never deliver the same reminder twice.
 */
export async function processSplitReminders(env: Env, now: Date) {
  const iso = now.toISOString();
  const due = await env.DB.prepare(
    `SELECT r.id, r.expense_id AS expenseId, e.user_id AS userId, e.group_id AS groupId, r.channel,
            r.scheduled_at AS scheduledAt, r.frequency, r.stop_after_settlement AS stopAfterSettlement,
            e.status AS expenseStatus, e.is_draft AS isDraft, r.message
     FROM split_reminders r
     JOIN split_expenses e ON e.id = r.expense_id
     WHERE r.status = 'scheduled' AND r.scheduled_at <= ?
     ORDER BY r.scheduled_at ASC
     LIMIT 200`,
  )
    .bind(iso)
    .all<DueSplitReminder>();

  let sent = 0;
  let cancelled = 0;
  let unavailable = 0;
  let rescheduled = 0;

  for (const row of due.results) {
    const closed = CLOSED_STATUSES.has(row.expenseStatus) || row.isDraft === 1;
    if (closed && row.stopAfterSettlement === 1) {
      const result = await env.DB.prepare(
        "UPDATE split_reminders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'scheduled'",
      )
        .bind(iso, row.id)
        .run();
      if (result.meta.changes) cancelled += 1;
      continue;
    }

    if (row.channel !== "in_app") {
      const result = await env.DB.prepare(
        "UPDATE split_reminders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'scheduled'",
      )
        .bind(iso, row.id)
        .run();
      if (!result.meta.changes) continue;
      unavailable += 1;
      await env.DB.prepare(
        `INSERT INTO split_activities (id, expense_id, group_id, user_id, actor_person_id, action, metadata, created_at)
         VALUES (?, ?, ?, ?, NULL, 'reminder_delivery_unavailable', ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          row.expenseId,
          row.groupId,
          row.userId,
          JSON.stringify({ reminderId: row.id, channel: row.channel, reason: "channel_not_connected" }),
          iso,
        )
        .run();
      continue;
    }

    const delivered = await env.DB.prepare(
      "UPDATE split_reminders SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'",
    )
      .bind(iso, iso, row.id)
      .run();
    if (!delivered.meta.changes) continue;
    sent += 1;

    const statements = [
      env.DB.prepare(
        `INSERT INTO split_activities (id, expense_id, group_id, user_id, actor_person_id, action, metadata, created_at)
         VALUES (?, ?, ?, ?, NULL, 'reminder_sent', ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        row.expenseId,
        row.groupId,
        row.userId,
        JSON.stringify({ reminderId: row.id, channel: "in_app", slot: row.scheduledAt, message: row.message }),
        iso,
      ),
    ];

    const every = repeatDays(row.frequency);
    if (every && !closed) {
      const next = new Date(row.scheduledAt);
      // Skip forward past "now" so a long-overdue reminder does not fire again immediately.
      do next.setUTCDate(next.getUTCDate() + every);
      while (next.getTime() <= now.getTime());
      statements.push(
        env.DB.prepare(
          `INSERT INTO split_reminders
             (id, expense_id, participant_id, channel, scheduled_at, frequency, status, message, sent_at, stop_after_settlement, created_at, updated_at)
           SELECT ?, expense_id, participant_id, channel, ?, frequency, 'scheduled', message, NULL, stop_after_settlement, ?, ?
           FROM split_reminders WHERE id = ?`,
        ).bind(crypto.randomUUID(), next.toISOString(), iso, iso, row.id),
      );
      rescheduled += 1;
    }
    await env.DB.batch(statements);
  }

  return {
    sent,
    cancelled,
    rescheduled,
    unavailable,
    channel: "in_app" as const,
    externalChannels: "DELIVERY_CHANNEL_BLOCKED" as const,
  };
}
