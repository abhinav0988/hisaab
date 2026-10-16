# Split Money — Financial Test Cases

Evidence from executed test suites only (2026-10-16, final run after all fixes). Amounts in minor units (paise) unless shown as `₹`.

Ledger model under test:
\[
\text{net} = \text{upfrontPaid} - \text{adjustedShare} - \text{absorbed} + \text{repaymentSent} - \text{repaymentReceived}
\]
Obligations are directed `debtor → creditor` edges derived deterministically by `computeSplitLedger`; no self-debt (`debtor === creditor`) is ever emitted.

---

## A. Shared Validation & Ledger Unit / Property Suite (`packages/validation`)

**Command:** `pnpm --filter @hisaab/validation test`  
**Result:** **3 test files, 59/59 passed** — **PASS**

| ID | Case | Expected | Actual Result | Status |
| --- | --- | --- | --- | --- |
| U1 | Equal split with uneven total (`₹100.00` / 3) | Shares sum to `10000` minor; remainder distributed deterministically via largest-remainder | `3334 + 3333 + 3333 = 10000` | **PASS** |
| U2 | Percentage split validation | Must total `10000` bps (`100%`); rejects otherwise | Validated | **PASS** |
| U3 | Weighted shares & item-wise split | Proportional allocation + tax/tip/discount distribution | Sum of participant shares equals expense total | **PASS** |
| U4 | Single-payer 3-way split (`₹1,200` paid by You) | Collectible = `80000` (`₹800`); no self-obligation edge | Collectible `80000`, 2 obligations to You | **PASS** |
| U5 | Multi-payer net positions | Obligations match net creditor/debtor balances | Verified | **PASS** |
| U6 | Valid partial and full repayments | Reduces only the matching `debtor → creditor` obligation edge | Remaining decreases by exact payment amount | **PASS** |
| U7 | Overpayment or invalid receiver | Rejected by `checkRepayment` before any DB write | Throws `PAYMENT_EXCEEDS_OBLIGATION` / `NO_OBLIGATION_TO_RECEIVER` | **PASS** |
| U8 | Property-based test across **3,000 random expenses** | \(\sum \text{credits} = \sum \text{debts}\), zero-sum net balances, no self-obligations, repayments never exceed obligations | **3,000/3,000 random cases passed** | **PASS** |

---

## B. Backend D1 Integration & Concurrency Suite (`backend/finance`)

**Command:** `pnpm --filter @hisaab/finance test` (isolated Miniflare D1 with all migrations `0001`–`0018`)  
**Result:** **4 test files, 16/16 passed (12/12 Split Money integration tests)** — **PASS**

| ID | Case | Expected | Actual Result | Status |
| --- | --- | --- | --- | --- |
| I1 | Single-payer equal split (`₹1,200` paid by You across You + Rahul + Priya) | `collectibleMinor = 80000`, `youAreOwedMinor = 80000`, 2 obligations of `40000` to You | Matched (`80000` collectible, 2 edges) | **PASS** |
| I2 | Multi-payer routing (`₹700` You, `₹500` Rahul; equal shares `₹400` each) | Priya owes You `30000` (`₹300`) and Rahul `10000` (`₹100`); paying Rahul `₹200` fails (`PAYMENT_EXCEEDS_OBLIGATION`); paying Rahul `₹100` succeeds | Matched (`Priya → Rahul` settled, `Priya → You` `30000` remaining) | **PASS** |
| I3 | Idempotency key replay & atomic `settleAll` | Replaying payment key returns `replayed: true` without duplicate row; `settleAll` settles remaining edges atomically | Matched (`replayed: true`, `remainingMinor = 0`, `status = settled`) | **PASS** |
| I4 | **8-way concurrent repayment attempts** (`8 × ₹50` against a `₹50` obligation) | Optimistic locking (`ledger_version`) + obligation check ensures total repaid never exceeds `5000` | Exactly `5000` repaid, `0` remaining, no over-settlement | **PASS** |
| I5 | Dashboard live ledger aggregation | Summary totals match active expense ledgers; fake month-over-month % changes are `null` | Matched | **PASS** |
| I6 | Idempotency key conflict (`IDEMPOTENCY_KEY_REUSED`) | Reusing the same `Idempotency-Key` with a different payment amount is rejected with `409 IDEMPOTENCY_KEY_REUSED` | Rejected with `IDEMPOTENCY_KEY_REUSED` | **PASS** |
| I7 | Void repayment + cancel/delete history guards + re-payment | Active repayment blocks cancel (`HAS_REPAYMENTS`) and delete (`HAS_FINANCIAL_HISTORY`); voiding restores obligation to `30000`, keeps delete blocked (`HAS_FINANCIAL_HISTORY`), and allows re-paying `30000` | Matched | **PASS** |
| I8 | Waivers & adjustments with proportional payer absorption | `₹150` waiver on `₹400` share in multi-payer (`₹800`/`₹400`) absorbs `₹100`/`₹50` onto payers; \(\sum \text{netMinor} = 0\) | `absorbedMinor = 10000` & `5000`, net sum `0` | **PASS** |
| I9 | Edit metadata, cancel/reopen expense, auto-cancel scheduled reminders, manual reminder cancel, clean delete | Cancelling expense auto-cancels scheduled reminders; reopening restores `pending`; clean expense deletes (`404` on re-fetch) | Matched | **PASS** |
| I10 | Group member & person archive balance guards | Removing group member or archiving person with open balance fails (`MEMBER_HAS_BALANCE`, `PERSON_HAS_BALANCE`); succeeds after `settleAll`; archived person blocked (`PERSON_ARCHIVED`) until restored | Matched | **PASS** |
| I11 | Pre-`0018` legacy data upgrade | Pre-`0018` row with `ledger_version = 0` and stale `pending_amount_minor = 0` derives `20000` owed on read and heals cached columns on payment | Matched (`remainingMinor = 12000` after `8000` payment) | **PASS** |
| I12 | All 5 split methods (`equal`, `exact`, `percentage`, `shares`, `itemwise`) + `replaceSplit`, `convertExpenseToLend`, `simplifySettlements`, `getHistory`, `getAnalytics`, `getPersonDetails` | All 5 methods compute exact collectible amounts; `replaceSplit` updates split before payments; helper endpoints return consistent ledger values | Matched | **PASS** |

---

## C. Recurring Worker Reminder Suite (`backend/recurring`)

**Command:** `pnpm --filter @hisaab/recurring test`  
**Result:** **3 test files, 8/8 passed (5/5 Split Money reminder tests)** — **PASS**

| ID | Case | Expected | Actual Result | Status |
| --- | --- | --- | --- | --- |
| R1 | Due `in_app` reminder processed twice | Conditional `UPDATE ... WHERE status = 'scheduled'` delivers once-only; single `reminder_sent` activity | `sent: 1` on first run, `sent: 0` on second run | **PASS** |
| R2 | Future reminder | Not delivered before `next_trigger_at` | `sent: 0`, remains `scheduled` | **PASS** |
| R3 | Settled or cancelled expense | Scheduled reminder is cancelled (`status = 'cancelled'`), never sent | `cancelled: 1`, `sent: 0` | **PASS** |
| R4 | Unsupported external channel (`email`) | Marked `status = 'failed'` with `reminder_delivery_unavailable` activity (`channel_not_connected`) | `failed: 1`, `sent: 0` | **PASS** |
| R5 | Recurring reminder (`every_3_days`) | Advances `next_trigger_at` strictly into the future and stays `scheduled` | Next trigger `2026-10-11T08:00:00.000Z`, `rescheduled: 1` | **PASS** |

---

## D. Web Playwright E2E Suite (`frontend/web/e2e/split-money.spec.ts`)

**Command:** `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright pnpm --filter @hisaab/web exec playwright test e2e/split-money.spec.ts --project=chromium --project=mobile --workers=1`  
**Result:** **8/8 passed (`4 tests × 2 viewports: Desktop Chromium + Mobile Pixel 5`)** — **PASS**

| ID | Case | Expected | Actual Result | Status |
| --- | --- | --- | --- | --- |
| W1 | Full lifecycle journey (create people, create group, 6-step equal split `₹6,000` / 4, disabled Email/WhatsApp reminder channels, record `₹500` partial payment, void payment, re-record `₹450`, schedule & cancel in-app reminder, edit expense details, apply `₹50` waiver, upload/view/remove receipt, Mark Settled, Split History filter tabs & Payment History drawer) | All mutations succeed with 2xx responses, UI balances update immediately, voided payment appears in history drawer, Mark Settled transitions to `Settled` | **PASS** on both Desktop Chromium and Mobile Pixel 5 | **PASS** |
| W2 | People & Groups lifecycle (create/edit/archive/show-archived/restore person, create group, add/remove member, Group `Balances` & `Settings` tabs, Create -> Cancel -> Reopen -> Delete clean expense) | All buttons and confirmation flows succeed; deleted expense disappears from list | **PASS** on both Desktop Chromium and Mobile Pixel 5 | **PASS** |
| W3 | Mobile viewport (`390×844` / Pixel 5) layout & overflow check | `scrollWidth <= innerWidth + 2` on `/split-money` and `/split-money/create`; header actions wrap cleanly | **PASS** on both projects | **PASS** |
| W4 | Cross-user authorization isolation | User B requesting User A's expense (`GET /api/v1/split-money/expenses/:id`) receives `403` or `404` | **PASS** (`404` returned) | **PASS** |

---

## E. React Native Android Verification (`frontend/app`)

- **TypeScript compilation (`pnpm --filter @hisaab/app typecheck`):** **PASS** (0 errors).
- **Production Hermes bundle export (`expo export --platform android`):** **PASS** (`1,337 modules` bundled into `4.31 MB .hbc`).
- **Android emulator / physical device runtime execution:** **BLOCKED** (`adb devices -l` empty; `/dev/kvm` missing on host).
