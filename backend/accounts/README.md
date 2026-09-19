# Hisaab accounts Worker

Internal ledger accounts and the static account catalog. Public traffic goes to `backend/gateway`, which authenticates and forwards `x-user-id`.

`GET /` provisions catalog payment stubs (Cash, Bank, UPI, …) onto the signed-in user. Those stubs are for transaction account pickers.

Linked banks on the Bank page are separate rows (`catalog_id` null + `institution_name`) created via `POST /banks`.

## Routes (`/api/v1/accounts`)

| Method | Path       | Auth                | Notes |
| ------ | ---------- | ------------------- | ----- |
| GET    | `/catalog` | session via gateway | Static catalog |
| GET    | `/`        | session via gateway | Catalog stubs for the user |
| GET    | `/banks`   | session via gateway | User-linked banks only (excludes catalog stub) |
| POST   | `/banks`   | session via gateway | Add a linked bank (`institutionName` required) |
| GET    | `/:id`     | session via gateway | |
| PATCH  | `/:id`     | session via gateway | Edits are preserved — provision no longer overwrites custom names |
| DELETE | `/:id`     | session via gateway | Deactivates |
| POST   | `/`        | forbidden — catalog only | |

## Bindings

D1 `hisaab` as `DB`. Reads `account_catalog` and `accounts`; balance uses `transactions`.

## Local

Started by `pnpm --filter @hisaab/gateway dev` through a service binding. `workers_dev` is off.
