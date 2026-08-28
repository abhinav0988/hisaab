# Hisaab transactions Worker

Internal income and expense records, tags, filters, and soft delete. Gateway authenticates and forwards `x-user-id`.

## Routes (`/api/v1/transactions`)

| Method | Path              |
| ------ | ----------------- |
| GET    | `/` query filters |
| POST   | `/`               |
| GET    | `/:id`            |
| PATCH  | `/:id`            |
| DELETE | `/:id`            |

D1 tables `transactions`, `accounts`, `categories`, `tags`, `transaction_tags`.

## Local

Started by `pnpm --filter @hisaab/gateway dev`.
