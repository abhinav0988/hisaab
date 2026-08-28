# Hisaab categories Worker

Internal system and user-owned categories. Gateway authenticates and forwards `x-user-id`.

## Routes (`/api/v1/categories`)

| Method | Path   |
| ------ | ------ |
| GET    | `/`    |
| POST   | `/`    |
| PATCH  | `/:id` |
| DELETE | `/:id` |

System categories cannot be edited. D1 table `categories`.

## Local

Started by `pnpm --filter @hisaab/gateway dev`.
