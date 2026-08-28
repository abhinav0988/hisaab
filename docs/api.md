# API

The **gateway** origin exposes health at `GET /health`, Better Auth at `/api/auth/*`, and private REST resources under `/api/v1`. The browser only talks to the gateway. Private routes require the Better Auth session cookie on that origin; the gateway resolves the session and forwards `x-user-id` to internal Workers.

Success responses use `{ "success": true, "data": ..., "meta": ... }`. Errors use `{ "success": false, "error": { "code", "message", "fieldErrors" }, "requestId" }`. List metadata includes `page`, `limit`, `total`, and `totalPages`.

## Endpoints

- Auth: Better Auth email endpoints for sign-up, sign-in, sign-out, session, verification, forgot/reset password.
- Profile: `GET|PATCH|DELETE /api/v1/profile`.
- Accounts: `GET|POST /api/v1/accounts`, `GET|PATCH|DELETE /api/v1/accounts/:id`.
- Categories: `GET|POST /api/v1/categories`, `PATCH|DELETE /api/v1/categories/:id`.
- Transactions: `GET|POST /api/v1/transactions`, `GET|PATCH|DELETE /api/v1/transactions/:id`.
- Budgets: `GET|POST /api/v1/budgets`, `GET|PATCH|DELETE /api/v1/budgets/:id`.
- Dashboard: `GET /api/v1/dashboard/summary`.
- Reports: `GET /api/v1/reports/daily|monthly|categories|accounts|export.csv`.
- Recurring: `GET|POST /api/v1/recurring-transactions`, `PATCH|DELETE /api/v1/recurring-transactions/:id`, plus `POST .../:id/pause|resume`.

Transaction query parameters are `from`, `to`, `category_id`, `account_id`, `type`, `search`, `page`, `limit`, and `sort` (`newest`, `oldest`, `amount_desc`, `amount_asc`). Budget lists accept `month=YYYY-MM`. Report range endpoints accept UTC ISO `from` and `to` values.

All identifiers sent by a client are treated as untrusted references. The service verifies account ownership and category visibility/type before mutation.
