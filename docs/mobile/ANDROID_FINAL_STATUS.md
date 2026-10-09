# Hisaab Android Final Status

Superseded for the 2026-10-09 complete-fix pass by `docs/mobile/ANDROID_COMPLETE_FIX_REPORT.md`. The sections below are the earlier runtime record.

Device: NovaPlay_API35 (Android 15). Status is based on actions performed in the Android UI. Code existence alone is not treated as working.

## Overall

| | |
|---|---|
| Actions tested on Android | 70 |
| Working | 62 |
| Partial | 3 |
| Broken | 0 |
| Backend blocked | 6 |
| Platform / release blocked | 2 |
| Unverified | 6 |

- Mobile CRUD / actions: **PARTIAL**
- Feature status: **PARTIAL**
- Production: **NOT_READY**

Backend-supported create, view, edit, delete, pay, and settle flows that were opened on the device succeeded. Production stays not ready because native billing and the production device-session architecture are still open.

## Module status

### Transactions — WORKING

| Action | Result |
|---|---|
| Add | Working |
| View | Working. Detail shows account and category names |
| Edit | Working |
| Delete | Working, including cancel then confirm |
| Search | Working, including a miss (`zzzznomatch`) |
| Filters | Income, Cash, and clear |
| Sort | newest, oldest, amount high, amount low |
| Pagination | Page 1 of 2 and page 2 of 2, different rows |
| Transfer | Working. Destination edit working |
| Same account | Source is excluded from To account |
| CSV | Share sheet opened |

### Accounts — WORKING

| Action | Result |
|---|---|
| Add / view / edit | Working |
| Archive | Cancel left QABankEdited open. Confirm removed it from the active list |

### Categories — WORKING

| Action | Result |
|---|---|
| Add / view / edit | Working |
| Delete | Cancel, then confirm |
| System category | Edit only. Delete is not offered |
| Transaction form | Custom category appeared on the add-transaction chips |

### Budgets — WORKING

Add, view, edit with hydrated values, delete, validation, and progress refresh.

### Goals — WORKING

Add, view, edit with hydrated values, contribution, progress refresh, archive cancel, and archive confirm. Active list refreshed.

### Recurring / bills — WORKING

Add, view, edit with hydrated values, pause, resume, delete, and the account/category requirement.

### Borrow / Lend — WORKING for CRUD

| Action | Result |
|---|---|
| Add / view / delete | Working |
| Edit | QA Amit saved from ₹2,500 due 2026-11-01 to ₹2,600 due 2026-12-01, reopened with those values, then restored |
| Repayment ledger, history, reminders | BLOCKED_BACKEND |

### Loans / EMI — WORKING

Add, view, edit, delete with confirmation, schedule, pay next EMI, balance refresh, and next due date refresh. A separate itemized payment-history API is not exposed.

### Credit cards — WORKING

| Action | Result |
|---|---|
| Add / view / edit / delete | Working, including cancel then confirm |
| Payment | A card with no due is rejected. With a minimum due, confirm reduced used balance and moved the due date |
| Dashboard | Home quick action My Cards opens the card list. A dedicated post-payment dashboard figure check was not repeated after the last card was deleted |

### UPI credit — WORKING for CRUD

Add, view, edit, and delete ran. Record payment is hidden. The API only marks credit cards paid, so UPI payment stays BLOCKED_BACKEND.

### Investments — WORKING

Add, detail, edit (invested and current value), and delete. Home still loads investments for net worth. A separate before/after dashboard screenshot after the disposable holding was deleted was not kept.

### IPO — WORKING

Add, detail, edit, delete, and the upcoming list. Upcoming cards show status, price band, and dates. There is no separate upcoming detail screen.

### Analytics — WORKING

Overview, monthly, category, and account reports showed non-zero values (income ₹587, expenses ₹125.50, net ₹461.50). CSV share opened `hisaab-report-2026-10.csv`. Empty and retry states for a failed report were not forced.

### Profile — WORKING

Invalid currency was rejected and the form stayed. A valid save of name, currency, timezone, and language persisted after leaving and reopening, then was restored. Country IN to NP persisted and was restored. The app was not force-stopped solely to recheck profile after that save.

### Settings — WORKING

Currency, language, theme, country, and timezone open Edit profile. App lock, smart notifications, and weekly summary persisted after leaving and returning, then were restored.

### Split Money — WORKING

| Action | Result |
|---|---|
| Equal, one partial payment, adjustment | Working |
| Exact | Under blocked, exact ₹60/₹40 saved, over blocked |
| Percentage | 99 blocked, 100 saved, 101 blocked |
| Shares | 2/1/1 saved as You ₹50, Priya ₹25, Rohan ₹25 |
| Item-wise | Add, edit, remove, assign, save. Result You ₹80, Priya ₹20 |
| Multiple payer | Under blocked, ₹60+₹40 saved, over blocked |
| Blank payer | Entered ₹0 and continue blocked |
| Second and final payment | ₹20, then ₹15, then the remaining ₹25 |
| Settle all | Pending became ₹0. History listed each payment. Detail showed 100% settled |
| Person | Phone saved and still present after reopen. Balances shown |
| Group | Name saved and reopened. Member add, cancel remove, and confirm remove refreshed the list |
| Receipt upload | BLOCKED_BACKEND_STORAGE |

### Dashboard — WORKING for the opened actions

Main figures render without NaN or Infinity. Add Money opens the transaction form. Budgets opens Budgets. My Cards opens Credit cards. Send Money is the other visible quick action and uses the same add-transaction route. Empty dashboard variants were not simulated.

### Auth — UI reset WORKING, release still blocked

Login, session restore, and logout work in QA. After the server session was removed, Refresh left the signed-in UI and showed Login. Signing in again opened Home. SecureStore clear is what the 401 path does before that switch. Production native device-session architecture is still RELEASE_BLOCKER_AUTH.

## Runtime safety

| Check | Result |
|---|---|
| 400 / validation | Working. Invalid profile currency, invalid lend amount, and split totals that do not match are blocked |
| 401 | Working. Login appears |
| 404 | Not re-run in this pass |
| 403 | UNVERIFIED. The account form creates a bank and does not call the catalog-only accounts route |
| 409 | UNVERIFIED. No screen returned 409 |
| 500 | UNVERIFIED. A 500 was not induced |
| Timeout | PARTIAL. A paused gateway during Refresh kept the cached transaction list and did not show a false success. The screen now has a refetch-failure line. That line was not shown again on device after the change |
| Offline split payment | Working. Airplane mode showed "Network request failed" and the pending balance stayed ₹100 |
| Offline goal, loan, card, UPI | UNVERIFIED in this pass |
| Duplicate submit | UNVERIFIED. Buttons ignore taps while a save is in flight. A measured double-tap was not recorded |
| Transaction empty | Working. Today with no rows, and a search miss |
| Other empty modules | UNVERIFIED. Existing QA data was not deleted to force them |
| Performance | Short scroll and tab pass. No freeze or request storm observed. No trace |
| Accessibility | Save, Delete, Pay, Settle, Add, Remove, and Export have text labels and wide targets. Paid, pending, and settled are written in words. Split Continue stays on screen |
| APP to WEB / WEB to APP | UNVERIFIED_ENVIRONMENT. Web on port 3000 was not up |

## Bugs found and fixed

1. Transaction detail showed raw ids. It now shows account and category names.
2. Several forms could not reach Save. Those screens scroll.
3. Loan detail had no delete. Delete with confirmation was added and used.
4. Card and UPI edit screens had no entry point. Edit was added and a card rename was saved.
5. Profile fields jumped back to the saved value when cleared. They now keep what is typed, including country.
6. Split Continue sat below the fold for shares and item-wise splits. The steps scroll and Continue stays visible.
7. Settled expenses showed 0% because the detail payload omits the percent. The screen calculates it from paid amounts. QAExact showed 100%.
8. A blank payer was counted as the full total, so two untouched payers displayed Entered ₹200. A blank payer is now ₹0 and cannot continue. Retested.
9. Lend edit sent an empty person string, so a visible valid amount and date were rejected. The save sends the name on screen. ₹2,600 / 2026-12-01 saved, reopened, then restored.
10. UPI showed Record payment even though the API rejects it. The button is hidden and the screen says UPI payment is not supported.

## Still pending

### Mobile code

- 403, 409, and 500 are not produced by a current screen, so those error views are unverified.
- The transaction refetch-failure line is in the app and was not shown again on the device.
- Duplicate-submit was not measured with a rapid double-tap.
- Offline goal, loan, and card payments were not repeated after the split-payment offline pass.
- Empty states for budgets, goals, Split Money, loans, cards, and investments were not forced.
- Profile was not force-stopped after the valid save. Leave and reopen did persist.
- Post-payment dashboard totals were not rechecked after the disposable card was removed.

### Backend

- Receipt and attachment binary storage
- OCR
- Transaction tags
- Borrow / Lend repayment ledger, history, and reminders
- UPI facility payment
- Separate loan and card payment-history APIs

### Platform and release

- Google Play Billing, receipt verification, and entitlements
- Production native auth and device-session architecture

## Verification

| Check | Result |
|---|---|
| TypeScript | Pass |
| Validation | Pass, 39 tests |
| `git diff --check` | Pass |
| Expo Android export | Pass. Hermes bundle at `/tmp/hisaab-android-export` |
| Emulator | NovaPlay_API35. Home, budgets, cards, UPI detail, lend edit, and blank-payer block ran on the latest bundle |

## Final decision

- Mobile CRUD: **PARTIAL**
- Feature status: **PARTIAL**
- Production: **NOT_READY**
