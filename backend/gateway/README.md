# Hisaab gateway Worker

The only public origin. Browser traffic hits this Worker. It applies CORS, CSRF, and rate limits, then service-binds internal Workers.

## Routes

| Path                                     | Destination                          |
| ---------------------------------------- | ------------------------------------ |
| `GET /health`                            | gateway                              |
| `/api/auth/*`                            | `hisaab-auth` (cookies pass through) |
| `/api/v1/profile*`                       | `hisaab-profile` after session check |
| `/api/v1/accounts*`                      | `hisaab-accounts`                    |
| `/api/v1/categories*`                    | `hisaab-categories`                  |
| `/api/v1/transactions*`                  | `hisaab-transactions`                |
| `/api/v1/budgets*`                       | `hisaab-budgets`                     |
| `/api/v1/recurring-transactions*`        | `hisaab-recurring`                   |
| `/api/v1/investments*`, `/api/v1/ipos*`, `/api/v1/loans*`, `/api/v1/credit-facilities*`, `/api/v1/lend-records*` | `hisaab-finance` |
| `/api/v1/dashboard*`, `/api/v1/reports*` | `hisaab-reports`                     |

`NEXT_PUBLIC_API_URL` and `BETTER_AUTH_URL` must be this origin.

## Bindings

- D1 `hisaab` — rate-limit table only
- Service bindings: `AUTH`, `PROFILE`, `ACCOUNTS`, `CATEGORIES`, `TRANSACTIONS`, `BUDGETS`, `REPORTS`, `RECURRING`, `FINANCE`
- Vars: `APP_ORIGIN`, `BETTER_AUTH_URL`, `RATE_LIMIT_SECRET`

No Better Auth secret on this Worker.

## Local

```bash
pnpm --filter @hisaab/auth db:migrate:local
pnpm --filter @hisaab/auth db:seed:local
pnpm --filter @hisaab/gateway dev
```

Runs on `http://localhost:8787` and starts sibling Workers via Wrangler multi-config. Local D1 is shared at `../../.wrangler/state`.
