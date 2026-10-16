# Split Money — Complete Functional Audit

Companion to `SPLIT_MONEY_MASTER_AUDIT.md`. Focuses on end-to-end user actions and verification status.

**Statuses:** PASS | FAIL | PARTIAL | BLOCKED | NOT TESTED only. Updated 2026-10-16 after the final QA pass (Playwright 6/6 on desktop + mobile viewports; Android runtime BLOCKED).

---

## Phase 1 — Action trace summary

| User action | UI | API | Service | DB | Status |
| --- | --- | --- | --- | --- | --- |
| Open dashboard | Web home / App Split tab | `GET /dashboard` | `getDashboard` | All active expenses | PASS (integration I9 + e2e) |
| Add person | Web/App forms | `POST /people` | `createPerson` | `split_people` | PASS web (e2e ×3) / NOT TESTED Android |
| Create group + members | Web/App | `POST /groups`, members | `createGroup` | `split_groups*` | PASS web (e2e) / NOT TESTED Android |
| Create expense (6 steps) | Wizards | `POST /expenses` | `createExpense` + ledger | expenses/payers/participants | PASS (integration + e2e) |
| View expense detail | Detail screens | `GET /expenses/:id` | `getExpense` | joins + ledger | PASS (integration + e2e: 3 edges ₹1,500) |
| Record repayment | Obligation picker | `POST .../payments` | `recordPayment` | payments + version bump | PASS (integration + e2e ₹500) |
| Void repayment | Payment history | `POST .../payments/:id/void` | `voidPayment` | `voided_at`, `void_reason` | PASS web (e2e) / NOT TESTED Android |
| Mark settled | Button | `POST .../settle` | `settleAll` | batch payments | PASS (integration) / UI NOT TESTED |
| Apply adjustment | Web/App | `POST .../adjustments` | signed delta + absorb | adjustments | NOT TESTED (runtime) |
| Edit / publish / cancel / reopen / delete expense | Header actions / action list | `PATCH`, `DELETE` | versioned | expenses | NOT TESTED (runtime) |
| Schedule reminder | Button / forms | `POST .../reminders` | insert schedule | reminders | PASS (e2e) |
| Deliver reminder (in-app) | Scheduler | recurring cron | `processSplitReminders` | `status=sent`, activity | PASS (unit) / live cron NOT TESTED |
| Deliver reminder (external channels) | — | — | marked `failed` | activity `reminder_delivery_unavailable` | BLOCKED |
| Cancel reminder | Reminders list | `DELETE .../reminders/:id` | cancel | reminders | NOT TESTED |
| Simplify debts | Actions | `POST /simplify` | per-currency | suggestions table | NOT TESTED |
| Convert to lend | Actions | `POST .../convert-lend` | suggestions only | none written | PASS (by design) |
| Archive / restore person | Person detail (web + app) | `DELETE /people/:id` | soft archive | `archived_at` | NOT TESTED |
| Group balances | Balances tab / member rows | `GET /groups/:id` | `summary` + `balances` | derived | NOT TESTED |
| Authz isolation | — | `GET /expenses/:id` as other user | ownership check | — | PASS (e2e 403/404) |

---

## Phase 2 — Financial correctness

### Model

For each person on an expense:

`net = upfrontPaid − adjustedShare − absorbed + repaymentSent − repaymentReceived`

Positive net ⇒ receivable; negative ⇒ owed. Obligations are matched edges (debtor, creditor, amount). Self-debt is never emitted.

### Examples verified in integration tests

| Case | Expected | Actual | Status |
| --- | --- | --- | --- |
| You pay ₹1200; 3 equal shares | Collectible ₹800; you owed ₹800; Rahul pending ₹400 | Matched | PASS |
| You ₹700 + Rahul ₹500; Priya ₹0 share ₹400 | Priya→You ₹300, Priya→Rahul ₹100 | Matched | PASS |
| Overpay Rahul obligation ₹100 with ₹200 | Reject `PAYMENT_EXCEEDS_OBLIGATION` | Matched | PASS |
| Idempotent pay + settle | One payment; settle replay | Matched | PASS |
| 8 concurrent ₹500 pays on ₹500 collectible | No over-settle; remaining+repaid=5000 | Matched | PASS |

Property tests: 3,000 random expenses — credits = debts, no self-debt — **PASS**.

---

## Phases 3–5 — Creation, settlement, parity

See `SPLIT_MONEY_FINANCIAL_TEST_CASES.md`, `SPLIT_MONEY_WEB_APP_PARITY.md`, `SPLIT_MONEY_GROUP_TESTING.md`, `SPLIT_MONEY_BUTTON_AUDIT.md`.

---

## Acceptance criteria checklist

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Balances mathematically correct | PASS (unit + integration) |
| 2 | No incorrect self-debt | PASS (property + ledger) |
| 3 | Multiple payers correct | PASS |
| 4 | Settlements cannot duplicate/corrupt | PASS (idempotency + concurrency) |
| 5 | Dashboard matches persisted records | PASS (integration + e2e) |
| 6 | Web/app core workflows equivalent | PARTIAL — code parity implemented on both; web verified by e2e, Android runtime BLOCKED |
| 7 | History consistent | PASS (void keeps row; e2e shows `(voided)` and restored edge) |
| 8 | Automated tests pass | PASS — validation 59, finance 9, recurring 8, Playwright 6 |
| 9 | Regression gate (typecheck / lint / builds) | PASS — finance, recurring, web, app typecheck; finance/recurring lint 0; web lint 0 Split Money findings; web `next build` OK |
| 10 | Limitations documented | PASS — `SPLIT_MONEY_PENDING_WORK.md` |
| 11 | Verified vs pending distinguished | PASS |

**Production deploy / commit / push / remote D1:** not performed (not authorized).
