# Hisaab Backend Blocker Closure Report

Date: 2026-10-09

Canonical routes stay under `/api/v1/*`. There is no `/mobile/*` surface. Mobile headers `X-Sales-Channel`, `X-Client-Platform`, and `X-App-Version` are unchanged. Private files are not stored in D1 and are not served from a public bucket URL.

## File Storage

Schema: `stored_files` (`id`, `user_id`, `storage_key`, `original_name`, `mime_type`, `size_bytes`, `created_at`). Object bytes go to the R2 binding `FILES` (`hisaab-files`) on the finance worker.

API:

- `POST /api/v1/files` multipart field `file`
- `GET /api/v1/files/:id` authenticated download
- `DELETE /api/v1/files/:id`

Accepted types are JPEG, PNG, and PDF, matched on magic bytes as well as the declared MIME type. Maximum size is 8 MB. The object key is `users/{userId}/files/{uuid}.ext`. The original filename is metadata only.

Security: reads and deletes require `stored_files.user_id` to match the session. A missing row and another user's row both return 404 `NOT_FOUND`. Download sets `content-disposition: attachment` and `cache-control: private, no-store`. Delete returns 409 `FILE_IN_USE` while a split receipt or transaction attachment still references the file.

Tests: `detectUploadMime` covers JPEG, PNG, PDF, a MIME mismatch, and an unsupported type.

Status: COMPLETE. Local migration `0016` is applied, and a JPEG upload plus owner download succeeded on the restarted local gateway.

## Split Receipts

API:

- `POST /api/v1/split-money/expenses/:expenseId/receipts` with `{ fileId, description? }`
- Expense detail includes `receipts`
- `DELETE /api/v1/split-money/expenses/:expenseId/receipts/:receiptId`
- Legacy `POST /api/v1/split-money/receipts` still accepts a remote `fileUrl`, or a `fileId`. `file:`, `content:`, `blob:`, and `data:` URLs are rejected.

`fileUrl` stored for an uploaded file is the authenticated path `/api/v1/files/{id}`, not a bucket URL. Attaching a file does not run OCR and does not create a transaction.

Mobile: Split expense screen picks an image, uploads it, attaches `fileId`, then offers a separate scan. Web receipt import uploads the real `File` the same way and no longer sends `local://` placeholders.

Status: COMPLETE

## Transaction Attachments

API:

- `POST /api/v1/transactions/:id/attachments` with `{ fileId }`
- `GET /api/v1/transactions/:id/attachments`
- `DELETE /api/v1/transactions/:id/attachments/:attachmentId`

The file must belong to the same user as the transaction. Removing an attachment does not delete the object; `DELETE /api/v1/files/:id` does that after the link is gone.

Mobile: transaction detail can pick a document, upload it, and attach the returned `fileId`. The transactions list and detail now return tag names from the server.

Status: COMPLETE for the contract. The attach flow was not executed on a device in this session.

## OCR

Provider: Cloudflare Workers AI `@cf/meta/llama-3.2-11b-vision-instruct` through the finance worker `AI` binding. If `AI` or `FILES` is absent, the route returns 503 `OCR_UNAVAILABLE`. It does not call the old mock parser and does not invent merchant, date, or amounts.

API: `POST /api/v1/ocr/receipt` with `{ fileId }`. The handler checks ownership, reads the object, and returns nullable `merchant`, `date`, `totalMinor`, `currency`, `taxMinor`, `items`, `confidence`, and `detected`. PDF returns 400 `OCR_UNSUPPORTED`. Provider failure returns 502 `OCR_PROVIDER_FAILED`. Timeout returns 502 `OCR_TIMEOUT`. A malformed model payload normalizes to null fields and `detected: false`.

The result is not written as a financial transaction. Web and Android show it as an editable suggestion. The user still confirms before an expense or transaction is saved.

Tests: `normalizeReceiptExtraction` covers a partial receipt, a non-object payload, and dropped invalid totals and items.

Status: COMPLETE for the contract. A live call on 2026-10-09 reached Workers AI and returned 502 `OCR_PROVIDER_FAILED` with `merchant: null`. Cloudflare requires the account owner to submit the Llama 3.2 community-license prompt `agree` before this model will run. That acceptance was not submitted from this session. The response did not invent receipt fields.

## Transaction Tags

Schema: existing `tags` and `transaction_tags`. Migration adds `normalized_name` and unique `(user_id, normalized_name)`. Deleting a tag cascades `transaction_tags` only.

API:

- `GET /api/v1/tags`
- `POST /api/v1/tags`
- `PATCH /api/v1/tags/:id`
- `DELETE /api/v1/tags/:id`
- Transaction create and edit accept `tags` (names) and `tagIds`
- List and detail return `tags`
- `GET /api/v1/transactions?tag=` filters on the normalized name

A duplicate normalized name on create or rename returns 409 `TAG_EXISTS`. A `tagId` owned by someone else is 404 `NOT_FOUND`.

Web: no separate tag manager was added. Transaction payloads already share the validation schema, and list responses now include tags.

Mobile: create and edit still send comma-separated names. Detail shows the names returned by the API.

Status: COMPLETE

## Borrow/Lend Repayments

Schema: `lend_repayments` (`id`, `lend_record_id`, `user_id`, `amount_minor`, `paid_at`, `note`, `created_at`). Principal on `lend_records.amount_minor` is not overwritten.

API:

- `POST /api/v1/lend-records/:id/repayments`
- `GET /api/v1/lend-records/:id/repayments`

The server returns `principalMinor` (the original amount), `totalRepaidMinor`, `remainingMinor`, and `repaymentStatus` of `PENDING`, `PARTIALLY_REPAID`, `REPAID`, or `OVERPAID`. Stored `status` stays in the existing set: `pending`, `due`, or `settled`. Overpayment is kept in the ledger; remaining may be negative and status becomes `settled`. Repayment rows are insert-only. There is no silent edit.

History is the `items` array from the repayments endpoint, not a reconstruction from the current balance.

Mobile: record a repayment amount and list history on the borrow/lend detail. Web list totals use `remainingMinor` when the API sends it.

Reminder delivery: there is no borrow/lend scheduler or sender. Reminder delivery stays blocked. The Android screen says that explicitly.

Status: COMPLETE for the ledger. Reminder delivery remains blocked.

## Loan Payment History

Schema: `loan_payments` (`id`, `loan_id`, `user_id`, `installment_number`, `amount_minor`, `paid_at`, `payment_type`, `created_at`). `payment_type` is `EMI`.

API: existing `POST /api/v1/loans/:id/pay`, plus `GET /api/v1/loans/:id/payments`.

The balance update and the history insert run in one D1 batch with the idempotency row. A failed batch does not return success. `Idempotency-Key` replays the stored response instead of posting a second EMI.

Mobile: loan detail lists persisted payments. Web service exposes `listLoanPayments` and sends an idempotency key on pay.

Status: COMPLETE

## Card Payment History

Schema: shared `facility_payments` for both facility kinds, not a second card-only store. Columns include `credit_facility_id`, `user_id`, `amount_minor`, `paid_at`, `statement_period`, `kind`, `created_at`.

API: existing `POST /api/v1/credit-facilities/:id/pay`, plus `GET /api/v1/credit-facilities/:id/payments`. Card and UPI stay on this resource so web and mobile do not gain a parallel `/credit-cards` or `/upi-credit` API.

Payment amount, used balance, overdue, last paid date, and next due date update in the same batch as the ledger insert. `Idempotency-Key` applies.

Mobile: card detail lists payments. Web service exposes `listFacilityPayments`.

Status: COMPLETE

## UPI Payment

Schema: the same `facility_payments` row with `kind = 'UPI'`.

API: `POST /api/v1/credit-facilities/:id/pay` no longer returns `NOT_A_CARD`. UPI uses the same due rules as cards: nothing due, already paid this cycle (`FACILITY_PAID`), then reduce used balance, clear overdue, advance due date, and insert history. `GET /api/v1/credit-facilities/:id/payments` returns that history.

Mobile: UPI credit detail shows Record payment. Web uses the same pay method.

Status: COMPLETE for the shared facility contract. The payment was not executed on a device in this session.

## Authorization / 403

Tests: a two-user session against the local gateway returned 404 `NOT_FOUND` for another user's tag update, lend repayment, repayment history, loan payment history, UPI payment history, file download, and OCR request. The owner received 200 or 201 for the same resources. Worker-lib tests still cover the 403 `FORBIDDEN` body used by explicit permission failures such as CSRF.

Status: COMPLETE. Cross-user resource access uses 404 so the resource is not disclosed. There is no route whose only purpose is to return 403.

## 500 Handling

Tests: `errors.test.ts` throws an unexpected `Error` with a sensitive message. The response is 500 `{ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }` and the JSON body does not contain the thrown message or a stack.

Status: COMPLETE. There is no production route whose job is to throw.

## Terms / Privacy

Android: opened on emulator `emulator-5554` while signed in as QA Android.

- Profile → Terms of Service showed “Hisaab helps you record and understand personal finances.” Back returned to Profile.
- Profile → Privacy Policy showed “Hisaab processes account and financial information needed to calculate balances, budgets, and reports.” Back returned to Profile.

The Support row “Terms & Privacy” now opens Terms as well. Settings already had working Terms and Privacy rows.

Status: COMPLETE

## Migrations

- `packages/database/migrations/0016_files_ledgers_tags.sql`
- Journal entry `0016_files_ledgers_tags`
- Applied to the local D1 at `.wrangler/state` (21 statements, success)
- Applied to remote D1 `hisaab` (`ec0df364-…`) on 2026-10-09 with `wrangler d1 migrations apply hisaab --remote`. All listed tables and columns were verified read-only
- `0017_lend_reminders.sql`: local only, remote pending

Tables and columns: `stored_files`, `transaction_attachments`, `split_receipts.file_id`, `split_receipts.description`, `tags.normalized_name`, `lend_repayments`, `loan_payments`, `facility_payments`, `idempotency_keys`.

## Shared Types

`packages/types`: `StoredFile`, `TransactionAttachment`, `Tag`, `OcrReceiptResult`, `LendRepayment`, `LoanPayment`, `FacilityPayment`, `RepaymentStatus`, transaction `tagIds`, lend `totalRepaidMinor` / `remainingMinor` / `repaymentStatus`, split `receipts`.

## Validation

`packages/validation`: upload MIME detection, tag create, `fileId` attach, OCR request, lend repayment, `normalizeReceiptExtraction`, `lendRepaymentPosition`. Split receipt schema accepts `fileId` or `fileUrl`. Transaction schema accepts `tagIds` and query `tag`.

## Verification

Backend tests: accounts, auth, budgets, categories, finance, gateway, profile, recurring, reports, and transactions passed.

Validation tests: 40 passed (`@hisaab/validation`).

Gateway tests: 13 passed.

Worker-lib tests: 10 passed, including 403, 404, and 500.

Local gateway checks on 2026-10-09, two fresh users:

- Tag create 201, duplicate normalized name 409 `TAG_EXISTS`, other user patch 404
- Lend partial repayment remaining 600 `PARTIALLY_REPAID`, final remaining 0 `REPAID` with principal still 1000, overpayment remaining -50 `OVERPAID`, three history rows, other user 404
- Loan EMI pay remaining 2, same `Idempotency-Key` replay stayed at 2, one history row of 100 minor, other user 404
- UPI pay reduced used balance 2000 → 1500, replay kept 1500, one `UPI` history row, other user 404
- JPEG upload 201, owner download 200 `image/jpeg`, other user 404
- OCR 502 `OCR_PROVIDER_FAILED`, other user's file 404

App typecheck: passed.

Web verification: `tsc --noEmit` passed and `next build` passed.

API package typecheck: passed.

Diff: `git diff --check` passed.

Local migration: `0016_files_ledgers_tags.sql` applied.

## Remaining Backend Blockers

- Reminder email and push: DELIVERY_CHANNEL_BLOCKED. In-app reminders are surfaced by the existing recurring cron (see `FINAL_REMAINING_CLOSURE.md`).
- Workers AI receipt extraction is blocked until the Cloudflare account accepts the Llama 3.2 community license. The license error now returns 503 `OCR_UNAVAILABLE`.
- Production: R2 bucket `hisaab-files` does not exist, 0017 is not applied remotely, and the workers were last deployed 2026-09-03.

## Remaining Platform Blockers

- Superseded on 2026-10-09: receipt upload, repayment, and UPI payment were driven on Android. The OCR confirmation form still awaits the provider license.

## Remaining Release Blockers

- Production native auth and device-session architecture.
- Google Play Billing.

## Final Decision

BACKEND FEATURE STATUS: PARTIAL

Persisted files, receipts, attachments, tags, repayment ledger, in-app lend reminders, and loan, card, and UPI payment history work on the local gateway. Licensed OCR extraction and reminder email/push are not done.

ANDROID FEATURE STATUS: PARTIAL

Terms and Privacy, receipt upload, attachments, tags, repayments, reminders, and loan, card, and UPI payments and history were exercised on the emulator on 2026-10-09. OCR suggestion editing awaits the license.

PRODUCTION STATUS: NOT_READY
