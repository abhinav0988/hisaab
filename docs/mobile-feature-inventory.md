# Hisaab mobile parity inventory

Audit date: 2026-10-07. This is based on source routes in `frontend/web/src/app`, gateway routing in `backend/gateway`, domain routes in `backend/*/src/routes`, and the Drizzle schema in `packages/database`—not on the static web export.

## Current architecture

- Web: Next.js App Router (`frontend/web`); mobile: Expo SDK 54 / React Native TypeScript (`frontend/app`).
- Backend: Cloudflare Workers behind one Hono gateway. Domain workers are Auth, Profile, Accounts, Categories, Transactions, Budgets, Recurring, Finance, and Reports.
- Data: Drizzle + D1/SQLite schema in `packages/database`; contract validation lives in `packages/validation`; API DTOs live in `packages/types`.
- Authentication: Better Auth session endpoint proxied at `/api/auth/*`. The app stores its session material in Expo SecureStore. A proper bearer-token/device-session design remains an auth-backend follow-up; tokens must never move to AsyncStorage.
- Gateway API convention: `/api/v1/*`, authenticated, `ApiResponse<T>` envelope. The gateway routes to domain workers and preserves request headers.

## Feature map

| Web module / route | Existing API and persisted entities | Mobile equivalent | Status / mobile work |
| --- | --- | --- | --- |
| Authentication (`/login`, `/register`, password reset, verify email) | `/api/auth/*`; `user`, `session`, `account`, `verification` | Auth stack | Present; native token/device session still required before release. |
| Dashboard (`/dashboard`) | `GET /api/v1/dashboard/summary`; accounts, transactions, budgets, goals | Home tab | Present; add split/debt/upcoming snapshots. |
| Transactions (`/transactions`) | `/api/v1/transactions`; `transactions`, `recurring_occurrences` | Transactions tab, list/detail/edit/create | List/create present; detail/edit/filters/export/attachment parity incomplete. |
| Accounts and bank (`/accounts`, `/bank`) | `/api/v1/accounts`, `/banks`, `/catalog`; `accounts`, `account_catalog` | Finance → Accounts/Bank | Basic list/create present; detail/edit/history incomplete. |
| Categories (`/categories`) | `/api/v1/categories`; `categories` | Transaction category management | Not exposed in app navigation. |
| Spending limits (`/budgets`) | `/api/v1/budgets`; `budgets` | Finance → Spending Limits | Summary/create present; edit/reset/category controls incomplete. |
| Savings goals (`/goals`) | `/api/v1/goals`, contributions; `savings_goals`, contributions | Finance → Savings Goals | Summary/create present; contributions, edit/archive incomplete. |
| Recurring bills (`/recurring`, `/schedules`) | `/api/v1/recurring-transactions`; `recurring_transactions`, occurrences | Finance → Bills & Reminders | Listing only; calendar, pause/resume/create and reminders incomplete. |
| Analytics (`/reports`) | `/api/v1/reports/{daily,monthly,categories,accounts,export.csv}` | Insights/analytics drill-down | Generic feature view only; chart/detail/export parity incomplete. |
| Investments (`/investments`) | `/api/v1/investments`; `investments` | Finance → Investments | Basic list/create present; edit/delete/history incomplete. |
| IPO (`/ipo`) | `/api/v1/ipos`, `/upcoming`; `ipo_applications` | Finance → IPO Tracker | Basic list/delete present; create/edit/upcoming detail incomplete. |
| Loans (`/loans`) | `/api/v1/loans`, schedule, pay; `loans`, installments | Finance → EMI & Loans | List only; schedule/pay/create/edit incomplete. |
| Cards and UPI (`/cards`, `/upi-credit`) | `/api/v1/credit-facilities`; `credit_facilities`, payments/holds | Finance → Cards / UPI Credit | List only; masked detail/payments/reminders incomplete. |
| Borrow / Lend (`/lend`) | `/api/v1/lend-records`; `lend_records` | Finance → Borrow / Lend | Basic list/create present; repayment, filters, calendar and detail incomplete. |
| Split Money (`/split-money/*`) | `/api/v1/split-money/*`; people, groups, expenses, payers, participants, payments, adjustments, reminders, receipts, items, activity, settlements | Dedicated Split tab + nested stack | **Not implemented in the native app.** The backend already supports the complete domain and must be used directly. |
| AI Coach (`/coach`) | No domain API route found in the audited gateway | More → Coach | UI label exists, no backed feature. Do not ship as active until API contract exists. |
| Premium (`/premium`) | Profile/subscription DTOs; no native purchase route found | Profile → Premium | Screen exists; platform billing/entitlement verification needs a separate product decision. |
| Profile/settings (`/profile`, `/settings`) | `/api/v1/profile`; `user_preferences`, subscriptions | Profile tab, settings stack | Present; audit all web preferences before release. |

## Channel contract

The canonical shared values are `WEB`, `MWEB`, and `APP`. `APP` means the native client entry point, not Android or iOS. OS is separately supplied as `ios`, `android`, or `web`.

The native API client now adds these headers on every gateway request:

```text
X-Sales-Channel: APP
X-Client-Platform: ios | android
X-App-Version: <configured version>
```

The gateway permits and forwards those headers. Source-channel persistence is intentionally not yet added to every table: it requires a reviewed migration and domain-service updates for the business events that matter (registration, transaction, split expense/payment, lend record, recurring reminder, and audit log). That migration should preserve original creation channel separately from last-update channel.

## Release blockers, in priority order

1. Implement the Split Money navigation, client service, six-step create wizard, payment/adjustment history, settlement, groups/people, receipt import, and detail flows against the existing `/api/v1/split-money` service.
2. Replace cookie-emulation with a mobile-native token/device-session contract in Auth; register and revoke push device tokens there.
3. Finish item-level CRUD and details for the remaining finance modules rather than presenting generic summary cards as parity.
4. Add native file/image picker, share/export, deep links, offline/network UI, notification centre, and push registration only once their backend contracts are defined.
5. Add source-channel migration plus service-level audit coverage, then test WEB, MWEB, and APP against the same business rules.
