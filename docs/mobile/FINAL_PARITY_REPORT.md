# Hisaab Android + Web Final QA Report

Date: 2026-10-08

Environment: Android emulator `NovaPlay_API35` (Android 15), Expo on `http://10.0.2.2:8787`, local gateway `http://localhost:8787`, local web `http://localhost:3000`. iOS was not tested.

## Overall

| Decision | Status |
|---|---|
| Feature status | COMPLETE for supported Android actions. See `ANDROID_COMPLETE_FIX_REPORT.md` (2026-10-09). |
| Production status | NOT_READY |

2026-10-09 targeted closure: receipt upload (gallery, camera, PDF), attachments, tags, lend repayments and in-app reminder, loan, card, and UPI payment history, and UPI payment were executed on Android. Production D1 has 0016. See `FINAL_REMAINING_CLOSURE.md`.

The closure pass opened Split and every finance list on the emulator. Transactions and budgets are the modules marked COMPLETE. Split, analytics, and person detail had runtime defects that were fixed and rechecked. Exact/percentage/shares/item-wise/multi-payer create, finance pay/edit/delete, empty states, 403/409/500/timeout, and the 401 UI reset were not driven. Production auth remains a release blocker.

## Closure pass

| Check | Result |
|---|---|
| Split home | PASS — ₹650.00 shared, 18% settled, owed ₹216.66, no NaN |
| Split create empty amount | FIXED — `majorToMinor("")` threw during render. Empty amounts now stay at 0 |
| Equal ₹100 / 3 from the UI | PASS — `QAUIEqual`, shares ₹33.34 / ₹33.33 / ₹33.33, payer You ₹100.00 |
| Partial payment and discount | PASS — ₹10 payment, then ₹1 discount. Pending ₹33.34 → ₹23.34 → ₹22.34. Live preview updated before confirm |
| Person detail | FIXED — API returns `{ person, balances }`. Screen now shows the name and owed/owe amounts |
| Group add and remove | PASS — added and removed `QA Rohan` on `QA Trip Edited` |
| Finance lists | PASS open — categories, budgets, goals, bills, lend, loans, cards, UPI, investments, IPO, accounts |
| Analytics | FIXED — date-only range returned zeros. ISO datetimes show income ₹587.00, expenses ₹125.50, net ₹461.50 |
| Invalid currency | PASS — `INRXXX` rejected, form kept, no success alert |
| Post-fix web UI | UNVERIFIED — `/login` hung. API still has `QAUIEqual`, `QA Emergency`, INR, Asia/Kolkata |
| TypeScript | PASS |
| Validation | PASS — 39 tests |
| `git diff --check` | PASS |
| Expo Android export | PASS — `/tmp/hisaab-android-export` |

## Defect fixed

React Native fetch sends `Sec-Fetch-Site: none` without an Origin header. Better Auth rejected sign-in with `Missing or null Origin`, so the emulator could not log in. The gateway now supplies `Origin: hisaab://app` for Android and iOS clients that omit Origin, and auth trusts the `hisaab://` scheme. A browser request still cannot replace its own Origin with that scheme. After the fix, Android login, session restore, and logout succeeded.

## Executed

| Check | Result |
|---|---|
| Android launch and login | PASS |
| Session restore after force-stop | PASS |
| Logout | PASS |
| Home API data, no NaN | PASS — income ₹510.00, expenses ₹125.50, net ₹384.50 |
| App UI expense create, visible on web | PASS — `QA-APP-EXPENSE` |
| Web create visible on Android | PASS — `QA-WEB-INCOME` |
| Transfer visible on Android | PASS — `QA-APP-XFER` ₹35.00 |
| Edited income visible on web | PASS — `QA-APP-INCOME-EDITED` |
| Deleted expense absent on web | PASS — `QA-APP-EXP2` |
| CSV export and Android share sheet | PASS — `hisaab-transactions-2026-10-08.csv` |
| Offline save | PASS — `Could not save` / `Network request failed`, no success |
| Split allocation API plus web title | PASS for API rules; Android Split UI not opened |
| Finance API creates | PASS for budget, goal, recurring, lend, investment, IPO, loan, card, UPI |
| Web UI for goal and investment | PASS |
| TypeScript, validation (39), gateway CSRF (10), diff check | PASS |

## Not executed

- Android pagination, sort-chip cycling, and in-app edit/delete dialogs
- Android screens for Split, budgets, goals, loans, cards, UPI, IPO, lend, and analytics
- Camera, gallery, and document picker — executed later on 2026-10-09 (see `FINAL_REMAINING_CLOSURE.md`)
- HTTP 403, 409, 500, and timeout inside the app UI
- The 401 in-memory session bug was not reproduced in the UI this run
- iOS

## Frontend completion pass (2026-10-09)

Android frontend for receipts, attachments, tags, repayments, reminders, and loan/card/UPI history is complete and was executed on NovaPlay_API35. Web parity was built for the same features and runtime-checked in the browser against the same backend data in both directions (app to web and web to app).

Verification: app typecheck, web typecheck, web tests (10), gateway tests (14, including the new CORS case), `git diff --check`, `next build --webpack`, and the Expo Android export all passed. Web ESLint could not run because the existing config needs `eslint-plugin-import`, which is not installed. The app has no test script.

Still blocked: live OCR (license), production R2 bucket, migration 0017 and worker deploy, reminder email/push, Play Billing, and production native auth. iOS was not tested.
