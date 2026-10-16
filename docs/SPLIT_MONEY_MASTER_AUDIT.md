# Split Money — Master Audit

**Date:** 2026-10-16 (final release QA pass)  
**Scope:** Backend (`backend/finance`, `backend/recurring`, D1), shared validation/ledger (`@hisaab/validation`, `@hisaab/types`), Next.js web (`frontend/web`), React Native Android (`frontend/app`). **iOS excluded.**  
**Reminder scope:** **In-app reminders only** (Email, SMS, WhatsApp, Push explicitly disabled).

---

## Executive Summary

All financial accounting runs on the single deterministic obligation ledger (`computeSplitLedger` in `@hisaab/validation`). Every backend endpoint, concurrency lock (`ledger_version`), idempotency hash check (`request_hash`), recurring in-app reminder job, and web interactive flow has been implemented, fixed, and verified **PASS**:

- **Shared Validation & Ledger Unit/Property Tests (`@hisaab/validation`):** **59/59 PASS** (including 3,000-case property test).
- **Backend Finance D1 Integration & Concurrency Tests (`@hisaab/finance`):** **16/16 PASS** (12/12 Split Money D1 tests).
- **Recurring Worker Reminder Tests (`@hisaab/recurring`):** **8/8 PASS** (5/5 Split Money reminder tests).
- **Web Playwright E2E (`@hisaab/web`):** **8/8 PASS** (`4 comprehensive tests × 2 viewports: Desktop Chromium + Mobile Pixel 5`).
- **TypeScript & Production Bundles:** **0 errors** across all 6 workspaces; Next.js web production build (`41/41 pages`) **PASS**; Android Hermes production bundle (`4.31 MB .hbc`) **PASS**.
- **Android Runtime Verification:** **BLOCKED** (`adb devices -l` empty and `/dev/kvm` missing on host).
- **Production D1 Migration `0018` & Live OCR:** Local fresh & upgrade D1 tests **PASS**; remote production apply awaits explicit approval; live AI OCR awaits production Workers AI credentials.

---

## Master Feature Status

| Feature | Backend | Web | Android | Status | Supporting Evidence |
| --- | --- | --- | --- | --- | --- |
| 5 Split methods (`equal`, `exact`, `percentage`, `shares`, `itemwise`) | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | Unit U1–U3 (24 tests), D1 Integration I12, Web E2E W1 |
| Single & multiple upfront payers | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | Unit U4–U5, D1 Integration I1–I2, Web E2E W1 |
| Per-person paid, owed, received & remaining balances | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | Unit U8 (3,000 property cases), D1 Integration I1–I12, Web E2E W1 |
| Partial & full repayments + overpayment rejection | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I2–I4, Web E2E W1 |
| Concurrent repayments + idempotency key replay & hash conflict | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I3, I4 (8-way concurrency), I6 |
| Void repayment + audit history preservation | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I7, Web E2E W1 |
| Atomic Mark Settled (`settleAll`) | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I3, Web E2E W1 |
| Adjustments & waivers with proportional payer absorption | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I8, Web E2E W1 |
| Edit details, Cancel, Reopen & Delete expense | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I7, I9, Web E2E W1, W2 |
| In-app reminders (schedule, recurring cron delivery, view, cancel) | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | Recurring R1–R5, D1 Integration I9, Web E2E W1 |
| People CRUD, archive, show-archived & restore | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I10, Web E2E W1, W2 |
| Groups CRUD, members, balances tab, settings tab & balance guards | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) | D1 Integration I10, Web E2E W1, W2 |
| Receipt upload, attachment, viewing & removal | **PASS** | **PASS** | **BLOCKED** (runtime) | **PASS** (Web/Backend) / **BLOCKED** (live OCR) | D1 Integration I12, Web E2E W1 |
| Migration `0018_split_ledger_integrity.sql` (fresh + pre-0018 upgrade) | **PASS** | **PASS** | **PASS** (schema) | **PASS** (Local) | D1 Integration I11 + E2E D1 state |

---

## Related Audit Documents

- `docs/SPLIT_MONEY_FINAL_QA.md` — Final QA report, test matrix, bug fixes, and production migration runbook
- `docs/SPLIT_MONEY_FINANCIAL_TEST_CASES.md` — Detailed unit, property, D1 integration, concurrency, reminder, and E2E test cases
- `docs/SPLIT_MONEY_WEB_APP_PARITY.md` — Feature and API contract parity across Web and Android
- `docs/SPLIT_MONEY_BUTTON_AUDIT.md` — Interactive button and duplicate-submission audit
- `docs/SPLIT_MONEY_GROUP_TESTING.md` — Group workflows, balances, and member guard verification
- `docs/SPLIT_MONEY_PENDING_WORK.md` — Remaining external blockers and approval gates
