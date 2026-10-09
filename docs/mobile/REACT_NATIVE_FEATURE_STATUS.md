# Hisaab React Native feature status

Date: 2026-10-08

This file records what was implemented and what was actually opened on the Android emulator `NovaPlay_API35`. iOS was not tested.

Overall:

| Area | Status |
|---|---|
| Feature implementation | Supported Android CRUD and payments are COMPLETE. See `ANDROID_COMPLETE_FIX_REPORT.md` (2026-10-09). |
| Android runtime | Backend-supported actions were performed on NovaPlay_API35. On 2026-10-09 UPI payment, receipt upload, attachments, tags, lend repayments and reminders, and loan, card, and UPI history were also executed. Live OCR extraction is blocked on the Workers AI license. |
| Cross-channel | 2026-10-09 web UI showed Android-created transaction, split, card, goal, and loan. Web-created `WEBQA` and language `hi` appeared on Android. Language was restored to `en` and theme to `system`. |
| Production release | Not ready |

Details of that run are in `docs/mobile/FINAL_PARITY_REPORT.md`.

## Done

These modules have dedicated screens, navigation, and API service calls.

| Feature | What is in the app |
|---|---|
| Auth | Welcome, login, register, email code, forgot password, reset password |
| Dashboard | Home summary from `/api/v1/dashboard/summary` |
| Transactions | List, search, filters, sort, pagination, create, detail, edit, delete, transfer destination, CSV export to a temp file and share sheet |
| Accounts / Bank | List, bank create, detail, update, archive |
| Categories | List, create, edit, delete |
| Budgets | List, create, detail, edit, delete |
| Savings goals | List, create, detail, edit, contribution, contribution history |
| Recurring / bills | List, create, detail, edit, pause, resume, delete, history. Home notifications open this screen |
| Borrow / Lend | List, create, detail, edit, delete, repayments with history, one-time in-app reminder |
| Loans / EMI | List, create, detail, edit, delete, schedule, pay next EMI, payment history |
| Credit cards | List, create, detail, edit, delete, pay, payment history |
| UPI credit | List, create, detail, edit, delete, pay, payment history |
| Investments | List, create, detail, edit, delete |
| IPO | List, create, detail, edit, delete, upcoming feed |
| Analytics / reports | Daily summary, monthly, category, and account report screens, CSV export |
| Split Money | Home, create (equal, exact, percentage, shares, item-wise, multiple payer), expense detail, payment, settlement, adjustment, people list/detail/edit, groups list/detail/edit, member add/remove, history |
| Profile | View and edit profile |
| Settings | Currency, timezone, language, and related profile preferences |
| Legal | Terms and Privacy screens |
| Native helpers | SecureStore session cookie, image picker, camera picker, document picker, file share |

Tabs: Home, Finance, Split Money, Transactions, Profile. Finance opens the dedicated screens above. AI Coach is the only Finance tile that still opens the generic feature screen.

Checks that passed on this machine:

- `pnpm --filter @hisaab/app typecheck`
- `pnpm --filter @hisaab/validation test` — 39 tests
- `git diff --check`
- Expo SDK 54 config
- Android and iOS JavaScript bundle export

## Pending

These were not proven on this closure pass. Do not treat them as passed.

| Item | Why it is pending |
|---|---|
| Split methods other than equal | The create wizard opened and equal ₹100 / 3 was saved from the UI. Exact, percentage, shares, item-wise, and multiple-payer steps were visible as choices and were not driven through to save |
| Split settle-all and a second partial payment | One ₹10 partial payment and one ₹1 discount were saved. Settle all was not tapped |
| Finance create/edit/delete/pay on device | Categories, goals, recurring, borrow/lend, loans, cards, UPI, investments, IPO, and accounts lists opened without a crash. Add, edit, delete, schedule, and pay were not submitted on this pass. Budgets already had a full UI create/edit/delete pass |
| Analytics drill-down and CSV | Overview now matches the dashboard after the date-range fix. Monthly, category, account, and export were not opened |
| Transaction pagination, sort chips, filter chips, transfer form | Core create/edit/delete, search, and CSV share passed earlier. Those remaining controls were not tapped on this pass |
| Profile valid save and settings toggles | Invalid currency `INRXXX` was rejected and the form stayed filled. A new valid save, leave/return, and the settings switches were not repeated |
| Empty dashboard variants | Populated home passed. A second empty user was not created |
| HTTP 403, 409, 500, timeout, and offline payments | Not forced inside the app. Offline transaction save already showed a network error |
| 401 signed-in UI reset | `notifyUnauthorized` now clears in-memory session state. The running app was not forced through a 401 after that change |
| Share cancel cleanup | Share success passed earlier. Cancel versus error cannot be separated from the Android share sheet in this run |
| Post-fix web UI | Login page hung. API records from the Android session are still present |
| iOS | Out of scope |
| Production auth | Device-session architecture is still a release blocker |
| AI Coach | No audited backend API. Tile still opens the generic feature screen |
| Premium purchase | Screen exists. Store billing is not implemented |
| Live OCR extraction | Workers AI requires the Llama 3.2 license acceptance. The app shows the unavailable message |
| Reminder email and push | Only in-app notices are surfaced. No push service, and Resend is bound to auth only |
| OCR confirmation form with real extracted values | Built on Android and web. It cannot be exercised live until the Workers AI license is accepted. Only the unavailable state ran |

## Blocked

| Blocker | Kind |
|---|---|
| OCR model license (manual Cloudflare step) | Platform |
| R2 bucket `hisaab-files`, migration 0017, and worker deploy in production | Release |
| Native premium billing | Platform |
| Production native auth and device session | Release |

## Decision

2026-10-09 frontend pass: the new backend capabilities are wired and were exercised on Android and web; see the section above. Android feature status is **PARTIAL**. The important screens open, and the defects found on Split create, person detail, and Analytics were fixed and rechecked on the emulator. Production status remains **not ready** because device-session auth, native billing, and the storage backends are still missing, and several finance mutations were not driven on the device.

## 2026-10-09 frontend completion pass

Done on Android (NovaPlay_API35, real gateway) and on web:

- Split receipts: source chooser, file type, upload and attach status, remove confirmation (the file is kept), scanning offered only for JPEG/PNG, editable OCR suggestion (merchant, date, total, currency, tax, items, confidence). Confirm never creates a transaction. “Create transaction from these values” opens Add Transaction prefilled. Live OCR is blocked by the license.
- Transaction attachments: add, open via an authenticated download and the share sheet, remove with confirmation, friendly errors.
- Transaction tags: a shared `TagPicker` on create and edit, normalized duplicate handling, server 409 handling (the draft is kept), chips on detail, tags on list rows, filter.
- Borrow/Lend: repayment form (amount, paid date, note), principal/repaid/remaining, Pending / Partially repaid / Repaid / Overpaid as text, newest-first history, reminder controls (enabled, date, time, frequency, save, update, turn off). Copy says delivery is in-app only.
- Loan, card, and UPI history: newest-first cards with empty states. The UPI/card pay confirmation shows amount, used balance, and due date.
- Error mapping: FILE_IN_USE, TAG_EXISTS, OCR_UNAVAILABLE, OCR_PROVIDER_FAILED, OCR_TIMEOUT, OCR_UNSUPPORTED, upload size/type, NOT_FOUND, and network errors. Raw stack text is never shown.
- Fixed in this pass: Android attachment open returned 401 because the native downloader dropped the cookie (now uses authenticated `fetch`). The web gateway CORS rejected `Idempotency-Key` and `PUT`. The web lend list showed a negative remaining amount for overpaid records. The camera denied message did not distinguish a permanent denial.

Expo Go quirk: Expo Go asks its own per-project camera prompt after an OS-level grant. Dismissing that prompt with Back leaves the picker waiting until the app is relaunched. This does not apply to a standalone build.
