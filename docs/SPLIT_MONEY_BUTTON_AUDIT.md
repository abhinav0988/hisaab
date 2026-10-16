# Split Money — Button / Interaction Audit

Method: static review of handlers, loading/disabled guards, and `Idempotency-Key` headers on financial mutations, plus runtime clicks executed by `frontend/web/e2e/split-money.spec.ts` across Desktop Chromium and Mobile Pixel 5 viewports (`8/8 PASS`). Android runtime clicks: **BLOCKED** (no connected device and `/dev/kvm` unavailable on host).

---

## Backend Mutations (Shared)

| Action | Idempotency | Atomic / Versioned | Status |
| --- | --- | --- | --- |
| Create person / group / expense | Key + `request_hash` | Yes (`env.DB.batch`) | **PASS** (D1 integration + Web E2E) |
| Record repayment | Key + `request_hash` | `ledger_version` optimistic lock | **PASS** (D1 integration I1–I8 + Web E2E) |
| Void repayment | Key + `request_hash` | `ledger_version` optimistic lock | **PASS** (D1 integration I7 + Web E2E) |
| Settle all (`Mark Settled`) | Key + `request_hash` | Single batch + `ledger_version` | **PASS** (D1 integration I3 + Web E2E) |
| Apply adjustment / waiver | Key + `request_hash` | `ledger_version` optimistic lock | **PASS** (D1 integration I8 + Web E2E) |
| Edit details / Cancel / Reopen / Delete expense | Key + `request_hash` | `ledger_version`; delete refused with money history (`HAS_FINANCIAL_HISTORY`) | **PASS** (D1 integration I7, I9 + Web E2E) |
| Schedule / Cancel in-app reminder | Key + `request_hash` | Insert / Delete; recurring worker conditional `UPDATE` | **PASS** (Recurring unit 5/5 + D1 integration I9 + Web E2E) |

---

## Web Interactive Controls (`frontend/web`)

| Control | Handler | Guard | Runtime Verification | Status |
| --- | --- | --- | --- | --- |
| Sidebar / Mobile "More" → Split Money | Link / Sheet | — | Clicked (Desktop + Pixel 5) | **PASS** |
| Add Person → Save Person | `createPerson` | `isPending` | Clicked (Desktop + Pixel 5) | **PASS** |
| Edit Person → Save Changes | `patchPerson` | `isPending` | Clicked (Desktop + Pixel 5) | **PASS** |
| Archive Person / Show archived / Restore Person | `archivePerson` / `restorePerson` | `isPending` + balance guard | Clicked (Desktop + Pixel 5) | **PASS** |
| Create Group + Add / Remove Member | `createGroup` / `addGroupMember` / `removeGroupMember` | `isPending` + balance guard + confirm | Clicked (Desktop + Pixel 5) | **PASS** |
| Group Detail tabs (`Expenses`, `Balances`, `Settings`) | State + `patchGroup` | `isPending` | Clicked (Desktop + Pixel 5) | **PASS** |
| Wizard Continue / Create Split Expense | `goNext` / `createExpense` | Step validation + `isPending` | Clicked through all 6 steps | **PASS** |
| Wizard Step 5 Reminder Channels (Email / WhatsApp) | Disabled (`in_app` only) | `disabled` attribute | Asserted `toBeDisabled()` in E2E | **PASS** |
| Multi-payer total validation | `goNext` | Sum must equal total | Verified in E2E | **PASS** |
| Record repayment | Obligation select + `recordPayment` | `busy` / `isPending`; amount ≤ obligation | Clicked (`₹500` + `₹450`) | **PASS** |
| Void repayment | Confirm + prompt + `voidPayment` | `busy` | Clicked in E2E | **PASS** |
| Schedule Reminder (in-app) | `scheduleReminder` | `busy` / `isPending` / `cancelled` | Clicked in E2E | **PASS** |
| Cancel scheduled reminder | `cancelReminder` | `busy` | Clicked in E2E | **PASS** |
| Edit expense details → Save | `patchExpense` | `busy` | Clicked in E2E | **PASS** |
| Apply adjustment / waiver | `createAdjustment` | `isPending` | Clicked (`₹50` waiver) in E2E | **PASS** |
| Upload / View / Remove receipt | `uploadFile` + `attachReceipt` + `deleteReceipt` | `busy` | Clicked in E2E | **PASS** |
| Mark Settled | `settleExpense` | Disabled if `remaining <= 0` or `busy` | Clicked in E2E | **PASS** |
| Cancel expense → Reopen → Delete | `statusMutation` / `deleteExpense` | `busy` + `hasActiveRepayments` / `hasMoneyHistory` | Clicked in E2E | **PASS** |
| Split History filter tabs (`All`, `You Owe`, `Others Owe`, `Settled`) + Payment History drawer | `setTab` / `setDrawerExpense` | — | Clicked in E2E | **PASS** |

---

## React Native Android Controls (`frontend/app`)

| Control | Guard Pattern | Compilation / Bundle | Runtime Status |
| --- | --- | --- | --- |
| Add / Edit / Archive / Restore person | `useSingleFlight` / `!isPending` | TypeScript + Hermes bundle **PASS** | **BLOCKED** (no KVM/device) |
| Create / Edit group + Add / Remove member | `useSingleFlight` / `!isPending` | TypeScript + Hermes bundle **PASS** | **BLOCKED** (no KVM/device) |
| Create expense Continue / Create | `disabled={create.isPending}` + step gate | TypeScript + Hermes bundle **PASS** | **BLOCKED** (no KVM/device) |
| Record / Void repayment / Settle all | `useSingleFlight` + Alert confirm | TypeScript + Hermes bundle **PASS** | **BLOCKED** (no KVM/device) |
| Apply adjustment / Schedule & cancel reminder / Edit & cancel/reopen/delete expense | `useSingleFlight` + `confirm()` helper | TypeScript + Hermes bundle **PASS** | **BLOCKED** (no KVM/device) |
