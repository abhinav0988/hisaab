# Database

Cloudflare D1 stores SQLite-compatible tables managed by Drizzle migrations. All timestamps are UTC ISO strings. Monetary fields use integer minor units; `1050` represents 10.50 in the account currency.

## Authentication tables

- `user`, `session`, `account`, `verification` — Better Auth-owned tables. Their column names intentionally match Better Auth’s canonical D1 schema.

## Domain tables

- `user_preferences` — country, single default currency, time zone, date format, and theme.
- `accounts` — opening balance and metadata. Current balance is derived, never independently edited.
- `categories` — global system categories (`user_id IS NULL`) and user categories.
- `transactions` — income/expense entries with `deleted_at` soft deletion.
- `tags`, `transaction_tags` — user-owned labels and many-to-many assignments.
- `budgets` — overall (`category_id IS NULL`) or category budgets keyed by user/month.
- `recurring_transactions` — schedule templates and next/last processing timestamps.
- `recurring_occurrences` — unique schedule occurrence to generated transaction mapping.
- `audit_logs` — mutation metadata without password/session/note content.
- `api_rate_limits` — short-lived hashed-client counters.

## Integrity and indexes

Foreign keys cascade user-owned data, while transaction account/category references restrict destructive removal. Partial unique indexes enforce one overall budget per user/month and unique global categories. Recurring occurrences are unique by schedule and scheduled timestamp. Transaction user/date, category, and account indexes support reporting and filtering.

Balances and reports always exclude transactions with `deleted_at`. Budget spend includes expense rows only. No cached daily/monthly totals are stored.

## Migrations and seed

Migrations live in `packages/database/migrations`. `seed.sql` inserts 13 expense and 7 income system categories with `INSERT OR IGNORE`, so it is safe to rerun. Local D1 persistence for the split Workers is `.wrangler/state` at the repository root.
