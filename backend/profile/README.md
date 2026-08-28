# Hisaab profile Worker

Internal user identity plus Hisaab preferences (`user` + `user_preferences`). Gateway authenticates and forwards `x-user-id`.

## Routes (`/api/v1/profile`)

| Method | Path |
| ------ | ---- |
| GET    | `/`  |
| PATCH  | `/`  |
| DELETE | `/`  |

## Bindings

D1 `hisaab` as `DB`.

## Local

Started by `pnpm --filter @hisaab/gateway dev`.
