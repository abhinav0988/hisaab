# Split Money: How Every Feature Works

Split Money records a shared bill, who paid it up front, how the cost is divided, and who still owes whom until every obligation is settled.

This guide matches the code as of the ledger repair (2026-10-16). It is not a claim that every UI path was manually clicked; automated financial tests are listed at the end. For PASS/FAIL matrices see `docs/SPLIT_MONEY_*.md`.

---

## 1. Where the code lives

| Layer | Location |
| --- | --- |
| API routes | `backend/finance/src/routes/split-money.ts` |
| Business logic | `backend/finance/src/services/split-money.ts` |
| Split allocation maths | `packages/validation/src/split-money.ts` |
| **Ledger / obligations** | `packages/validation/src/split-ledger.ts` |
| Database | `packages/database/src/schema/index.ts` + migration `0018_split_ledger_integrity.sql` |
| Web | `frontend/web/src/components/split-money/` |
| Web client | `frontend/web/src/services/split-money.service.ts` |
| App screens | `frontend/app/src/screens/split-money/` |
| App client | `frontend/app/src/features/split-money/api/` |

All routes are under `/api/v1/split-money/...` (via the gateway). Every query is scoped to the logged-in user.

### Money is integer minor units

`₹787.50` is stored as `78750`. Supported currencies: INR, NPR, PKR, BDT, USD. One currency per expense.

---

## 2. Building blocks

| Thing | Meaning |
| --- | --- |
| **Person** | A contact under your account (no Hisaab login required). |
| **You (self)** | Auto-created; used to compute what you owe / are owed. |
| **Group** | Named set of people with defaults (split method, due days, currency). |
| **Expense** | One shared bill. |
| **Upfront payer** | Who paid the merchant. Separate from later repayments. |
| **Participant** | Who bears a share of the cost. |
| **Obligation** | Deterministic edge: debtor → creditor for amount still owed. |
| **Payment (repayment)** | Manual record that money moved from debtor to creditor. Not a bank transfer by Hisaab. |
| **Adjustment** | Permanent change to one participant’s share (discount, waiver, correction, refund, other). |
| **Reminder** | Scheduled nudge record. In-app reminders are delivered by the recurring worker cron (every 15 min); other channels are not connected. |
| **Receipt** | Attached file; optional OCR on web. |
| **ledger_version** | Optimistic concurrency token; financial mutations bump it. |

---

## 3. Accounting model (source of truth)

The backend computes a ledger for every expense using `computeSplitLedger`:

```
net = upfrontPaid − adjustedShare − absorbed + repaymentSent − repaymentReceived
```

- **Positive net** → this person should receive money.
- **Negative net** → this person owes money.
- Positions always sum to **zero** within the expense currency.
- **Collectible** = total money that must still move between people because of the bill (excludes your own share when you paid the whole bill).
- **Obligations** match debtors to creditors. A person never owes themselves.
- **Progress %** = collected ÷ collectible (not ÷ expense total).

### Example — single payer

Expense ₹1,200. You paid ₹1,200. You, Rahul, Priya each share ₹400.

| | Upfront | Share | Collectible role |
| --- | ---: | ---: | --- |
| You | 1200 | 400 | Receivable 800 |
| Rahul | 0 | 400 | Owes 400 |
| Priya | 0 | 400 | Owes 400 |

Your own ₹400 share is **not** an external debt. External repayment outstanding = ₹800.

### Example — multiple payers

Expense ₹1,200. You paid ₹700, Rahul ₹500, Priya ₹0. Equal shares ₹400.

Before repayments: You +300, Rahul +100, Priya −400.

Obligations:

- Priya → You: ₹300  
- Priya → Rahul: ₹100  

Repayments must name the correct creditor. Paying Rahul more than ₹100 on that edge is rejected (`PAYMENT_EXCEEDS_OBLIGATION`).

---

## 4. People

- **Add** `POST /people` — name required; phone/email/relationship optional. Idempotency-Key supported.
- **List** `GET /people` — self first; optional `includeArchived=1`.
- **Detail** `GET /people/:id` — expenses plus youOwe / youAreOwed from the ledger.
- **Edit** `PATCH /people/:id`.
- **Archive** `DELETE /people/:id` (sets `archived_at`); **restore** `POST /people/:id/restore`.

Web supports fuller create forms; the app create form is name-first (edit on detail).

---

## 5. Groups

- **Create** `POST /groups` — name, optional members, currency, defaults. Self is always owner.
- **Detail** `GET /groups/:id` — members + linked expenses.
- **Members** add/remove via `/groups/:id/members`.
- Removing a member does not delete historical expenses.

Web can pick members at create time. App typically creates by name, then adds members on the detail screen. Creating an expense can attach `groupId` on **both** platforms (members preselected from the group).

---

## 6. Creating an expense (6 steps)

1. Details — title, total, category, date, description  
2. Who paid — one or more upfront contributions (must sum to total)  
3. Split with — people; optional group link  
4. Split method — equal / exact / percentage / shares / item-wise  
5. Due date & reminder — optional; reminder = schedule only  
6. Review & save  

API: `POST /expenses` with Idempotency-Key.

### Server rules

- Payer amounts must equal total.
- No duplicate participants.
- 1–20 payers, 1–50 participants, ≤100 items.
- Split validated via shared Zod + allocators; live preview uses the same helpers as the server.

### Five split methods

| Method | Rule |
| --- | --- |
| Equal | Largest-remainder so shares sum exactly. |
| Exact | Amounts must sum to total. |
| Percentage | Basis points must total 10000 (100%). |
| Shares | Weighted; remainder by largest fractional part. |
| Item-wise | Items assigned to people; tax/tip proportional or tagged. |

After create, expense views include `ledger`, `obligations`, per-person upfront/share/repaid/pending, and youOwe / youAreOwed.

---

## 7. Recording repayments

API: `POST /expenses/:id/payments`.

Required: debtor (`payerPersonId`), creditor (`receiverPersonId`), amount, date, method.

UI (web and app) lists **open obligations** and records against a selected edge. Preview shows remaining on that edge before/after.

**Guarantees:**

- Cancelled expenses reject payments.
- Amount cannot exceed the selected obligation (unless a future explicit overpay workflow is added).
- Idempotency-Key + `request_hash`: same key+payload replays; different payload with same key is rejected.
- Concurrent writes use `ledger_version` so two devices cannot over-settle.

**Copy:** recording a payment means you logged a settlement. Hisaab did not move money at a bank.

### Mark Settled

`POST /expenses/:id/settle` creates repayment rows for **every remaining obligation** in one atomic batch (same version gate). Method defaults to `other`. History keeps each row.

### Void payment

`POST .../payments/:paymentId/void` marks a payment voided without deleting the row (preserves audit trail). The obligation edge is restored and the history row stays visible as `(voided)` with the optional reason.

- Web: "Void" button on a completed repayment in Payment history (confirm + reason prompt).
- Android: long-press the repayment row → confirm.

---

## 8. Statuses

Participant and expense statuses are derived from the ledger (pending / partially paid / paid / overpaid / waived; expense draft / cancelled / settled / overdue / partially settled, etc.). Settlement progress uses **collectible**, not raw expense total.

---

## 9. Adjustments

`POST /expenses/:id/adjustments`.

| Type | Direction |
| --- | --- |
| discount, waived, refund | Always reduce share |
| correction, other | Explicit `direction`: `reduce` or `increase` |

Shortfalls from discounts/waivers are **absorbed** by upfront payers in proportion to what they paid so the ledger stays zero-sum. Adjustments are append-only history.

---

## 10. Editing, cancelling, deleting

- **PATCH** metadata (title, category, description, due date, flags, status). Changing the split after money moved uses guarded replace (`PUT .../split`) with versioning — prefer adjustments for share tweaks.
- **DELETE** is refused if payments or adjustments exist (history must be kept). The UI hides Delete once money history exists; use Cancel expense (reversible via Reopen).
- Soft-delete of people is archive, not hard delete; archived people can be restored.

UI (web header actions / Android action list): Edit details, Publish draft, Cancel expense / Reopen expense, Delete (only without money history). Each asks for confirmation and is disabled while another mutation is in flight.

---

## 11. Reminders

- `POST /expenses/:id/reminders` stores a schedule (channel, `scheduledAt`, optional `every_N_days` frequency, `stopAfterSettlement`). `DELETE .../reminders/:id` cancels it. The wizard's step 5 schedules a due-date reminder automatically when reminders are enabled.
- Responses include `deliveryAvailable` (`true` only for `in_app`), `status`, `sentAt`.
- **Delivery:** the recurring worker cron (`*/15 * * * *`, `backend/recurring/src/jobs/split-reminders.ts`) picks up due `scheduled` reminders:
  - cancels them if the expense is settled/cancelled (or draft with `stopAfterSettlement`);
  - `in_app` → marks `sent` exactly once (conditional UPDATE) and logs a `reminder_sent` activity; recurring frequencies are re-scheduled strictly in the future;
  - any other channel → marks `failed` and logs `reminder_delivery_unavailable` (channel not connected). The UI shows "not delivered (channel not connected)".
- UI copy states that in-app reminders are delivered within ~15 minutes; it never claims email/SMS/WhatsApp delivery.

---

## 12. Receipts & OCR

Upload to R2, attach to expense. Web import can run OCR. Production OCR depends on Workers AI / env. Tests may set `SPLIT_RECEIPT_OCR=mock`. Failures leave the file attached for manual entry.

---

## 13. Dashboard, history, analytics

Dashboard totals come from **all** active (non-draft, non-cancelled) expenses via the ledger — not from a truncated “recent 200” list. Recent lists may be sliced for display only.

Hard-coded month-over-month receive/pay/pending % values were removed (`null`). Settlement % is computed from collectible vs collected.

History distinguishes expense totals, your share, upfront you paid, you owe, you’ll receive, repayments recorded, and outstanding.

---

## 14. Debt simplification & Borrow/Lend

- **Simplify** aggregates open obligations **per currency**, then suggests fewer transfers. Suggestions are stored; they do not auto-pay.
- **Convert to Borrow/Lend** returns **suggestions only**. Auto-creating lend records would double-count the same debt.

---

## 15. Idempotency & concurrency

Financial POSTs accept `Idempotency-Key`. Keys store a hash of the body. Frontend clients (web + app) generate keys for create/pay/settle/adjust. Backend also uses D1 batch updates conditioned on `ledger_version`.

---

## 16. Known limitations (current)

| Topic | Status |
| --- | --- |
| Reminder delivery | In-app only; push/email/SMS/WhatsApp blocked (no channel infrastructure) |
| Production OCR | Environment-dependent (blocked without AI binding) |
| App vs web | Feature parity implemented; app analytics thinner; Android runtime not verified (no emulator) |
| Playwright / device QA | Web e2e 6/6 PASS (desktop + mobile viewport); Android device BLOCKED |
| Migration 0018 on remote D1 | Validated locally; apply before production deploy (needs approval) |

Full matrices: `docs/SPLIT_MONEY_PENDING_WORK.md`, `docs/SPLIT_MONEY_FINAL_QA.md`.

---

## 17. Automated verification (latest executed)

| Suite | Result |
| --- | --- |
| `packages/validation` vitest | 59 passed |
| `backend/finance` vitest (incl. Split Money integration on D1 with migration 0018) | 9 passed |
| `backend/recurring` vitest (incl. split reminder scheduler) | 8 passed |
| `frontend/web` Playwright `e2e/split-money.spec.ts` (chromium + Pixel 5) | 6 passed |
| Finance / recurring lint + dry-run build; web `next build` | clean |
| Web / app / finance / recurring / validation typecheck | clean |
| Android emulator | blocked (no device) |

Property test: 3,000 random expenses — credits equal debts; no self-debt.

---

## 18. Related audit documents

- `docs/SPLIT_MONEY_MASTER_AUDIT.md`
- `docs/SPLIT_MONEY_COMPLETE_AUDIT.md`
- `docs/SPLIT_MONEY_FINANCIAL_FIXES.md`
- `docs/SPLIT_MONEY_FINANCIAL_TEST_CASES.md`
- `docs/SPLIT_MONEY_BUTTON_AUDIT.md`
- `docs/SPLIT_MONEY_GROUP_TESTING.md`
- `docs/SPLIT_MONEY_WEB_APP_PARITY.md`
- `docs/SPLIT_MONEY_PENDING_WORK.md`
- `docs/SPLIT_MONEY_FINAL_QA.md`
