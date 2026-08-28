# Hisaab recurring Worker

Internal recurring transaction templates plus the 15-minute Cron that materializes due occurrences. Gateway authenticates HTTP; Cron runs on this Worker.

## Routes (`/api/v1/recurring-transactions`)

| Method | Path          |
| ------ | ------------- |
| GET    | `/`           |
| POST   | `/`           |
| PATCH  | `/:id`        |
| DELETE | `/:id`        |
| POST   | `/:id/pause`  |
| POST   | `/:id/resume` |

## Cron

`*/15 * * * *` — generates due transactions and cleans expired `api_rate_limits` rows.

## Bindings

D1 `hisaab` as `DB`. Tables `recurring_transactions`, `recurring_occurrences`, `transactions`.

## Local

Started by `pnpm --filter @hisaab/gateway dev`.
