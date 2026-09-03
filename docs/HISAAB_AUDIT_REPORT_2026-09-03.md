# Hisaab Current Audit Report

**Audited:** 3 September 2026  
**Last re-check:** 3 September 2026 — remaining items implemented as product/test fixes, not disclosure-only.

## Result

The remaining RA/QA items from this file are implemented as follows.

| Area | Result |
| --- | --- |
| RA-001 | Reconstruct 30-day outstanding from dated card expenses and payments |
| RA-002 | Replace fake IPO time series with current P/L bars and listing vs current price |
| RA-003 / QA-001 | E2E OTP fixture, premium Overview selectors, local origins, rate-limit bypass; Playwright may reuse an existing local server |
| RA-004 | Overview y-axis keys include the tick index |
| QA-002 | Auth panel no longer uses React Hook Form `watch()` |
| QA-003 | OTP auto-send effect depends on a stable `send` callback |
| QA-004 | Added transfer, timezone, card-trend, and IPO chart tests; other domain Workers still have limited suite coverage |

## Issue-by-issue status

| ID | Severity | Fix |
| --- | --- | --- |
| RA-001 | Medium | Finance API returns a 30-day card ledger (expenses and payments). The Cards chart walks that ledger from the current outstanding, so payments reduce the line and spends raise it. Unrecorded interest/fees still will not appear. |
| RA-002 | Medium | IPO charts no longer plot current P/L on application dates. They show current P/L per IPO and listing vs current price for listed IPOs. |
| RA-003 | Medium | Local OTP is returned in the verification-code response; Overview tests use `.pd-module` / `.premium-dash`. |
| RA-004 | Low | `key={\`${tick}-${index}\`}`. |
| QA-002 | Low | Password/email strength UI reads local state from `onChange`, not `watch()`. |
| QA-003 | Low | `send` is wrapped in `useCallback` and listed in the auto-send effect deps. |
| QA-004 | Low | Extra unit tests for transfers, timezone bucketing, reconstructed card outstanding, and IPO aggregates. Full service-level coverage is still incomplete. |

## Release recommendation

**Go for internal use** after deploying finance + frontend so the reconstructed card ledger is live. Re-run `pnpm test:e2e` locally when ports 3000/8787 are free.
