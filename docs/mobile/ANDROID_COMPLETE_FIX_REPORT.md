# Hisaab Android Final Complete-Fix Report

Date: 2026-10-09. Device: NovaPlay_API35, Android 15. A result is WORKING only when the action was performed in the Android UI, the API succeeded, and the screen refreshed. iOS was not tested.

## Overall

Mobile CRUD Status: COMPLETE for backend-supported actions

Feature Status: COMPLETE for those actions

Production Status: NOT_READY

Total Runtime Actions: 92

Working: 84

Partial: 0

Broken: 0

Backend Blocked: 6

Platform Blocked: 1

Unverified: 3

The unverified items are HTTP 403, HTTP 500, and the Terms/Privacy screens. None of those is a failed money action.

## HTTP Error Handling

403: UNVERIFIED_NO_SAFE_TRIGGER. The bank form does not call the catalog-only accounts route, and no signed-in money screen returns 403 without changing production behavior.

409: WORKING. Creating a second Education budget for 2026-10 showed “A budget already exists for this category and month.” The form stayed on New budget with the typed limit. No budget was created.

500: UNVERIFIED_NO_SAFE_TRIGGER. No signed-in route returns 500 without breaking the local gateway.

Timeout: WORKING. With the gateway paused, Refresh on Transactions kept the cached list, showed “Could not refresh. Showing the last loaded transactions.”, and did not show a success. After the gateway resumed, Refresh cleared that line and showed the rows again.

## Duplicate Submit

Transaction: one `QADUPTX` row after a parallel double-tap on Save. Edit of that row to `QADUPEDIT` left one row.

Split Payment: one new ₹1.00 payment on `QAUIEqual`. Pending moved ₹22.34 to ₹21.34.

Adjustment: one new ₹1.00 discount. The older discount stayed the only other adjustment.

Goal: one ₹1.00 contribution. Saved amount became ₹1.00.

Loan: `QA Dup Loan` dropped one EMI, ₹3.00 to ₹2.00, 3 remaining to 2.

Card: used balance dropped ₹200.00 to ₹150.00 and the due date moved one month. A second payment would have dropped it by another ₹50.00.

UPI payment: BLOCKED_BACKEND. The button is hidden.

Status: WORKING. Save, pay, and confirm buttons take a synchronous in-flight lock and ignore the press while pending.

## Offline

Goal: “Could not add contribution / Network request failed.” Saved amount stayed ₹1.00.

Loan: “Could not pay EMI / Network request failed.” Outstanding stayed ₹2.00 and 2 EMIs.

Card: “Could not record payment / Network request failed.” Used stayed ₹150.00 and due stayed 2026-11-20.

Status: WORKING. After airplane mode was turned off, those three values were unchanged. Nothing queued.

## Empty States

Checked on `qa-empty-1791479999@example.com`, then the QA Android user was signed back in.

Budgets: “No budgets. Set a spending limit for this month.” Create budget is on screen.

Goals: “No savings goals. Create a goal to start saving.”

Split Money: ₹0.00 shared, “No shared expenses yet”, “Nothing is due soon.”

Loans: “No loans added. Track EMIs with server-calculated balances.”

Cards: “No cards added.”

Investments: “No investments. Add a holding to track it.”

Home for that user showed ₹0.00 balance, ₹0.00 income, expenses, and net savings, and net worth ₹0.00.

Status: WORKING. No undefined, NaN, Infinity, or blank card.

## Profile Persistence

Force-stop test: language was saved as `hi`, the app was force-stopped, and Profile showed Language `hi` after relaunch.

Result: restored to `en` and theme `system` through Edit profile. The API confirmed both values.

Status: WORKING

## Dashboard Refresh

Mutation used: payment on `QA Dash Card`, minimum due ₹50.00.

Expected: Home net worth increases by ₹50.00. Cash balance and monthly expenses stay put, because this payment is not a cash transaction.

Actual: net worth moved from −₹48,622.91 to −₹48,572.91. Total balance stayed ₹479.09. Income stayed ₹587.00 and expenses stayed ₹126.61. No restart.

Status: WORKING. Home reads cards from the `credit-cards` query, and the payment now invalidates that query.

## Cross-Channel

APP → WEB: the web UI, signed into the same QA user, showed `QADUPEDIT`, `QAUIEqual`, `QA Dash Card`, `QA Emergency`, and `QA Dup Loan`.

WEB → APP: web created expense `WEBQA` for ₹3.33. Android search showed that row and ₹3.33. Web profile save set language `hi`; after relaunch, Android Profile showed `hi`.

The web profile form had no System theme, so that save also stored theme `dark`. Android restored theme `system`. The web form now keeps System instead of replacing it with the live dark theme.

## Performance

Status: WORKING for a short pass.

Issues: none observed. Transaction scrolling and repeated Home, Finance, Split, and Transactions switches each produced a new screen in about 2 seconds. No freeze and no stuck spinner.

## Accessibility

Status: WORKING for the actions used in this pass.

Issues: none fixed as defects. Save, Delete, Pay, Settle, Add, Remove, Export, Confirm, and Cancel are text labels. Primary buttons are 54px tall. Pending, paid, and settled amounts are written in words, not color alone. Edit profile showed Save profile with the fields. Dialog Confirm and Pay stayed reachable.

## Module Final Status

Transactions: COMPLETE

Accounts: COMPLETE

Categories: COMPLETE

Budgets: COMPLETE

Goals: COMPLETE

Recurring: COMPLETE

Split Money: COMPLETE, except receipt upload BLOCKED_BACKEND_STORAGE

Borrow/Lend: COMPLETE for add, view, edit, and delete. Repayment ledger is BLOCKED_BACKEND

Loans: COMPLETE for supported flows. Itemized payment history is BLOCKED_BACKEND

Cards: COMPLETE for supported flows. Itemized payment history is BLOCKED_BACKEND

UPI: COMPLETE for add, view, edit, and delete. Payment is BLOCKED_BACKEND

Investments: COMPLETE

IPO: COMPLETE

Analytics: COMPLETE

Profile: COMPLETE

Settings: COMPLETE

Dashboard: COMPLETE for the populated path and the post-payment refresh

## Bugs Found

1. A failed transaction refresh replaced the list with “Could not load transactions.” The refetch-failure line never rendered, because a refetch error is still an error state.
2. Save and pay could start twice: the pending label updates only after a render, and Add transaction did not check that flag.
3. Home card totals stayed stale after a card payment. The payment screen refreshed `credit-facilities`, while Home reads `credit-cards`.
4. After logout and login, Home still greeted the previous user while showing the new user’s balances. The query cache was not cleared.
5. Saving profile on web replaced theme `system` with `dark`.

## Bugs Fixed

1. Transactions keep the last list when a refresh fails, show the refresh message, and recover on the next Refresh. Retested on device.
2. Money actions use a synchronous single-flight lock and disable the button while pending. Parallel double-taps created one transaction, one edit, one split payment, one adjustment, one contribution, one EMI, and one card payment.
3. Card pay and delete also refresh the Home card query. Net worth moved by the ₹50.00 payment without a restart.
4. Sign-in, sign-out, and the 401 path clear the query cache. A switch to the empty user showed QA Empty and ₹0.00. Switching back showed QA Android and ₹475.76.
5. The web profile theme control includes System and no longer copies the live theme over the saved value. Android restored `en` and `system`.

## Remaining Mobile Code Issues

1. HTTP 403 has no safe signed-in trigger.
2. HTTP 500 has no safe trigger.
3. Terms and Privacy are listed on Profile and were not opened in this pass.

## Backend Blockers

- Receipt and attachment binary storage. The app must not send a local Android URI as a remote file URL.
- OCR
- Transaction tags
- Borrow/Lend repayment ledger, history, and reminders
- UPI facility payment. The API returns that only credit cards can be marked paid.
- Separate loan and card itemized payment-history APIs

## Platform Blockers

- Native premium billing: Google Play Billing, server receipt verification, and entitlement checks. Purchases are not faked.

## Release Blockers

- Production native auth and device-session architecture. QA login, logout, session restore, and the 401 return to Login work. That does not finish the production session design.

## Verification

TypeScript: PASS (`pnpm --filter @hisaab/app typecheck`)

Validation: PASS, 39 tests

Diff: PASS (`git diff --check`)

Gateway: not re-run. Gateway source was not changed in this pass.

Expo: PASS. Android Hermes bundle `/tmp/hisaab-android-export/_expo/static/js/android/index-43a02485a44400e2b006b35e46131663.hbc`

Android emulator: NovaPlay_API35. The flows in this report were driven on the device after the fixes.

## Final Decision

MOBILE CRUD: COMPLETE

FEATURE STATUS: COMPLETE

PRODUCTION: NOT_READY
