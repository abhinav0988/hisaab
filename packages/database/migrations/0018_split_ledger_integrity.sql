ALTER TABLE split_expenses ADD COLUMN ledger_version integer NOT NULL DEFAULT 0;
ALTER TABLE split_people ADD COLUMN archived_at text;
ALTER TABLE split_payments ADD COLUMN voided_at text;
ALTER TABLE split_payments ADD COLUMN void_reason text;
ALTER TABLE idempotency_keys ADD COLUMN request_hash text;

CREATE INDEX idempotency_keys_created_idx ON idempotency_keys (created_at);
CREATE INDEX split_payments_expense_status_idx ON split_payments (expense_id, status);
CREATE INDEX split_expenses_group_idx ON split_expenses (group_id);
