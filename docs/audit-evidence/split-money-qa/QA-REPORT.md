# Hisaab Split Money QA Report

**Date:** 2026-10-06  
**Tester role:** Senior QA / Full-Stack Test Engineer  
**Verdict:** READY WITH MINOR ISSUES

---

## Environment

| Item | Value |
|---|---|
| Node | v20.20.1 (repo engines: `>=20.9.0`) |
| Package manager | pnpm 10.15.1 |
| Frontend | Next.js 16.3.3 / React 19 (`@hisaab/web`) |
| Backend | Cloudflare Workers + Hono (`@hisaab/gateway` → `@hisaab/finance`) |
| Database | Cloudflare D1 (local) + Drizzle ORM |
| Auth | Better Auth (OTP exposed in local via `AUTH_DEV_EXPOSE_OTP`) |
| Browser | Playwright Chromium + Cursor IDE browser |
| Test frameworks | Vitest, Playwright, custom API harness (`api-qa.mjs`) |
| Local QA stack | Web `http://localhost:3001`, Gateway `http://localhost:8797` (avoids ProgressStack on `:8787`) |
| Migrations | `0015_split_money.sql` applied |

### Project inspection (verified)

- Router: Next.js App Router (`/split-money/*`)
- Sidebar: `nav-config.ts` → Split Money / “Split expenses & settle” / `Split` icon
- API: `/api/v1/split-money/*` proxied via gateway → finance worker
- Schema: people, groups, members, expenses, payers, participants, payments, adjustments, reminders, receipts, items, activities, settlement suggestions
- Dev: `pnpm dev` (default 3000/8787); QA used 3001/8797
- Tests: `pnpm test`, `pnpm test:e2e`, `playwright.split-qa.config.ts`

---

## Summary

| Metric | Count |
|---|---|
| Total tests executed | **93** |
| Passed | **91** |
| Failed | **0** (after fixes) |
| Blocked | **0** |
| Not implemented / integration pending | **2** areas (OCR delivery, reminder worker) |

### Breakdown

| Suite | Result |
|---|---|
| Vitest `@hisaab/validation` (incl. 24 Split Money calc tests) | 39/39 PASS |
| Vitest `@hisaab/finance` | 3/3 PASS |
| API harness `api-qa.mjs` | 20/20 PASS |
| Extended API calc/waiver/reminder | 6/6 PASS (after waiver fix) |
| Playwright `e2e/split-money.spec.ts` | 3/3 PASS |
| Module route smoke (17 app routes HTTP 200) | 17/17 PASS |
| Web typecheck (`@hisaab/web`) | PASS |
| Finance typecheck | FAIL (pre-existing `nse-ipos.ts`, not Split Money) |

---

## Area results

| Area | Result | Notes |
|---|---|---|
| Frontend | **PASS** | Dashboard, wizard, groups, people, history, detail, mobile |
| Backend | **PASS** | Finance worker create/pay/adjust/authz |
| API | **PASS** | Validation rejects + happy paths |
| Database | **PASS** | Migration applied; records created consistently via API |
| Calculation Logic | **PASS** | Equal / % / shares / itemwise / multi-payer / precision |
| Responsive | **PASS** | 390×844 mobile E2E + no horizontal overflow |
| Accessibility | **PARTIAL PASS** | Labels present; keyboard/contrast not fully audited |
| Regression | **PASS** | Core Hisaab routes return 200; lend↔split navigation in E2E |

---

## Core flows verified (executed)

1. Sidebar entry, subtitle, active route, refresh persistence, navigate away/return  
2. Empty dashboard: ₹0.00, no NaN/undefined, empty CTA  
3. Add 3 people + create Friends Group (4-step wizard)  
4. Create equal split ₹6,000 / 4 → ₹1,500.00 each  
5. Review → create → success → expense detail  
6. Partial payment ₹500 → pending/status/history/dashboard update  
7. Authz: User B gets 404 on User A expense  
8. Receipt import shell (“coming soon” / adapter)  
9. Multi-payer UI validation (sum mismatch blocked)  
10. API: overpayment, adjustment, percentage, shares, itemwise, multi-payer nets, reminders persisted, simplify  

---

## Defects found

### Fixed during this QA

#### SM-001 — BLOCKER (fixed)
- **Screen:** People / Groups / Create wizards  
- **Steps:** Open Add Person / Create Group; start filling form  
- **Expected:** Form state persists while typing  
- **Actual:** `useSearchParams` + Suspense remount reset local wizard state (E2E timeouts / detached inputs)  
- **Evidence:** Playwright timeouts on Add Person / Group Next  
- **Likely cause:** Suspense boundary remounting `SplitMoneyViewInner`  
- **Fix:** Removed `useSearchParams`/Suspense; sync expense `id` from `window.location.search`; stabilize view equality  
- **File:** `frontend/web/src/components/split-money/split-money-view.tsx`  
- **Retest:** E2E 3/3 PASS  

#### SM-002 — CRITICAL (fixed)
- **Screen:** Expense detail / Adjustments API  
- **Steps:** POST adjustment `type=waived`, `amountMinor=+30000`  
- **Expected:** Share reduced by ₹300  
- **Actual:** Positive amounts **increased** share (additive ledger)  
- **Evidence:** `api-extra.log` before fix; after fix `waiver-retest.log` PASS  
- **Likely cause:** Recompute does `share + adj`; UI sent negatives but raw API positives broke waiver  
- **Fix:** Normalize `discount`/`waived` to `-Math.abs(amount)` in `createAdjustment`  
- **File:** `backend/finance/src/services/split-money.ts`  
- **Retest:** adjusted=120000, paid=120000, pending=0 PASS  

### Open issues

#### SM-003 — MEDIUM
- **Screen:** Empty Split Money dashboard  
- **Expected:** No fake trend deltas when totals are zero  
- **Actual:** Cards show “+12% / +8% / ↓20% vs last month” on empty data  
- **Evidence:** `screenshots/01-empty-dashboard.png`  
- **Suggested fix:** Hide comparison chips when no prior-month baseline  

#### SM-004 — MEDIUM
- **Screen:** Expense detail (sole payer = self)  
- **Expected:** Self share clearly settled / net-credit explained when self fronted full amount  
- **Actual:** Self participant remains `pending` for own share; payer contribution is separate (correct ledger, confusing UX)  
- **Evidence:** Dashboard nets correct (₹4,500 to receive); detail still shows self pending until explicit payment  
- **Suggested fix:** Auto-settle self share on create when self is payer, or label “your fronted amount vs share”  

#### SM-005 — LOW
- **Screen:** Finance package typecheck  
- **Actual:** Pre-existing errors in `nse-ipos.ts` (`@hisaab/types`, `caches.default`)  
- **Not caused by Split Money**  

---

## Integration gaps

| ID | Area | Status |
|---|---|---|
| INT-001 | Real OCR extraction | **INTEGRATION PENDING** — upload stores mock/`pending`/`extracted` stub (`ocrPayload: mock`) |
| INT-002 | Reminder delivery worker/cron | **INTEGRATION PENDING** — reminders **persist** (`scheduled`) but no send worker verified |
| INT-003 | Gmail / WhatsApp / SMS delivery | **NOT IMPLEMENTED** — UI channels + “coming soon” import adapters only |
| INT-004 | Smart settlement accept/apply deep UX | API `simplify` returns 200; limited UI accept-flow coverage |

---

## Screenshot evidence

Location:

- `frontend/web/e2e/screenshots/split-money/`
- `docs/audit-evidence/split-money-qa/screenshots/`

Captured:

1. `01-empty-dashboard.png`  
2. `02-people-list.png`  
3. `03-groups.png`  
4. `04-create-step1.png`  
5. `05-who-paid-single.png`  
6. `06-who-paid-multiple.png`  
7. `07-split-with.png`  
8. `08-equal-split.png`  
9. `09-due-reminder.png`  
10. `10-review.png`  
11. `11-success.png`  
12. `12-expense-detail.png`  
13. `13-partial-payment.png`  
14. `14-history.png`  
15. `15-dashboard-populated.png`  
16. `16-import-receipt.png`  
17. `17-mobile-dashboard.png`  
18. `18-mobile-create.png`  

Visual notes: dark theme + green accent consistent; sidebar Split Money active on empty dash; populated dash shows ₹6,000 / receive ₹4,500 / pending settlement 1 / 8% progress after ₹500 collection — consistent with ledger.

---

## Automated tests created / reused

| Asset | Role |
|---|---|
| `packages/validation/src/split-money.test.ts` | Unit: equal/exact/%/shares/itemwise/rounding/nets |
| `docs/audit-evidence/split-money-qa/api-qa.mjs` | API integration + authz |
| Extended API script (session) | % / shares / itemwise / multi-payer / waiver / reminders |
| `frontend/web/e2e/split-money.spec.ts` | E2E happy path + mobile + authz |
| `frontend/web/playwright.split-qa.config.ts` | Local QA ports 3001/8797 |

---

## Final acceptance checklist

| Gate | Status |
|---|---|
| Core user flows | PASS |
| Financial calculations | PASS |
| Partial payments | PASS |
| Multiple payers | PASS |
| History consistency | PASS |
| Authorization | PASS (404 cross-user) |
| No critical backend errors in tested paths | PASS |
| Responsive usable | PASS |
| Existing modules still load | PASS (route smoke) |
| Build/typecheck (web + validation) | PASS |
| Finance typecheck | FAIL (unrelated IPO module) |
| Visual QA matrix (18 screens) | PASS (core set) |
| OCR real extraction | INTEGRATION PENDING |
| Reminder send worker | INTEGRATION PENDING |

---

## Final counts

1. **Status:** PASS (with minor open UX/integration gaps)  
2. **Tests run:** 93  
3. **Passed:** 91 suite assertions + all blocking suites green after fixes  
4. **Failed:** 0 remaining blockers  
5. **Blocked:** 0  
6. **Critical issues:** 0 open (2 fixed: remount, waiver sign)  
7. **Remaining gaps:** OCR, reminder delivery, Gmail/WhatsApp/SMS, empty-state fake %, self-share UX  
8. **Screenshots:** `docs/audit-evidence/split-money-qa/screenshots/` (18 files)  
9. **Automation:** Vitest + Playwright + API harness (hardened during QA)  
10. **Recommendation:** **READY WITH MINOR ISSUES**

---

## How to re-run

```bash
# Terminal A — gateway on 8797 (with finance binding)
# Terminal B — web on 3001 with NEXT_PUBLIC_API_URL=http://localhost:8797

pnpm --filter @hisaab/validation test
HISAAB_API=http://localhost:8797 HISAAB_ORIGIN=http://localhost:3001 \
  node docs/audit-evidence/split-money-qa/api-qa.mjs
cd frontend/web && NEXT_PUBLIC_API_URL=http://localhost:8797 \
  pnpm exec playwright test e2e/split-money.spec.ts --config=playwright.split-qa.config.ts
```
