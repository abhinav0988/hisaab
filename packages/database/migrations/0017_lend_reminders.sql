CREATE TABLE lend_reminders (
  id text PRIMARY KEY,
  lend_record_id text NOT NULL REFERENCES lend_records(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  enabled integer NOT NULL DEFAULT 1,
  remind_at text NOT NULL,
  frequency text NOT NULL,
  last_sent_at text,
  next_run_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CHECK (frequency IN ('ONCE', 'DAILY', 'WEEKLY', 'BEFORE_DUE'))
);

CREATE UNIQUE INDEX lend_reminders_record_unique ON lend_reminders (lend_record_id);
CREATE INDEX lend_reminders_due_idx ON lend_reminders (enabled, next_run_at);

CREATE TABLE lend_reminder_deliveries (
  id text PRIMARY KEY,
  reminder_id text NOT NULL REFERENCES lend_reminders(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  slot text NOT NULL,
  channel text NOT NULL,
  created_at text NOT NULL
);

CREATE UNIQUE INDEX lend_reminder_deliveries_slot_unique ON lend_reminder_deliveries (reminder_id, slot, channel);
CREATE INDEX lend_reminder_deliveries_user_idx ON lend_reminder_deliveries (user_id);
