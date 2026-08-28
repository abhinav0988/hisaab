# Hisaab accounts Worker

Internal CRUD for user ledger accounts and derived balances. Public traffic goes to `backend/gateway`, which authenticates and forwards `x-user-id`.

## Routes (`/api/v1/accounts`)

| Method | Path   | Auth                              |
| ------ | ------ | --------------------------------- |
| GET    | `/`    | session via gateway               |
| POST   | `/`    | session via gateway               |
| GET    | `/:id` | session via gateway               |
| PATCH  | `/:id` | session via gateway               |
| DELETE | `/:id` | session via gateway (deactivates) |

## Bindings

D1 `hisaab` as `DB`. Reads/writes `accounts`; balance uses `transactions`.

## Local

Started by `pnpm --filter @hisaab/gateway dev` through a service binding. `workers_dev` is off.
