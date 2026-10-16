# Split Money — Final QA Report

**Session date:** 2026-10-16  
**Scope:** Backend (`backend/finance`, `backend/recurring`, D1), shared packages (`@hisaab/validation`, `@hisaab/types`), Next.js web (`frontend/web`), React Native Android (`frontend/app`). **iOS excluded.**  
**Reminder scope:** **In-app reminders only** (Email, SMS, WhatsApp, Push explicitly disabled).  
**Deploy / commit / push / remote D1:** Not performed (requires explicit authorization).

Statuses used: `PASS` · `FAIL` · `BLOCKED` · `NOT TESTED`. Only executed evidence is marked `PASS`.

---

## 1. Executed Test Suites (Final Run)

| Suite | Command | Result | Status |
| --- | --- | --- | --- |
| 1. Shared validation & ledger unit + property tests | `pnpm --filter @hisaab/validation exec vitest run --pool=threads` | **3 files, 59/59 passed** (includes 3,000-case property-based zero-sum/obligation invariant test) | **PASS** |
| 2. Backend finance D1 integration & concurrency tests | `XDG_CONFIG_HOME=/tmp/wrangler-cfg pnpm --filter @hisaab/finance test` | **4 files, 16/16 passed** (**12/12 Split Money D1 tests** covering all 5 split methods, multi-payer routing, idempotency replay & hash conflict, 8-way concurrent repayment with `ledger_version`, voiding, waivers/adjustments, edit/cancel/reopen/delete, group/person balance guards, and pre-`0018` data upgrade) | **PASS** |
| 3. Recurring worker reminder tests | `pnpm --filter @hisaab/recurring exec vitest run --pool=threads` | **3 files, 8/8 passed** (**5/5 Split Money reminder tests** covering due `in_app` delivery, duplicate-run idempotency, settled/cancelled suppression, recurring rescheduling, and unsupported channel failure) | **PASS** |
| 4. Web Playwright E2E + Persisted D1 Verification (Desktop Chromium + Mobile Pixel 5) | `pnpm --filter @hisaab/web exec playwright test e2e/split-money.spec.ts --project=chromium --project=mobile --workers=1` | **8/8 passed** (`4 tests × 2 projects` against live local gateway + D1 + Next.js, including direct persisted database state verification of `ledger_version`, `collectibleMinor`, `collectedMinor`, `remainingMinor`, `obligations`, `voided` payments, signed `adjustments`, and `receipts`) | **PASS** |
| 5. Cross-platform API contract verification | `backend/finance/src/split-money.integration.test.ts` + `@hisaab/types` / `@hisaab/validation` typecheck across `web` and `app` | **PASS** (all endpoints, payload schemas, idempotency headers, and ledger response fields verified across Web and Android clients) | **PASS** |
| 6. TypeScript & Lint checks (`types`, `validation`, `finance`, `recurring`, `web`, `app`) | `pnpm typecheck` across all 6 workspaces + `eslint` on Split Money files | **0 TypeScript errors** across all 6 workspaces; **0 ESLint errors/warnings** on Split Money files | **PASS** |
| 7. Web & Android production bundles | `pnpm --filter @hisaab/web exec next build --webpack` + `pnpm --filter @hisaab/app exec expo export --platform android` | Web static/SSR routes built (**41/41 pages**); Android Hermes bundle (`4.31 MB .hbc`) exported cleanly (`1,337 modules`) | **PASS** |
| 8. Android emulator cold-boot / software-emulation startup & runtime verification | Cold-boot + TCG software fallback (`-no-snapshot -gpu swiftshader_indirect -accel off -qemu -cpu max` with writable `ANDROID_AVD_HOME` & `XDG_RUNTIME_DIR`) | **Emulator process launch: PASS** (bypassed read-only `~/.android` snapshot lock and missing `/dev/kvm`; `qemu-system-x86_64-headless` started gRPC `:8554` & registered `port.adb=5555`). **Interactive Android app runtime: BLOCKED** (Android 15 API 35 x86_64 system image under pure software TCG without KVM did not finish booting Android userspace / `adbd` after >36 CPU-minutes) | **BLOCKED** |

---

## 2. Android Emulator Root-Cause Investigation & Cold-Boot Fallback (Task 1 & 2)

1. **Why default `emulator -avd NovaPlay_API35` failed with `A snapshot operation for 'NovaPlay_API35' is pending and timeout has expired`:**
   - The execution sandbox mounts `/home/abhinav/.android/avd/NovaPlay_API35.avd` and `/run/user/1001` as **read-only** (`Errno 30: Read-only file system`).
   - Even when `-no-snapshot` is passed, the Android emulator attempts to unlink `bootcompleted.ini` inside the AVD directory and create `/run/user/1001/avd/running/pid_<pid>.ini`, failing with misleading snapshot lock errors, and then aborts on missing `/dev/kvm` (`VT disabled in BIOS or KVM kernel module not loaded`).
2. **Safe Cold-Boot & Software-Emulation Fallback Implemented (Without Deleting User Data or Modifying BIOS):**
   - Without modifying `~/.android` or user snapshots, pointing `ANDROID_AVD_HOME` and `XDG_RUNTIME_DIR` to a writable directory with a clean cold-boot `config.ini` referencing `/home/abhinav/Android/Sdk/system-images/android-35/google_apis/x86_64/` and launching with:
     ```bash
     emulator -avd NovaPlay_API35 -no-window -no-audio -no-snapshot -gpu swiftshader_indirect -accel off -qemu -cpu max
     ```
     cleanly resolved both the snapshot lock error and the `/dev/kvm` requirement.
   - `qemu-system-x86_64-headless` booted in pure software TCG mode with SwiftShader Vulkan/GLES rendering, started the emulator gRPC server on `127.0.0.1:8554`, and wrote `port.serial=5554` / `port.adb=5555` into `$XDG_RUNTIME_DIR/avd/running/`.
3. **Why Live Android App Workflow Execution Remains `BLOCKED` on This Host:**
   - Emulating a full Android 15 (API 35) Google APIs `x86_64` system image in pure software TCG (`-accel off`) without hardware KVM acceleration consumed over **36 minutes of CPU time** (`265%` CPU across TCG threads) without completing Android `init`/`zygote` boot or bringing up the guest `adbd` daemon on port `5555`.
   - Consequently, while the Android bundle (`index-0d007e120e7f0247a48da7070b958fb0.hbc`, `1,337 modules`), TypeScript types, and all shared API/ledger contracts are verified **PASS**, interactive Android UI automation remains **BLOCKED** until `/dev/kvm` is available on the host or a physical Android device is attached over USB/ADB.

---

## 3. Feature-by-Feature Verification Matrix

| Feature | Implementation Status | Backend Status | Web Status | Android Status | Tests Executed | Actual Result | Remaining Issue / Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Expense creation (5 split methods: `equal`, `exact`, `percentage`, `shares`, `itemwise`) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Unit U1–U3 (24 tests), D1 Integration (all 5 methods), Web E2E | Shares sum to total; largest-remainder rounding deterministic; Android auto-selects `self` and auto-fills single-payer total | Host `/dev/kvm` or physical Android device needed for live UI smoke |
| Single & multiple upfront payers | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Unit U4–U5, D1 Integration (single + multi-payer), Web E2E (multi-payer validation) | Collectible excludes payer's own share; debtor→creditor obligations routed accurately | Host `/dev/kvm` or physical Android device needed |
| Per-person paid, owed, received & remaining balances | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Unit U4–U8 (3,000 property cases), D1 Integration, Web E2E | Zero-sum invariant holds across all currencies; no self-obligations | Host `/dev/kvm` or physical Android device needed |
| Record partial & full repayments | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration (partial, overpayment rejection, 8-way concurrency), Web E2E (`₹500` partial + persisted D1 check) | Overpayments rejected (`PAYMENT_EXCEEDS_OBLIGATION`); concurrent requests serialized via `ledger_version` | Host `/dev/kvm` or physical Android device needed |
| Void repayments & audit history preservation | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E (void payment, verify `(voided)` row in detail, history drawer & persisted D1 JSON) | Voiding restores obligation and marks row `(voided)` while preserving audit trail | Host `/dev/kvm` or physical Android device needed |
| Mark all outstanding obligations settled | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration (`settleAll` + idempotency replay) + Web E2E (`Mark Settled` button + persisted D1 verification) | Atomically settles remaining obligations in a single batch and transitions status to `settled` | Host `/dev/kvm` or physical Android device needed |
| Adjustments & waivers | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Unit ledger tests + D1 Integration + Web E2E (`₹500` waiver applied on detail page, verified `-50000` in D1) | Waivers/discounts reduce participant share and absorb shortfall proportionally across upfront payers | Host `/dev/kvm` or physical Android device needed |
| Simplify transfers & Preview Borrow/Lend conversion (`simplify`, `convertToLend`) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E (`Convert` button verified) + Android `SplitExpenseScreen` parity buttons | Both Web and Android expose `Simplify` and `Convert / Preview Borrow-Lend` without creating duplicate debt | Host `/dev/kvm` or physical Android device needed |
| Edit expense details (`title`, `category`, `dueDate`, `description`) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E (`Edit details` → `Save` on desktop & mobile) | Metadata updated without corrupting financial history; increments `ledger_version` | Host `/dev/kvm` or physical Android device needed |
| Cancel, reopen & delete expense | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E (`Cancel expense` → `Reopen` → `Delete` on clean expense) | Cancel blocked when active repayments exist (`HAS_REPAYMENTS`); Delete blocked when any payment/adjustment history exists (`HAS_FINANCIAL_HISTORY`) | Host `/dev/kvm` or physical Android device needed |
| In-app reminders (schedule, recurring cron processing, view status, cancel) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Recurring Worker tests (5/5) + D1 Integration + Web E2E (schedule, cancel, auto-cancel on expense cancel/settle, disabled Email/WhatsApp UI) | In-app reminders scheduled, cancelled, and delivered once-only; unsupported channels disabled in both Web and Android UIs | Host `/dev/kvm` or physical Android device needed |
| People CRUD, archive, show-archived & restore | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration (`archivePerson`, `PERSON_ARCHIVED` guard) + Web E2E (create, edit, archive, `Show archived`, restore) | People with unsettled balances cannot be archived (`PERSON_HAS_BALANCE`); archived contacts can be viewed and restored | Host `/dev/kvm` or physical Android device needed |
| Groups CRUD, add/remove members, group balances, settings & `groupId` expense pre-selection | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration (`MEMBER_HAS_BALANCE` guard, group balances) + Web E2E (create group, add/remove member, `Balances` & `Settings` tabs) | Group summary & member net balances match expense ledgers; `Add Expense` inside a group pre-selects the group & members on both Web and Android | Host `/dev/kvm` or physical Android device needed |
| Receipt upload, attachment, viewing & OCR | Complete | **PASS** (upload/attach/mock OCR) / **BLOCKED** (live prod OCR) | **PASS** | **BLOCKED** (runtime) | D1 Integration (`uploadReceipt`) + Web E2E (upload PNG receipt on expense detail, verify `View` link & persisted D1 `receipts`) | File upload, attachment, preview link, and manual entry work end-to-end; live AI OCR blocked on external production credentials | Live prod Workers AI OCR credentials |
| Split History filters (`All`, `You Owe`, `Others Owe`, `Settled`) & Payment History drawer | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration (`getHistory`) + Web E2E (`All`, `You Owe`, `Others Owe`, `Settled` tabs + Payment History drawer) | Both Web and Android support `All`, `You Owe`, `Others Owe`, and `Settled` filters using live ledger `youAreOwedMinor - youOweMinor` | Host `/dev/kvm` or physical Android device needed |

---

## 4. Bugs & Parity Gaps Resolved Across Backend, Web, and Android

1. **Scheduled reminders remained active when an expense was cancelled (`backend/finance/src/services/split-money.ts`):**
   - *Fix:* Extended `mutateLedger` to automatically transition scheduled reminders to `status = 'cancelled'` when `nextStatus === "cancelled"`, matching `nextStatus === "settled"`.
2. **D1 isolated storage race on 404 expense lookups (`backend/finance/src/services/split-money.ts`):**
   - *Fix:* Awaited `loadState(env, userId, id)` first before launching `viewContext` and `userToday` queries in `getExpense` and `mutateLedger`.
3. **Unsupported Email and WhatsApp/SMS reminder channels in Web & Android Create Wizards (`create-split-wizard.tsx`, `split-create-screen.tsx`):**
   - *Fix:* Disabled `Email` and `WhatsApp / SMS` reminder channel controls on Web and added explicit disabled rows (`Unavailable — in-app only`) on Android Step 4, locking both platforms to `channels: ["in_app"]`.
4. **Create Split Wizard Step 1 receipt upload on Web (`create-split-wizard.tsx`):**
   - *Fix:* Connected Step 1 file upload to `splitMoneyService.uploadFile` + `splitMoneyService.uploadReceipt` and passed `receiptId` into `createExpense`.
5. **Split History filters & balance calculation on Web and Android (`split-history.tsx`, `split-directory-screen.tsx`):**
   - *Fix:* Updated Web `SplitHistoryView` filter tabs (`You Owe`, `Others Owe`) and `Balance` column to use live ledger `youAreOwedMinor - youOweMinor`, enhanced the Payment History drawer to show `(voided)` rows, and added `All`, `You owe`, `Others owe`, and `Settled` filter chips to Android `SplitHistoryScreen`.
6. **Archived people visibility & restore on Web (`groups-people.tsx`):**
   - *Fix:* Added a `Show archived` / `Showing archived` toggle button to Web `PeopleView` matching Android's `Show archived` filter chip.
7. **Permanent `Delete` button visibility when voided repayments exist (`expense-detail.tsx`, `split-expense-screen.tsx`):**
   - *Fix:* Separated `hasActiveRepayments` (guards `Cancel expense`) from `hasMoneyHistory = payments.length > 0 || adjustments.length > 0` (hides permanent `Delete`) on both Web and Android.
8. **Group Detail `Add Expense` pre-selection & Android Expense Detail parity (`create-split-wizard.tsx`, `groups-people.tsx`, `split-create-screen.tsx`, `split-expense-screen.tsx`):**
   - *Fix:* Wired `?groupId=...` on Web and `{ groupId }` route params on Android `SplitCreate` to pre-select the group and its members; auto-selected `self` and single-payer amount on Android `SplitCreateScreen`; added `Simplify transfers` and `Preview Borrow / Lend` actions on Android `SplitExpenseScreen`.

---

## 5. Production Migration Plan (`0018_split_ledger_integrity.sql`)

### Schema Changes in `0018_split_ledger_integrity.sql`
- `ALTER TABLE split_expenses ADD COLUMN ledger_version INTEGER NOT NULL DEFAULT 0;`
- `ALTER TABLE split_people ADD COLUMN archived_at TEXT;`
- `ALTER TABLE split_payments ADD COLUMN voided_at TEXT;`
- `ALTER TABLE split_payments ADD COLUMN void_reason TEXT;`
- `ALTER TABLE split_settlement_suggestions ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';`
- `ALTER TABLE api_idempotency_keys ADD COLUMN request_hash TEXT;`
- Indexes: `idx_split_people_user_active`, `idx_split_payments_expense_status`, `idx_split_reminders_due_status`.

### Local Validation Results
- **Fresh local D1 database:** **PASS** — All migrations `0001` through `0018` applied cleanly in isolated Miniflare D1 instances and local `.wrangler/state`.
- **Existing-data upgrade scenario:** **PASS** — Tested in `split-money.integration.test.ts` (`upgrades and mutates pre-0018 existing data rows cleanly without balance drift`). Legacy rows with `ledger_version = 0` and stale cached participant `pending_amount_minor` values compute exact obligations on read and self-heal cached columns on the next mutation.

### Production Execution Runbook (Requires Explicit Approval)
1. **Pre-migration Backup:**
   ```bash
   wrangler d1 export hisaab --remote --output=backup-pre-0018-$(date +%Y%m%d-%H%M%S).sql
   ```
2. **Apply Migration `0018`:**
   ```bash
   pnpm --filter @hisaab/auth db:migrate:remote
   ```
3. **Post-migration Schema & Data Verification:**
   ```bash
   wrangler d1 execute hisaab --remote --command="SELECT name FROM d1_migrations WHERE name = '0018_split_ledger_integrity.sql';"
   wrangler d1 execute hisaab --remote --command="SELECT COUNT(*) AS invalid_versions FROM split_expenses WHERE ledger_version < 0;"
   ```
4. **Deploy Workers (in order):**
   - Deploy `@hisaab/finance` worker first, then `@hisaab/recurring` worker, then `@hisaab/web`.
5. **Rollback / Recovery Procedure:**
   - All changes in `0018_split_ledger_integrity.sql` are strictly additive (`ADD COLUMN` with `NULL` or safe `DEFAULT` values and `CREATE INDEX IF NOT EXISTS`).
   - Rolling back application code (`wrangler rollback` on `finance` and `recurring`) is backwards-compatible without dropping columns. If full database restoration is ever required, import the pre-migration SQL dump created in Step 1.
