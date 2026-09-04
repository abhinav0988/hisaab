# Hisaab auth Worker

Internal Better Auth service. The browser never calls this Worker directly. `backend/gateway` is the public origin and proxies `/api/auth/*` here so session cookies stay on the gateway host.

## Public vs internal

| Kind                 | Path                    | Who calls                                |
| -------------------- | ----------------------- | ---------------------------------------- |
| Public (via gateway) | `/api/auth/*`           | Browser, through gateway service binding |
| Internal             | `GET /internal/session` | Gateway only (`x-hisaab-internal`)       |
| Ops                  | `GET /health`           | Gateway / operators                      |

## Auth routes (Better Auth)

Email and password, cookie prefix `hisaab`, D1 tables `user`, `session`, `account`, `verification`.

- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/get-session`
- verify-email, forget-password, reset-password

## Cookie rule

`BETTER_AUTH_URL` must be the **gateway** origin (`http://localhost:8787` locally, production gateway URL in deploy). Do not publish `hisaab-auth` on workers.dev.

## Secrets

Set in `.dev.vars` locally and with `wrangler secret put` when deploying:

- `BETTER_AUTH_SECRET` (required, ≥ 32 characters)
- `RESEND_API_KEY` (sends verification and password-reset mail)
- `EMAIL_FROM` (default `Hisaab <noreply@api.hisaabservice.com>`)
- `AUTH_DEV_EXPOSE_OTP` (logs the email link in non-production)
- `EMAIL_WEBHOOK_URL` / `EMAIL_WEBHOOK_TOKEN` (optional fallback)

## Bindings

- D1 `hisaab` as `DB`
- Vars: `ENVIRONMENT`, `APP_ORIGIN`, `BETTER_AUTH_URL`

## Local

```bash
cp .dev.vars.example .dev.vars
pnpm --filter @hisaab/auth db:migrate:local
pnpm --filter @hisaab/auth db:seed:local
pnpm --filter @hisaab/gateway dev
```

Gateway `dev` starts this Worker through a service binding. `pnpm --filter @hisaab/auth dev` is only for isolated health checks.
