# Hisaab Frontend and Backend Audit Report

**Audit date:** 3 September 2026  
**Environment:** local repository, Node 20.20.1, pnpm 10.15.1, local Cloudflare Workers/D1 only  
**Scope:** audit and reporting only. No source code, configuration, dependency, production system, real account, or financial data was changed.

## Executive summary

The application has a solid modular structure and the non-integration automated checks include **33 passing assertions**. However, it is not release-ready for the full requested financial scope: the legacy API does not type-check, its integration suite does not start, the frontend lint gate fails, and multiple financial workflows have incomplete CRUD or accounting behaviour.

**Recommendation: Conditional Go for internal development only; No-Go for a release claiming the complete requested scope.**

| Metric | Result |
| --- | ---: |
| In-scope modules identified | 15 |
| Confirmed issues | 14 |
| High severity | 4 |
| Medium severity | 7 |
| Low severity | 2 |
| Passing automated assertions | 33 |
| Blocked automated paths | 2 |
| Full browser CRUD/data-reflection tests | Blocked |

## Baseline and evidence

Initial working-tree state contained pre-existing changes outside this audit:

- Modified: `frontend/next-env.d.ts`
- Untracked: `Hisaab_Complete_Demo.html`
- Untracked: `docs/audit-evidence/`

Commands executed:

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm test` | Failed overall | 21 packages succeeded; legacy API package failed before assertions. |
| `pnpm --filter @hisaab/api test` | Failed | Worker test runner reported two `ByteString` errors and executed zero tests. |
| `pnpm typecheck` | Failed | Seven TypeScript errors in legacy API profile route. |
| `pnpm lint` | Failed | Frontend: 9 errors and 5 warnings. |
| Focused/local Playwright attempts | Blocked | Existing processes held ports 3000 and 8787; local browser navigation timed out. |

## Follow-up graph test — 3 September 2026

This follow-up ran tests only; no application source, configuration, dependencies, or production data was changed.

| Test | Result | Finding |
| --- | --- | --- |
| `pnpm --filter @hisaab/web test:e2e -- e2e/overview-command.spec.ts --project=chromium` | Passed | 1 desktop test passed (1 mobile project skipped). The dashboard rendered across the listed viewports and navigation to Analytics worked. This test does **not** assert that chart SVG/data points render. |
| `pnpm --filter @hisaab/web test:e2e -- e2e/hisaab.spec.ts --project=chromium` | Failed: 7 failed, 1 passed | The Analytics/report test did not reach its graph assertion. The first test registered successfully; later registrations stopped receiving a local OTP. |
| `pnpm --filter @hisaab/web exec playwright test --grep "opens monthly reports" --project=chromium` | Passed | 1 Analytics test passed. It used the local development OTP returned by the auth API and confirmed `/reports`, the Analytics heading, and the chart card’s “Six-month comparison” label render. |

### Exact blocked point and why

The full-suite graph path is blocked in `frontend/e2e/helpers.ts:58-60` after repeated registrations. `register()` waits for `POST /api/auth/send-verification-code` and requires a six-digit OTP in its response. The local auth worker still attempts a non-blocking Resend delivery; Resend rejects the generated `@example.com` address (`Invalid to field`) and the unverified sender. A single isolated Analytics test nevertheless passes because the development API returns the OTP before that asynchronous delivery failure. The full run becomes unreliable when it creates multiple accounts, so the isolated test is the valid result for this follow-up.

This is test-fixture/auth-email configuration, not evidence that Recharts itself failed to render. The passing isolated test confirms the Analytics page and chart card render, but current E2E coverage still does not assert chart SVG/data points or period switching. A deterministic local-only mail provider (or removal of the external Resend call in E2E mode) is required for stable full-suite coverage.

### Confirmed graph defect from source review

The Analytics graph has a separate, reproducible data-binding defect (QA-011): changing the selector updates `range` for daily/category requests, but `frontend/src/components/reports/reports-view.tsx` calls `reportService.monthly()` without that range and always uses `monthly.data.slice(-6)`. Consequently, “Last 12 months” and “This year” still show a six-month graph with the fixed “Six-month comparison” label. This explains why the graph can appear not to respond to the selected period; it is not a Recharts rendering failure.

## Re-check of failed and blocked tests — 3 September 2026

The following were re-run after the isolated Analytics test. No source code was changed.

| Check | Current result | Exact reason |
| --- | --- | --- |
| `pnpm --filter @hisaab/web typecheck` | Passed | The frontend TypeScript check succeeds. |
| `pnpm --filter @hisaab/web test` | Passed, with no tests discovered | Vitest excludes `e2e/**`; there are no frontend unit-test files matching its configured pattern. |
| `pnpm typecheck` | Failed | The legacy API profile route has 7 TypeScript errors: its default `preferences` object omits five required fields, and later property reads may use an undefined value. See QA-001. |
| `pnpm lint` | Failed | The frontend has 9 errors and 7 warnings. Most errors are synchronous `setState` calls inside effects; one is React Compiler memoization preservation. See QA-003. |
| `pnpm --filter @hisaab/api test` | Blocked before assertions | The Workers/Vitest runtime starts but raises two `ByteString` exceptions before test collection. U+2605 (★) appears in a value used as request headers/configuration; headers must be ByteString/ASCII-safe. Result: 0 tests executed. See QA-002. |

### Current interpretation

- **Failed** means the command completed and found code-quality/type errors that require fixes (legacy API typecheck and frontend lint).
- **Blocked** means the intended tests could not run far enough to assess feature behaviour (legacy API integration tests). The immediate blocker is the Unicode-in-header runtime error, not the financial feature logic.
- **Passed** Analytics navigation confirms the page opens. It does not clear QA-011: the graph period selector remains wired to a fixed six-month data request.

## Confirmed issues

### Backend and integration issues

| ID | Severity | Module | Category | Issue | Evidence / affected files | Impact | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-001 | High | Legacy API / Settings | Backend, release gate | The legacy API profile route fails TypeScript validation. | `backend/api/src/modules/profile/routes.ts:19-45`; default preference object is missing `language`, `profileNote`, `smartNotifications`, `weeklySummary`, and `appLockEnabled`; later accesses can be `undefined`. | A required quality gate fails and profile preference behaviour can drift from its database/type contract. | Align the inserted defaults and route response with the current preferences schema; narrow `preferences` after initialization; re-run typecheck. |
| QA-002 | High | Legacy API test suite | Integration, test infrastructure | API integration tests do not execute. | `pnpm --filter @hisaab/api test`; two errors: `Cannot convert argument to a ByteString` for Unicode character U+2605; **0 tests** ran. A compatibility-date fallback warning also appeared. | Authentication, authorization, CRUD, cross-user access, and recurring idempotency assertions in the legacy suite are not verified. | Find data serialized into Worker test request headers/configuration that contains non-ByteString Unicode; keep values ASCII-safe where required; update the local runtime/toolchain together if needed; re-run both specs. |
| QA-009 | High | Add Transaction / Accounts / Overview | Backend, fintech data integrity | Transfers are absent from the domain model. | `packages/validation/src/index.ts:4`, `packages/types/src/index.ts:2`, and `frontend/src/components/transactions/transaction-form.tsx` restrict type to `INCOME` or `EXPENSE`. No destination-account or paired-transfer field/route exists. | Bank-to-bank transfers cannot debit the source, credit the destination, preserve net worth, or avoid overview/report double-counting. | Implement an atomic, idempotent transfer model with source and destination account entries; reflect it in balances, reports, budgets, categories, and net-worth calculations. |
| QA-005 | High | Saving Goals | Backend and frontend functional gap | Saving Goals has no update, pause/complete, or delete lifecycle. | `backend/budgets/src/routes/goals.ts` exposes only GET, POST, contribution list, and contribution POST. `frontend/src/components/goals/goals-view.tsx` only creates and adds money. | Users cannot correct targets, pause/complete goals, remove obsolete goals, or safely manage the requested active/completed/paused/overdue states. | Add owned PATCH/lifecycle/DELETE operations, schema validation, audit entries, confirmation UI, and contribution-safe balance handling. |
| QA-010 | Medium | Overview / Analytics / Graphs | Backend, fintech date and timezone correctness | Reporting time buckets are inconsistently calculated in UTC even though reporting context reads the user timezone. | `backend/reports/src/services/service.ts`: `daily()` and `monthly()` group using `substr(transaction_at, ...)`; `monthly()` uses SQLite `datetime('now','start of month','-5 months')`; dashboard seven-day start is also derived from raw UTC time. | Transactions near a user’s local midnight can be shown in the wrong daily/monthly total, chart point, comparison period, or spending summary. | Derive all reporting boundaries and bucketing from the saved IANA timezone consistently; add tests around UTC offsets, DST where applicable, and local midnight/month boundaries. |
| QA-011 | Medium | Analytics / Graphs | Frontend, data correctness | The Analytics period selector does not control the income-versus-expense chart data. | `frontend/src/components/reports/reports-view.tsx`: selected `range` is used for daily/category queries, but `reportService.monthly()` is called without a range and its result is always `slice(-6)`; chart header always says “Six-month comparison.” | “Last 12 months” and “This year” can display a six-month graph while users assume all selected history is represented. This can mislead financial decisions. | Pass selected date bounds to the monthly aggregation, return the correct monthly series from the API, and bind labels/chart/KPIs to the same selected period. Add 6-, 12-, and year-range regression tests. |
| QA-012 | High | Banks / Graphs | Frontend, financial data correctness | Bank balance history uses all-account income and expenses for 3-month and longer ranges. | `frontend/src/components/bank/bank-view.tsx`: `balanceTrendForRange()` passes dashboard `monthlyComparison` into `buildMonthlyBalanceTrend()`; the reports service creates that series without an account filter. | A bank-only balance chart can show changes caused by cash, card, UPI, investment, or other accounts, producing materially incorrect bank history. | Query and aggregate transactions only for the selected bank-account IDs for every range. Add cross-account fixtures that prove bank balances do not move from non-bank activity. |
| QA-013 | Medium | Credit Cards / Graphs | Frontend, misleading analytics | The “outstanding balance” line is not historical. | `frontend/src/components/finance/cards-view.tsx:160-215` inserts the same current `outstandingMinor` into each of 30 chart points. | The graph is labelled “Last 30 days — spending vs outstanding balance,” but it presents a flat line regardless of payments or daily balance changes. | Either calculate historical outstanding balance from dated card transactions/payments or relabel/remove the series until that data exists. |
| QA-014 | Medium | IPO Tracker / Graphs | Frontend, misleading analytics | IPO performance and returns lines use current P/L associated with application dates, rather than a historical valuation date. | `frontend/src/lib/ipo.ts`: `ipoPerformanceTrend()` and `ipoReturnsTrend()` compute present `ipoStats(item).plMinor` then group/order it by `appliedOn`. | The visual can imply that returns occurred on the application date and gives a false time-series narrative for IPO performance. | Store dated price/valuation snapshots or render a non-time-series aggregate; label any cumulative view accurately and test allotted/listed/not-allotted cases. |

### Frontend issues

| ID | Severity | Module | Category | Issue | Evidence / affected files | Impact | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| QA-003 | Medium | Frontend quality gate | Frontend, performance | Frontend lint fails with 9 errors and 5 warnings. | `pnpm lint`; errors in `auth/email-otp-panel.tsx`, `auth/verify-email-view.tsx`, `bank/bank-view.tsx`, `layout/global-search.tsx`, `profile/profile-view.tsx`, and `transactions/transaction-form.tsx`. Most errors flag synchronous `setState` calls in effects. | The release quality gate is red; some patterns can cause cascading renders, stale UI, or avoidable rendering cost. | Remove effect-driven derived-state initialization where possible; model reset/action state explicitly; resolve all errors and review warnings before release. |
| QA-004 | Low | Global Search | Accessibility | A native input with textbox semantics has an unsupported `aria-expanded` attribute. | `frontend/src/components/layout/global-search.tsx:136-143`; lint reports `aria-expanded` is unsupported by role textbox. | Assistive technology may not correctly announce search-result expansion state. | Apply the appropriate combobox pattern and ownership/controls attributes to the correct element, then validate keyboard and screen-reader behaviour. |
| QA-006 | Medium | Investments | Frontend functional gap | Existing holdings are read-only in the UI. | Backend has PATCH/DELETE routes in `backend/finance/src/routes/investments.ts`; `frontend/src/services/finance.service.ts` exposes only list/create; `frontend/src/components/finance/finance-tools-views.tsx` opens a display-only detail modal. | Users cannot correct holding values, change SIP details, or remove a mistaken investment; portfolio/overview values become hard to maintain. | Add edit and delete workflows with confirmation; invalidate investment, overview, allocation, and performance queries after mutation. |
| QA-007 | Medium | UPI Credit | Frontend functional gap | Saved UPI credit lines have no lifecycle actions in the UI. | `frontend/src/components/finance/finance-tools-views.tsx` offers only Add; finance backend supports PATCH/DELETE but the UI does not use it. | Users cannot correct limits/usage, remove duplicate lines, or reconcile a credit line through the UI. | Add safe edit/delete/reconciliation controls and test used, remaining, and overdue figures after each action. |
| QA-008 | Medium | Borrowing and Lending | Frontend functional gap | Borrow/lend records cannot be settled, edited, or deleted through the UI. | `frontend/src/components/finance/finance-tools-views.tsx` has a display-only detail modal; `finance.service.ts` lacks a delete method even though backend PATCH/DELETE routes exist. | Outstanding balances and statuses can become stale; no payment history or settlement workflow is available. | Add settlement/payment, edit, delete-confirmation, and dashboard/reflection logic, including a payment-history record. |

## Module status matrix

Status reflects only executed evidence and source review. “Blocked” does not mean a module is defective; it means the full dynamic test path was not available.

| Module | Source review | Automated/browser evidence | Status | Notes |
| --- | --- | --- | --- | --- |
| Add Transaction | Reviewed | Unit/integration path blocked | At risk | Income/expense CRUD exists; transfers are not implemented. |
| Overview | Reviewed | Existing test coverage present; live browser blocked | Blocked | Cross-screen reflection and graph calculations not confirmed. |
| Transactions | Reviewed | Existing test coverage present; live browser blocked | At risk | Search/filter/sort/pagination code exists; transfer flow absent. |
| Banks | Reviewed | Existing test coverage present; live browser blocked | Blocked | Bank account create/update requires dynamic validation. |
| Spending Limits | Reviewed | Existing test coverage present; live browser blocked | Blocked | CRUD routes/UI exist; period reset/reflection unverified. |
| Saving Goals | Reviewed | Live browser blocked | Failed scope | No edit, lifecycle, or delete APIs/UI. |
| Accounts | Reviewed | Existing test coverage present; live browser blocked | Blocked | Catalog model and update exist; deactivation path requires dynamic check. |
| Investments | Reviewed | Finance E2E exists but result unavailable | Failed scope | Create/list only in UI; edit/delete absent. |
| IPO Tracker | Reviewed | Live browser blocked | Blocked | Create/update/delete routes and UI references exist; financial reflection unverified. |
| EMI and Loans | Reviewed | Finance E2E exists but result unavailable | Blocked | CRUD/payment/schedule paths exist; calculations unverified. |
| Credit Cards | Reviewed | Finance E2E exists but result unavailable | Blocked | CRUD/payment paths exist; utilisation/reflection unverified. |
| UPI Credit | Reviewed | Live browser blocked | Failed scope | Create only in UI; no edit/delete/reconciliation UI. |
| Bills and Reminders | Reviewed | Live browser blocked | Blocked | Maps to Recurring; schedule CRUD/pause/resume exists. Mark-paid/reflection checks unverified. |
| Borrowing and Lending | Reviewed | Live browser blocked | Failed scope | UI lacks settlement/edit/delete actions. |
| Settings | Reviewed | Existing theme test exists; live browser blocked | At risk | Legacy API profile type-check failure affects profile/preferences confidence. |

## Protected and untested areas

The following were intentionally not changed and remain unconfirmed because no clean local browser stack was available:

- Authenticated API mutation tests were also safely halted at the intended `EMAIL_NOT_VERIFIED` gate. The audit did not request a verification code because the scope prohibits sending real email; a local OTP-only fixture mode is required for those checks.
- Add/edit/delete reflection across overview, account balances, reports, limits, charts, goals, investments, loans, credit cards, and lending.
- Database/API/UI final-value parity.
- Unauthorized, expired-session, duplicate-submission, slow-network, and API-failure cases.
- Theme persistence through refresh, logout/login, and app restart.
- Charts at daily/weekly/monthly/yearly ranges, empty datasets, large datasets, zero/negative data, and responsive dimensions.
- Visual checks for Recharts tooltips, legends, hard-coded chart colours, theme contrast, clipping, and resize behaviour. Source review found charts in Overview, Analytics, Banks, IPOs, and Cards, but current rendered behaviour is not claimed without a clean local browser stack.
- Exact responsive visual inspection and accessibility keyboard/screen-reader checks.
- Under-development/adjacent screens: Categories, Recurring internals, Reports, Coach, and Premium were not modified. Bills & Reminders is implemented through the Recurring screen.

## Prioritized remediation plan

### P1 — before release

1. Fix QA-001 and make `pnpm typecheck` pass.
2. Fix QA-002 and restore executable API integration tests.
3. Resolve QA-003 and make `pnpm lint` pass.
4. Decide and implement transfer accounting (QA-009) before claiming full personal-finance transaction support.
5. Complete Savings Goal lifecycle CRUD (QA-005).

### P2 — next feature release

1. Implement the investment, UPI Credit, and Borrow/Lend lifecycle workflows (QA-006 to QA-008).
2. Add data-reflection regression tests after each financial mutation.
3. Correct global-search ARIA semantics (QA-004).

### P3 — quality expansion

1. Add dedicated automated coverage for every scoped module, especially all empty/error/invalid/date-boundary states.
2. Add repeatable fixture setup and cleanup for isolated local D1 accounts.
3. Run full responsive and visual regression coverage after the local dev-port conflict is cleared.

## Final recommendation

Do not declare the full requested finance feature set ready for production until the P1 issues are resolved and the blocked dynamic suite has been run against isolated dummy data. No fixes have been made as part of this audit.
