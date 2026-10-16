# Split Money — Web / Android Parity

Both platforms call the same finance API (`/api/v1/split-money/*`); the backend obligation ledger (`computeSplitLedger`) is the single source of truth, so financial calculations are identical by construction. **iOS is excluded.**

**Verification this session:**
- **Web (`frontend/web`):** Interactive Playwright E2E across Desktop Chromium and Mobile Pixel 5 (**8/8 PASS**, including persisted D1 database verification), TypeScript (`PASS`), ESLint on Split Money (`PASS`), Production Build (`PASS`, `41/41` routes).
- **Android (`frontend/app`):** Full feature-by-feature parity implemented across all Split Money screens, TypeScript (`PASS`, `0 errors`), Production Hermes Bundle Export (`PASS`, `4.31 MB .hbc`, `1,337 modules`). Emulator cold-boot/TCG startup succeeded (`qemu-system-x86_64-headless` started gRPC `:8554`), while interactive Android runtime execution remains **BLOCKED** because Android 15 (API 35) `x86_64` under pure software TCG without `/dev/kvm` does not finish booting userspace/`adbd` within practical test timeouts.

---

## Feature Parity Matrix

| Feature | Implementation Status | Backend Status | Web Status | Android Status | Tests Executed | Actual Result | Remaining Issue / Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard (totals, you owe / are owed, group balances) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E (desktop & mobile) | Live ledger totals; fake hard-coded month-over-month % removed | Host `/dev/kvm` or physical Android device needed |
| People list + `Show archived` toggle | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Both Web and Android support `Show archived` toggle and display `(Archived)` state | Host `/dev/kvm` or physical Android device needed |
| Add person (name, phone, email, relationship) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Full form validation and duplicate prevention on both platforms | Host `/dev/kvm` or physical Android device needed |
| Edit, archive & restore person | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E (edit, archive, show-archived, restore) | `PERSON_HAS_BALANCE` guard prevents archiving contacts with open obligations | Host `/dev/kvm` or physical Android device needed |
| Person detail per-currency balances | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration (`getPersonDetails`) + Web E2E | Displays net balances per currency and shared expenses | Host `/dev/kvm` or physical Android device needed |
| Groups list & create group with members | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Creates group with description, type, and initial members | Host `/dev/kvm` or physical Android device needed |
| Group detail summary, `Balances` tab & `Settings` tab | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E (`Expenses`, `Balances`, `Settings` tabs) | Shows total shared, collected, outstanding, settled %, and per-member net balances | Host `/dev/kvm` or physical Android device needed |
| Add / remove group member + unsettled balance guard | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration (`MEMBER_HAS_BALANCE`) + Web E2E (add & remove member) | Blocks removing a member with unsettled obligations in the group | Host `/dev/kvm` or physical Android device needed |
| Create expense wizard (5 split methods, single/multi-payer, `self` default, `groupId` pre-selection) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Unit tests (59) + D1 Integration (all 5 methods) + Web E2E | Supports `equal`, `exact`, `percentage`, `shares`, `itemwise`, multi-payer validation, default `self` payer/participant, and `groupId` pre-selection on both Web and Android | Host `/dev/kvm` or physical Android device needed |
| Expense detail (ledger summary, obligations, statuses) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Displays collectible, collected, remaining, and exact `debtor → creditor` edges | Host `/dev/kvm` or physical Android device needed |
| Record partial & full repayments | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Updates obligation edges, participant statuses, and payment history with `Idempotency-Key` | Host `/dev/kvm` or physical Android device needed |
| Void repayment | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Reverses repayment, restores obligation, and marks payment `(voided)` | Host `/dev/kvm` or physical Android device needed |
| Mark all outstanding obligations settled (`settleAll`) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Atomically records remaining obligations and marks expense `settled` | Host `/dev/kvm` or physical Android device needed |
| Adjustments & waivers (`waived`, `discounted`, `increased`, `corrected`) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Unit tests + D1 Integration + Web E2E | Applies signed adjustment and proportionally absorbs shortfall across payers | Host `/dev/kvm` or physical Android device needed |
| Simplify transfers & Preview Borrow/Lend conversion (`simplify`, `convertToLend`) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Both Web `ExpenseDetail` and Android `SplitExpenseScreen` provide `Simplify` and `Convert / Preview Borrow-Lend` | Host `/dev/kvm` or physical Android device needed |
| Edit expense metadata (`title`, `category`, `description`, `dueDate`) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Updates metadata cleanly while preserving ledger history | Host `/dev/kvm` or physical Android device needed |
| Cancel, reopen & delete expense (guarded by money history) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Cancel requires no active repayments; Delete hidden/blocked once any payment or adjustment exists (`hasMoneyHistory`) | Host `/dev/kvm` or physical Android device needed |
| In-app reminders (schedule, view status, cancel; external channels disabled) | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | Recurring Worker tests (5/5) + D1 Integration + Web E2E | In-app reminders scheduled and cancelled; Email/SMS/WhatsApp explicitly shown as disabled (`Unavailable — in-app only`) on both Web and Android | Host `/dev/kvm` or physical Android device needed |
| Receipt upload, attachment, viewing & removal | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Uploads file, attaches to expense, renders `View` link, and unlinks cleanly; live AI OCR **BLOCKED** on prod credentials | Live prod OCR credentials + Android device |
| Split History filters (`All`, `You Owe`, `Others Owe`, `Settled`) & Payment History drawer | Complete | **PASS** | **PASS** | **BLOCKED** (runtime) | D1 Integration + Web E2E | Both Web and Android filter by `All`, `You Owe`, `Others Owe`, and `Settled` using live ledger `youAreOwedMinor - youOweMinor` | Host `/dev/kvm` or physical Android device needed |

---

## Cross-Platform API & Payload Alignment

| Contract Item | Web (`splitMoneyService`) | Android (`splitMoneyApi`) | Status |
| --- | --- | --- | --- |
| `Idempotency-Key` header on `createExpense`, `patchExpense`, `replaceSplit`, `recordPayment`, `voidPayment`, `createAdjustment`, `scheduleReminder`, `settleExpense`, `createPerson`, `createGroup` | Yes (`idemKey()`) | Yes (`idemKey()`) | **PASS** |
| Obligation-based repayment payload (`payerPersonId`, `receiverPersonId`, `amountMinor`, `method`, `paymentDate`) | Yes | Yes | **PASS** |
| Signed adjustment payload (`participantId`, `type`, `amountMinor`, `reason`) | Yes | Yes | **PASS** |
| In-app reminder payload (`channels: ["in_app"]`, `frequency`, `firstReminderDaysBefore`, `message`) | Yes | Yes | **PASS** |
| `hasMoneyHistory` (`payments.length > 0 \|\| adjustments.length > 0`) vs `hasActiveRepayments` (`completedPayments.length > 0`) | Yes | Yes | **PASS** |

## Oct 16 defect round — parity additions

| Feature | Implementation Status | Backend Status | Web Status | Android Status | Tests Executed | Actual Result | Remaining Issue / Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create: step-mapped validation errors (`splitWizardIssues`) | Complete | **PASS** | **PASS** | Typecheck only | Unit + E2E | Both jump to the failing step with the exact message | Android runtime blocked |
| Create review: ledger-derived "Owes X / Paid upfront" | Complete | n/a | **PASS** | Typecheck only | E2E | Both use shared `computeSplitLedger` | Android runtime blocked |
| Expense detail: collected / still owed / refund due, payment flags, self-duplicate tag, settle blocked while flagged | Complete | **PASS** | **PASS** | Typecheck only | D1 + E2E | Same fields from the API on both platforms | Android runtime blocked |
| Dashboard: collectible-based progress, refunds separate | Complete | **PASS** | **PASS** | Typecheck only | D1 + E2E | Same summary fields | Android runtime blocked |
