# Hisaab

**Hisaab — Track today. Plan tomorrow.**

Hisaab is a responsive personal budgeting application for India, Nepal, Pakistan, Bangladesh, and international users. It records income and expenses, derives account balances, monitors monthly budgets, produces reports, exports safe CSV files, and generates recurring transactions.

## Architecture

This repository is a pnpm/Turborepo workspace in the Micron layout: **backend Workers** plus a **frontend** web app.

- `frontend/` — Next.js App Router client (`@hisaab/web`): Tailwind CSS, TanStack Query, React Hook Form, Recharts, and Better Auth client. Domain UI in `src/components/<domain>/`, API calls in `src/services/`.
- `backend/gateway` — public Hono Worker: CORS, CSRF, rate limits, and service-binding proxy (`http://localhost:8787`).
- `backend/auth` — Better Auth (`/api/auth/*`) and internal `GET /internal/session`. Not published on workers.dev.
- `backend/profile`, `accounts`, `categories`, `transactions`, `budgets`, `reports`, `recurring` — one Worker per domain.
- `packages/database` — Drizzle schema, D1 migrations, and reference-data seed.
- `packages/validation` — shared Zod contracts and financial calculation helpers.
- `packages/types` — shared API/domain types.
- `packages/ui` — accessible Hisaab UI primitives.
- `packages/worker-lib` — shared Worker errors, HTTP helpers, audit, and internal-auth middleware.

`BETTER_AUTH_URL` and `NEXT_PUBLIC_API_URL` must be the **gateway** origin so session cookies stay on one host. See [Architecture](docs/architecture.md), [Database](docs/database.md), [API](docs/api.md), and [Security](docs/security.md).

## Technology

Node.js 20.20+, pnpm 10, Next.js 16, React 19, TypeScript strict mode, Tailwind 4, Hono, Cloudflare Workers/D1, Drizzle ORM, Better Auth, Vitest, Playwright, ESLint, Prettier, and GitHub Actions.

Wrangler 4.33 and its matching Worker types are intentionally pinned because newer Wrangler releases require Node 22. The Next.js client uses current stable releases and still supports Node 20.

## Prerequisites

- Node.js 20.20 or newer (or upgrade the toolchain together to Node 22)
- Corepack enabled: `corepack enable`
- A Cloudflare account only for staging/production deployment

## Install

```bash
corepack pnpm install
cp .env.example backend/auth/.dev.vars
```

Replace `BETTER_AUTH_SECRET` in `backend/auth/.dev.vars` with at least 32 random characters. Never commit this file.

## Local D1

```bash
pnpm db:migrate:local
pnpm db:seed:local
```

The seed is idempotent and creates the 20 system categories. Local D1 state is stored under `.wrangler/state` (shared by gateway and sibling Workers).

To create a new schema migration after changing Drizzle tables:

```bash
pnpm db:generate
pnpm db:migrate:local
```

## Development

```bash
pnpm dev
```

The web app runs at `http://localhost:3000`; the gateway (and bound Workers) run at `http://localhost:8787`. For separate terminals use `pnpm --filter @hisaab/web dev` and `pnpm --filter @hisaab/gateway dev`.

## Environment variables

- `NEXT_PUBLIC_API_URL` — browser-visible **gateway** origin.
- `BETTER_AUTH_SECRET` — secret encryption/signing key on the auth Worker (`wrangler secret put` outside local development).
- `BETTER_AUTH_URL` — canonical gateway/auth origin (must match the public URL the browser uses).
- `APP_ORIGIN` — exact allowed web origin for CORS and CSRF origin checks.
- `RATE_LIMIT_SECRET` — hashes client IPs on the gateway before D1 rate-limit storage.
- `EMAIL_WEBHOOK_URL` and `EMAIL_WEBHOOK_TOKEN` — optional transactional-email provider bridge for verification/reset links.

No email credential is bundled. Without the webhook, local account creation and sign-in work, while verification/reset delivery is skipped and logged without tokens.

## Quality commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Worker-lib unit tests run in Vitest. The previous monolith (`backend/api`) still runs Cloudflare Workers pool integration tests until they are migrated. Playwright starts the gateway plus web app and tests desktop/mobile flows.

## Staging and production

1. Create separate databases: `wrangler d1 create hisaab-staging` and `wrangler d1 create hisaab-production`.
2. Replace the placeholder UUIDs in each Worker `wrangler.jsonc` with returned IDs (same D1 on auth, gateway, and domain Workers).
3. Configure `APP_ORIGIN` and `BETTER_AUTH_URL` on gateway and auth to the **public gateway** origin.
4. Store secrets interactively: `wrangler secret put BETTER_AUTH_SECRET` in `backend/auth`, and `wrangler secret put RATE_LIMIT_SECRET` in `backend/gateway`.
5. Apply migrations from `backend/auth`: `pnpm --filter @hisaab/auth db:migrate:remote`.
6. Seed reference categories: `pnpm --filter @hisaab/auth db:seed:remote`.
7. Deploy internal Workers first, then the gateway. Do not enable `workers_dev` on internal services.

Production deployment is intentionally not automated from an unprotected branch. Configure a GitHub environment with approvals before adding a production job.

The live `hisaab-api` Worker is still the previous monolith until a cutover deploy points the public URL at `hisaab-gateway`.

## Troubleshooting

- **`listen EPERM` in a sandbox:** Wrangler/Workers Vitest needs permission to open a temporary local socket.
- **Missing D1 table:** run both migration and seed commands from the repository root.
- **401 from the web app:** confirm gateway/web origins match exactly and browser requests include credentials.
- **No reset email:** configure the email webhook variables; links and tokens are never written to logs.
- **Wrangler asks for Node 22:** keep the pinned lockfile on Node 20 or upgrade Node, Wrangler, Worker types, and the Vitest pool together.
- **Empty data after migrate:** confirm `--persist-to ../../.wrangler/state` is shared between migrate/seed and `pnpm --filter @hisaab/gateway dev`.
