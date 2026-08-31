# Architecture

Hisaab is a pnpm/Turborepo workspace in the same shape as a Micron stack: **all Cloudflare Workers under `backend/`**, **the Next.js app under `frontend/`**, shared code under `packages/`.

The browser talks to one public Worker (the gateway). Domain logic runs in internal Workers reached only through service bindings.

## Request flow

1. Next.js in `frontend/` renders the application shell and domain views.
2. The Better Auth browser client and TanStack Query call `NEXT_PUBLIC_API_URL` (the gateway origin). Session cookies never leave that host.
3. `backend/gateway` applies correlation IDs, security headers, strict CORS, CSRF origin checks, and D1-backed rate limits.
4. `/api/auth/*` is service-bound to `backend/auth` with the original request (cookies pass through).
5. `/api/v1/*` asks `backend/auth` for `GET /internal/session` (`x-hisaab-internal`), then proxies to the matching domain Worker with `x-user-id`.
6. Domain Workers reject traffic without the internal header. Services enforce ownership rules and use Drizzle/D1.
7. Consistent success or typed error envelopes return to the client.

## Backend Workers

| Package                | Worker                | Public | Owns                                                  |
| ---------------------- | --------------------- | ------ | ----------------------------------------------------- |
| `backend/gateway`      | `hisaab-gateway`      | yes    | CORS, CSRF, rate limit, reverse-proxy                 |
| `backend/auth`         | `hisaab-auth`         | no     | Better Auth, `GET /internal/session`                  |
| `backend/profile`      | `hisaab-profile`      | no     | `/api/v1/profile`                                     |
| `backend/accounts`     | `hisaab-accounts`     | no     | `/api/v1/accounts`                                    |
| `backend/categories`   | `hisaab-categories`   | no     | `/api/v1/categories`                                  |
| `backend/transactions` | `hisaab-transactions` | no     | `/api/v1/transactions`                                |
| `backend/budgets`      | `hisaab-budgets`      | no     | `/api/v1/budgets`                                     |
| `backend/reports`      | `hisaab-reports`      | no     | `/api/v1/dashboard/*`, `/api/v1/reports/*`            |
| `backend/recurring`    | `hisaab-recurring`    | no     | `/api/v1/recurring-transactions`, cron `*/15 * * * *` |
| `backend/finance`      | `hisaab-finance`      | no     | `/api/v1/investments`, `/ipos`, `/loans`, `/credit-facilities`, `/lend-records` |

Shared packages: `packages/database`, `packages/validation`, `packages/types`, `packages/ui`, `packages/worker-lib`. All domain Workers and auth bind the same D1 database `hisaab`.

`backend/api` is the previous single-Worker monolith. It remains for existing integration tests and the current production `hisaab-api` deploy until cutover.

## Frontend

`frontend/` is the Next.js app. Domain UI lives in `src/components/<domain>/`, HTTP calls in `src/services/*.service.ts`, providers in `src/providers/`, and the fetch client in `src/lib/api-client.ts`.

The UI is responsive from 320px. Desktop uses a persistent sidebar; mobile uses a compact header, bottom navigation, and floating transaction action. The CSS token system provides WCAG-conscious light and dark themes. Every server-driven feature implements loading, empty, error, and success feedback.

## Deployment boundaries

`backend/gateway` is the only Worker with `workers_dev: true`. Internal Workers stay unpublished. `BETTER_AUTH_URL` and `NEXT_PUBLIC_API_URL` must be the gateway origin. `frontend/` may be deployed as a Next.js host or a Cloudflare Workers static export.
