# Hisaab reports Worker

Internal dashboard summaries, period reports, and CSV export. Gateway authenticates and forwards `x-user-id`.

## Routes

| Method | Path                         |
| ------ | ---------------------------- |
| GET    | `/api/v1/dashboard/summary`  |
| GET    | `/api/v1/reports/daily`      |
| GET    | `/api/v1/reports/monthly`    |
| GET    | `/api/v1/reports/categories` |
| GET    | `/api/v1/reports/accounts`   |
| GET    | `/api/v1/reports/export.csv` |

Reads `transactions`, `accounts`, `categories`, `budgets`, `user_preferences`.

## Local

Started by `pnpm --filter @hisaab/gateway dev`.
