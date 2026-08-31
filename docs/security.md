# Security

## Controls

- Better Auth hashes passwords and manages HTTP-only session cookies on the **gateway** origin. Production enables `Secure`; cookies use Better Auth’s safe defaults and Hisaab prefix.
- Exact-origin CORS with credentials; wildcard origins are never used. CORS and CSRF run only on the gateway. Browser preflight allows `Content-Type`, `Authorization`, `X-Requested-With`, and `X-Hisaab-Country`. CORS headers are reapplied after proxied Worker responses.
- Mutations require a matching `Origin` or same-site fetch metadata. Cross-site mutations are rejected. Incoming `x-hisaab-internal` and `x-user-id` headers from the browser are stripped before proxying.
- D1-backed rate limiting applies to all `/api/*` requests on the gateway, with tighter windows on sign-in, sign-up, password reset, and email OTP. JSON bodies above 64 KB are rejected. Client IPs are SHA-256 hashed with `RATE_LIMIT_SECRET` before storage.
- Domain Workers trust `x-user-id` only when `x-hisaab-internal: 1` is present. That header is set by the gateway after a service-binding session check. Frontend-provided user IDs are ignored.
- `GET /internal/session` on auth requires the internal header. Auth is not published on workers.dev.
- Zod validates payload shape, lengths, positive integer money, currency, timestamps, and pagination bounds.
- Drizzle and D1 bound parameters prevent SQL injection. Controlled sort values are allowlisted before interpolation.
- CSV values beginning with spreadsheet formula characters are prefixed and every field is quoted.
- Signup OTP codes are hashed at rest, compared in constant time, and invalidated after five failed attempts. Production responses never include the code.
- Security headers include CSP, frame denial, content-type protection, referrer, permissions policies, `Cache-Control: no-store` on API responses, and HSTS in production. The web app adds the same browser protections via `_headers`.
- Correlation IDs are returned with errors. Production responses never expose stack traces.

## Logging

Logs use structured events and omit raw passwords, cookies, session/reset/verification tokens, and transaction notes. Audit records contain only mutation-safe summaries. Email callback URLs are sent only to the configured provider and are never logged.

## Secrets and operations

Local secrets belong in `backend/auth/.dev.vars` (`BETTER_AUTH_SECRET`, optional email webhook) and `backend/gateway/.dev.vars` (`RATE_LIMIT_SECRET`). Staging/production secrets must be added with `wrangler secret put`; they must not appear in `wrangler.jsonc`, CI logs, or source control. D1 IDs in the repository are placeholders and must be replaced during provisioning.

Review backup retention, account-deletion retention, data residency, privacy policy ownership, email deliverability, and protected production deployment approvals before launch.
