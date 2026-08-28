# Hisaab budgets Worker

Internal monthly overall and category budgets with spend in the user timezone. Gateway authenticates and forwards `x-user-id`.

## Routes (`/api/v1/budgets`)

| Method | Path              |
| ------ | ----------------- |
| GET    | `/?month=YYYY-MM` |
| POST   | `/`               |
| GET    | `/:id`            |
| PATCH  | `/:id`            |
| DELETE | `/:id`            |

D1 tables `budgets`, `transactions`, `categories`, `user_preferences`.

## Local

Started by `pnpm --filter @hisaab/gateway dev`.
