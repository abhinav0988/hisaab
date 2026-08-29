# Hisaab accounts Worker

Internal ledger accounts and the static account catalog. Public traffic goes to `backend/gateway`, which authenticates and forwards `x-user-id`.

Users do not create accounts. `GET /catalog` returns the static schema; `GET /` provisions those rows onto the signed-in user.

## Routes (`/api/v1/accounts`)

| Method | Path       | Auth                |
| ------ | ---------- | ------------------- |
| GET    | `/catalog` | session via gateway |
| GET    | `/`        | session via gateway |
| GET    | `/:id`     | session via gateway |
| PATCH  | `/:id`     | session via gateway |
| DELETE | `/:id`     | session via gateway (deactivates) |
| POST   | `/`        | forbidden — catalog only |

## Bindings

D1 `hisaab` as `DB`. Reads `account_catalog` and `accounts`; balance uses `transactions`.

## Local

Started by `pnpm --filter @hisaab/gateway dev` through a service binding. `workers_dev` is off.
