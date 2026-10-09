# Hisaab Final Remaining Closure Report

Date: 2026-10-09. Android emulator `NovaPlay_API35` (Android 15) in Expo Go against the local gateway (`http://10.0.2.2:8787`) with migrations 0016 and 0017 applied to local D1. QA account `qa-android-1791473366@example.com`. Disposable records were tagged `CL38679`. iOS, Google Play Billing, and production native auth were out of scope.

## Borrow/Lend Reminders

- Persistence: migration `0017_lend_reminders.sql` adds `lend_reminders` (one per lend record; `enabled`, `remind_at`, `frequency` ONCE/DAILY/WEEKLY/BEFORE_DUE, `last_sent_at`, `next_run_at`) and `lend_reminder_deliveries` (unique `reminder_id + slot + channel`).
- API: `GET`, `PUT`, `DELETE /api/v1/lend-records/:id/reminder`. Invalid date 400, unsupported frequency 400, settled record 409 `REMINDER_SETTLED`, deleted record 404, other user 404, delete 204.
- Scheduler: the existing `hisaab-recurring` cron (`*/15 * * * *`) now runs `processLendReminders` alongside recurring transactions. No second scheduler.
- Delivery: an `in_app` notice row is written for each due slot. A cron retry in the same slot inserts nothing because of the unique key. Settled records are disabled and skipped. ONCE and BEFORE_DUE disable after sending, while DAILY and WEEKLY move `next_run_at` forward.
- Android: "Set one-time reminder" on lend detail saved a reminder. Two local cron runs (`/__scheduled`) produced exactly one notice, and the detail screen then showed "Reminder surfaced … via in_app". A settled record showed "Settled records do not send reminders."
- Email and push: DELIVERY_CHANNEL_BLOCKED. Resend is bound only to the auth worker and there is no push integration. The notice is visible only on the lend detail screen. There is no system notification or inbox.

Status: COMPLETE for scheduled in-app surfacing. Email and push delivery remain blocked.

## Production Migration

- Remote D1 `hisaab` (`ec0df364-b3f9-4214-975f-7e75c9cba14f`): `migrations list --remote` showed only 0016 pending. It was applied with the repo convention `wrangler d1 migrations apply hisaab --remote` after an approval prompt (21 commands, success).
- Read-only verification: `stored_files`, `transaction_attachments`, `lend_repayments`, `loan_payments`, `facility_payments`, `idempotency_keys`, `split_receipts.file_id`, `split_receipts.description`, and `tags.normalized_name` are present.
- 0017: applied locally only. The remote list shows it pending.
- R2: `wrangler r2 bucket list` shows no `hisaab-files` bucket on the account.
- Workers: the last `hisaab-finance` deployment is from 2026-09-03, so production runs none of the file, OCR, ledger, or reminder code.
- AI: the binding is declared in `backend/finance/wrangler.jsonc` and is not deployed.

Required production steps (not executed; they mutate production):

```bash
cd backend/finance
pnpm exec wrangler r2 bucket create hisaab-files
pnpm exec wrangler d1 migrations apply hisaab --remote   # applies 0017
# then deploy finance, transactions, recurring, gateway with the repo's deploy scripts
```

Status: 0016 MIGRATED. Production is not deployable as-is until the bucket exists and the workers are deployed.

## Receipt Upload (Android, split expense `Receipt CL38679`)

| Path | Result |
|---|---|
| Gallery | System photo picker → JPEG uploaded → attached → listed as `1000000236.jpg` |
| Camera | Denied permission → "Camera permission is required." Allowed once → emulator camera capture → uploaded and attached |
| Document | `qa-receipt.pdf` from the document picker → uploaded and attached |
| Invalid type | A text file named `.jpg` → server 400 "Upload a JPEG, PNG, or PDF." No row added |
| Remove | "Receipt removed". The list refreshed and the API detail lists two receipts |
| File lifecycle | The removed file stays readable until `DELETE /api/v1/files/:id` (204). A still-linked file returns 409 `FILE_IN_USE`, matching the contract |
| Offline | "Network request failed". No row added |

An oversized (>8 MB) file was not produced on the device. The 8 MB limit is enforced by the gateway and storage code.

## OCR

- License: Workers AI returns error 5016. The account must accept the Llama 3.2 community license for `@cf/meta/llama-3.2-11b-vision-instruct`. This was not accepted programmatically. Manual step: the account owner submits the prompt `agree` to that model once (Cloudflare dashboard → Workers AI → model playground for `llama-3.2-11b-vision-instruct`), which accepts the license and confirms non-EU domicile.
- Backend: license error 5016 now maps to 503 `OCR_UNAVAILABLE` with "Receipt scanning is not enabled for this account yet. Enter the details manually." Other provider failures stay 502 `OCR_PROVIDER_FAILED` or `OCR_TIMEOUT`. PDF 400, missing or foreign file 404.
- Android: Scan receipt shows "Scanning…" and then the unavailable message. There is no crash and nothing is saved. The editable suggestion form (merchant, date, total, currency, tax) and explicit local confirm are wired and do not create transactions. They have not been shown with real provider data.

Status: contract COMPLETE. Live extraction and the confirmation form with real data are BLOCKED on the license.

## Borrow/Lend Repayment (Android, `Repay CL38679`, principal ₹1,000)

| Step | Result |
|---|---|
| ₹400 (double tap) | Repaid ₹400, remaining ₹600, `PARTIALLY_REPAID`, one row |
| ₹300 | Repaid ₹700, remaining ₹300 |
| ₹300 | Repaid ₹1,000, remaining ₹0, `REPAID`, header `SETTLED` |
| ₹50 overpay | Remaining −₹50, `OVERPAID` |
| History | Four dated rows (400, 300, 300, 50). They survive back and reopen. The API shows principal 100000 minor unchanged |
| Offline | "Network request failed". `totalRepaidMinor` was still 0 after reconnecting |

Defect fixed: Hermes has no global `crypto`, so `crypto.randomUUID()` crashed lend detail and would have broken every idempotency key. The app now uses `expo-crypto` `randomUUID`.

## Loan Payment History (Android, `Loan CL38679`)

Pay next EMI moved ₹300 to ₹200, 2 of 3 pending, and the next due date from 2026-11-05 to 2026-12-05. History shows `#1 · 2026-10-09 · ₹100.00 · EMI` from `GET /loans/:id/payments`.

## Card Payment History (Android, `Card CL38679`)

Record payment moved used from ₹1,500 to ₹1,200 and the due date to 2026-11-28. History shows `2026-10-09 · ₹300.00 · CARD · statement 2026-10-28`.

## UPI Payment (Android, `UPI CL38679`)

The Record payment button is shown for UPI again. A double tap on the button and on CONFIRM moved used from ₹2,000 to ₹1,500 and the due date from 2026-10-25 to 2026-11-25, and the API shows exactly one `UPI` ledger row. A second payment in the same cycle showed "This due is already marked paid for this cycle." The UPI list refreshed to ₹3,500 available. Offline showed "Network request failed" and the row count stayed at one.

## Transaction Attachments (Android, `QADUPEDIT`)

Transaction detail now lists attachments with Remove, and attaching is single-flight. PNG, PDF, and JPEG were attached, and the API shows the matching MIME types. Removing the PDF refreshed the list. Offline showed "Could not attach / Network request failed" and nothing persisted. A double tap on Attach file opened one picker and added one attachment.

## Transaction Tags (Android)

- The edit form has free-text tags plus chips for existing tags.
- Assigning `QAClose` and `Travel` created both, and detail showed them.
- Toggling `#QAClose` unassigned it. Adding `  TRAVEL ` resolved to the existing Travel tag: one tag, no duplicate, and the account still has two tags.
- The transaction list has tag filter chips. `#Travel` shows QADUPEDIT, while `#QAClose` shows "No transactions yet".

## Security (local gateway, fresh second user)

Assigning another user's tag, attaching another user's file as a receipt, reading another user's file, expense, lend history, UPI, card, or loan history, or transaction attachments, repaying another user's lend, running OCR on another user's file, and reading another user's reminder all return 404.

## Web Parity

Web uses the same services (`finance.service.ts`, `split-money.service.ts`) and contracts. Card and UPI pay and receipt upload with fileId and scan are in the UI. Web screens do not yet show loan, card, or UPI payment history, lend repayments or reminders, transaction tags, or attachments. Web `tsc` and `next build` pass.

## Verification

- Validation 40, worker-lib 10, gateway 13, finance 4, transactions 7, recurring 3, and all other backend packages pass.
- Finance, transactions, recurring, gateway, and api `tsc` pass.
- App typecheck, web typecheck, and web build pass.
- `git diff --check` is clean.
- Expo Android export: `/tmp/hisaab-export`, 8.6 MB.
