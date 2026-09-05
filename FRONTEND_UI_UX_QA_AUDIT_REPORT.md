# Frontend UI/UX and Responsive QA Audit Report

## 1. Executive Summary

Automated Playwright sweeps plus visual screenshot review and static CSS/layout inspection were completed against a local authenticated build matching production commit `60acb45` (also live at https://hisaab.blobforges.workers.dev). No application source code was modified for this audit.

| Metric | Value |
| --- | ---: |
| Overall status | **Ready with minor fixes** |
| Screens / features in scope | 20 |
| Automated viewport × route checks | 184 |
| Passed (no horizontal overflow / shell present) | 184 |
| Failed (automated overflow) | 0 |
| Blocked (could not open) | 0 |
| Critical issues | 0 |
| High issues | 4 |
| Medium issues | 7 |
| Low issues | 5 |
| Enhancements | 4 |
| Overall UI quality score | **7.8 / 10** |
| Responsive quality score | **7.2 / 10** |
| Theme consistency score | **6.0 / 10** |
| Accessibility score | **7.0 / 10** |

**Top risks**

1. Immersed premium pages keep a **dark shell in light theme** (white cards on night chrome).
2. Some immersed pages hide the global header but **omit theme/notify controls** (Accounts, Investments, IPO).
3. At **320px**, bottom navigation truncates labels and can **cover KPI card content**.
4. Spending Limits emits **duplicate React keys** and shows a duplicated insight row.

Dark-theme desktop/laptop layouts for Overview, Bank, Transactions, Bills & Reminders, Borrow/Lend, Settings, Loans, Cards, and Accounts look polished and usable. Auth flows (register → verify OTP → dashboard) succeeded on the local E2E stack.

---

## 2. Test Environment

| Item | Detail |
| --- | --- |
| Application under test | Hisaab web (`@hisaab/web`) |
| Primary URL (live) | https://hisaab.blobforges.workers.dev |
| Audit execution URL | http://localhost:3000 (Next dev) + http://localhost:8787 (gateway) |
| Build / commit | `60acb45` — *Ship premium Settings and align Borrow / Lend icons* |
| Test date | 2026-09-05 |
| Tester role | Senior Frontend QA / Responsive UI / UX Auditor (agent-assisted) |
| Browsers tested | **Google Chrome** (Playwright `channel: "chrome"`, headless) |
| Browsers not available | Microsoft Edge, Firefox, Safari/WebKit |
| Themes tested | Light, Dark (`data-theme` / next-themes) |
| Auth approach | Fresh dummy registration (`qa-audit-*@example.com`); OTP from local `AUTH_DEV_EXPOSE_OTP` |
| Evidence folder | `docs/audit-evidence/qa-run/` (186 PNGs + `results.json`) |
| Code changes during audit | **None** (read-only) |

### Viewports exercised

| Name | Size |
| --- | --- |
| Desktop | 1920×1080 |
| Laptop | 1440×900 |
| Small laptop | 1280×720 |
| Tablet landscape | 1024×768 |
| Tablet portrait | 768×1024 |
| Mobile | 430×932 |
| Mobile | 390×844 |
| Small mobile | 360×800 |
| Minimum | 320×700 |

Dark theme was swept across all app routes × all viewports. Light theme was spot-checked on Overview, Transactions, Bank, Bills & Reminders, Borrow/Lend, Settings (1440 + 390) plus auth pages.

---

## 3. Feature Coverage Matrix

| Feature | Desktop | Mobile Web | Light Theme | Dark Theme | Actions | Responsive UI | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Overview | Pass | Pass* | Fail (shell) | Pass | Pass | Pass* | Fail |
| Transactions | Pass | Pass | Partial | Pass | Partial | Pass | Pass |
| Bank | Pass | Pass | Partial | Pass | Partial | Pass | Pass |
| Spending Limits | Pass | Pass | Fail (shell) | Pass | Partial | Pass | Fail |
| Savings Goals | Pass | Pass | Fail (shell) | Pass | Partial | Pass | Fail |
| Accounts | Pass | Pass | Fail (shell) | Pass | Partial | Pass | Fail |
| Investments | Pass | Pass | Fail (shell) | Pass | Partial | Pass | Fail |
| IPO Tracker | Pass | Pass | Fail (shell) | Pass | Partial | Pass | Fail |
| EMI & Loans | Pass | Pass | Pass/Partial | Pass | Partial | Pass | Pass |
| Credit Cards | Pass | Pass | Pass/Partial | Pass | Partial | Pass | Pass |
| UPI Credit | Pass | Pass | Pass/Partial | Pass | Partial | Pass | Pass |
| Bills & Reminders | Pass | Pass | Pass/Partial | Pass | Partial | Pass | Pass |
| Borrow / Lend | Pass | Pass | Pass/Partial | Pass | Partial | Pass | Pass |
| Settings | Pass | Pass | Partial | Pass | Pass | Pass* | Pass |
| Login | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| Sign Up | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| Forgot Password | Pass | Pass | Pass | Pass | Partial | Pass | Pass |
| Notifications | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| Theme Switching | Pass | Pass | Fail | Pass | Pass | Pass | Fail |
| Navigation / chrome | Pass | Pass* | Partial | Pass | Pass | Fail* | Fail |

\*Mobile nav truncation / 320px overlap issues apply across app chrome.

**Actions “Partial”** means empty-state UI and primary CTAs were verified; full CRUD with populated financial data was not exhaustively exercised in this pass (safe dummy empty account after signup).

---

## 4. Responsive Viewport Matrix

| Viewport | Pages Tested | Passed | Failed | Main Problems |
| --- | ---: | ---: | ---: | --- |
| 1920×1080 | 17 app + 3 auth | 20 | 0 overflow | Light shell on immersed pages |
| 1440×900 | 17 app + 3 auth | 20 | 0 overflow | Theme/chrome gaps |
| 1280×720 | 17 app | 17 | 0 | Dense side panels; still usable |
| 1024×768 | 17 app | 17 | 0 | Borderline desktop sidebar |
| 768×1024 | 17 app | 17 | 0 | Mobile nav; truncated labels |
| 430×932 | 17 app | 17 | 0 | “Transact…” truncation |
| 390×844 | 17 app + auth | 20 | 0 | Truncation; Settings badge hidden |
| 360×800 | 17 app | 17 | 0 | Truncation |
| 320×700 | 17 app + auth | 17 | 0 overflow | **Label clip + content under bottom nav** |

Automated horizontal-overflow checks: **0 failures** across 184 matrix rows.

---

## 5. Theme Test Results

| Screen | Light Theme | Dark Theme | Persistence | Contrast | Status |
| --- | --- | --- | --- | --- | --- |
| Overview | Fail — dark shell / white cards | Pass | Partial* | Pass (dark) | Fail |
| Transactions | Partial | Pass | Partial* | Pass | Partial |
| Bank | Partial | Pass | Partial* | Pass | Partial |
| Spending Limits | Fail shell | Pass | Partial* | Pass | Fail |
| Savings Goals | Fail shell | Pass | Partial* | Pass | Fail |
| Accounts | Fail shell | Pass | n/a (no page toggle) | Pass | Fail |
| Investments | Fail shell | Pass | n/a | Pass | Fail |
| IPO Tracker | Fail shell + dark chips | Pass | n/a | Pass | Fail |
| Loans / Cards / UPI / Lend / Recurring | Better light CSS | Pass | Via page toggle | Pass | Pass |
| Settings | Partial brand/nav | Pass | Via page toggle | Pass | Partial |
| Login / Register / Forgot | Pass | Pass | Page-local toggle | Low-contrast helpers | Pass |
| Reports / Coach / Premium | Token-based | Pass | Shell toggle | Pass | Pass |

\*Overview/Settings expose working theme buttons (`Switch to light/dark theme`). Accounts/Investments/IPO do not after immersion.

Evidence: `docs/audit-evidence/qa-run/app-_dashboard-laptop-1440-light.png` (light cards + dark sidebar/shell) vs `...-dark.png`.

---

## 6. Detailed Issues

### UI-001: Immersed light theme leaves dark application shell

* **Feature:** Overview, Accounts, Investments, Savings Goals, Spending Limits, IPO Tracker (and related immersion CSS)
* **Severity:** High
* **Priority:** P1
* **Browser:** Chrome
* **Viewport:** 1440×900 (also visible at 390×844)
* **Theme:** Light
* **Preconditions:** Authenticated user; switch to light theme
* **Description:** Premium `data-page` immersion CSS hardcodes dark `#020c11` / `#031017` shell/aside/main backgrounds. Card surfaces follow light tokens, producing a mixed “dark chrome + light content” UI that fails theme consistency.
* **Steps to reproduce:**
  1. Open `/dashboard`
  2. Click theme control → light
  3. Observe sidebar and main canvas remain night-mode while KPI cards turn white
  4. Repeat on `/accounts`, `/investments`, `/budgets`, `/goals`, `/ipo`
* **Expected result:** Entire shell, sidebar, and page chrome follow light theme.
* **Actual result:** Dark shell persists; cards lighten.
* **Evidence:** `docs/audit-evidence/qa-run/app-_dashboard-laptop-1440-light.png`
* **Console/network error:** None
* **Probable cause:** Missing `html:not(.dark)` / light overrides for `[data-app-shell][data-page="…"]` in `globals.css`, `accounts33.css`, `investments35.css`, `savings-goals.css`, `spending-limits.css`, `ipo38.css`
* **Recommended fix:** Add light shell/aside/main/brand/nav overrides per immersed page (mirror cards/lend/loans patterns).
* **Retest criteria:** Light theme screenshots show light sidebar + main; no dark immersion leftovers.

---

### UI-002: Theme and notification controls missing after header immersion (Accounts / Investments / IPO)

* **Feature:** Accounts, Investments, IPO Tracker
* **Severity:** High
* **Priority:** P1
* **Browser:** Chrome
* **Viewport:** 1920×1080, 1440×900
* **Theme:** Dark (also Light)
* **Preconditions:** Authenticated; open `/accounts`
* **Description:** Immersion CSS hides `.app-header`, but local page headers only expose feature CTAs (e.g. “Manage accounts”). Users lose in-page theme toggle and notifications that Overview/Settings/Lend provide.
* **Steps to reproduce:**
  1. Open `/dashboard` — confirm bell + theme exist
  2. Open `/accounts`
  3. Search header for notifications / theme controls
* **Expected result:** Equivalent notify/theme (or restored shell header) on all immersed pages.
* **Actual result:** Only “Manage accounts” (and similar) actions; no notify/theme.
* **Evidence:** `docs/audit-evidence/qa-run/app-_accounts-desktop-1920-dark.png`
* **Probable cause:** Header hide without parity controls in `accounts-view.tsx` / `investments-view.tsx` / `ipo-view.tsx`
* **Recommended fix:** Add page-local notify + theme buttons (Settings/Lend pattern) or keep a slim global chrome.
* **Retest criteria:** Theme and notifications reachable on Accounts, Investments, IPO at desktop and mobile.

---

### UI-003: Mobile bottom navigation labels truncated

* **Feature:** Navigation / footer (all authenticated screens)
* **Severity:** Medium
* **Priority:** P2
* **Browser:** Chrome
* **Viewport:** 390×844, 360×800, 320×700
* **Theme:** Dark
* **Preconditions:** Authenticated mobile viewport
* **Description:** Bottom nav labels clip: “Transactions” → “Transact…” / “Trans…”, “Overview” → “Overv…” at 320px.
* **Steps to reproduce:** Open any app page at 390 or 320 width; inspect `[data-mobile-nav]` labels.
* **Expected result:** Full readable labels or intentional short labels (“Txns”, “Home”) without ellipsis.
* **Actual result:** CSS truncation with ellipsis.
* **Evidence:** `app-_settings-mobile-390-dark.png`, `app-_reports-mobile-390-dark.png`, `app-_dashboard-min-320-dark.png`
* **Probable cause:** Fixed five-column nav + font size too large for width.
* **Recommended fix:** Shorter labels, smaller type, or icon-only with `aria-label`.
* **Retest criteria:** No ellipsis at 320–430 widths; accessible names remain clear.

---

### UI-004: Content obscured by bottom navigation at 320px

* **Feature:** Overview (likely other long pages)
* **Severity:** High
* **Priority:** P1
* **Browser:** Chrome
* **Viewport:** 320×700
* **Theme:** Dark
* **Preconditions:** Authenticated; `/dashboard`
* **Description:** Total Expenses KPI card is partially covered by the floating bottom navigation; last content is hard to read/tap.
* **Steps to reproduce:** Set viewport 320×700; open Overview; observe bottom of first viewport.
* **Expected result:** Main padding-bottom clears fixed nav; no content under chrome.
* **Actual result:** Card foot clipped under nav.
* **Evidence:** `docs/audit-evidence/qa-run/app-_dashboard-min-320-dark.png`
* **Probable cause:** Insufficient `padding-bottom` on `.app-main` / premium-dash for min width.
* **Recommended fix:** Increase mobile main bottom padding (≥ nav height + safe area).
* **Retest criteria:** Full KPI row readable above nav at 320px; no overlap.

---

### UI-005: Duplicate Spending Insights row and React key warning

* **Feature:** Spending Limits (`/budgets`)
* **Severity:** Medium (High for console hygiene)
* **Priority:** P1
* **Browser:** Chrome
* **Viewport:** 1440×900 (also other sizes visiting budgets)
* **Theme:** Dark
* **Preconditions:** Authenticated empty budgets
* **Description:** “Smart budget suggestions” appears twice in Spending Insights. Console repeatedly logs: `Encountered two children with the same key` (9 occurrences during audit).
* **Steps to reproduce:** Open `/budgets`; inspect Spending Insights list; open DevTools console.
* **Expected result:** Unique insight items; unique React keys.
* **Actual result:** Duplicated insight UI; duplicate-key warning.
* **Evidence:** `app-_budgets-laptop-1440-dark.png`; `results.json` consoleErrors
* **Probable cause:** Insights array uses `key={item.title}` with duplicate titles (`budgets-view.tsx`)
* **Recommended fix:** Deduplicate insight source data; key by stable id.
* **Retest criteria:** One row per insight; zero duplicate-key warnings on `/budgets`.

---

### UI-006: Double header stack on non-immersed mobile pages

* **Feature:** Analytics (`/reports`), Coach, Categories, Profile
* **Severity:** Medium
* **Priority:** P2
* **Browser:** Chrome
* **Viewport:** 390×844
* **Theme:** Dark
* **Preconditions:** Open `/reports` on mobile
* **Description:** Global `MobileHeader` (logo + title + notify/theme) remains, while page also renders its own premium/title card — double chrome and wasted vertical space vs immersed pages.
* **Steps to reproduce:** Compare `/recurring` (immersed, no shell header) vs `/reports` (shell header + page hero).
* **Expected result:** Single clear page header pattern.
* **Actual result:** Stacked headers on Analytics (and similar).
* **Evidence:** `app-_reports-mobile-390-dark.png`
* **Probable cause:** No `data-page` immersion; `PageHeader` / page hero still used.
* **Recommended fix:** Immersion or suppress `MobileHeader` title when page supplies its own.
* **Retest criteria:** One header band on Analytics mobile.

---

### UI-007: Settings workspace still labels Bills feature “Recurring”

* **Feature:** Settings
* **Severity:** Low
* **Priority:** P3
* **Browser:** Chrome
* **Viewport:** Desktop/Mobile
* **Theme:** Both
* **Description:** Nav and page title use “Bills & Reminders”, but Settings → Workspace link label is still “Recurring”.
* **Expected result:** Consistent product naming.
* **Actual result:** “Recurring” in Settings workspace.
* **Evidence:** Code `settings-view.tsx` workspace items; visual Settings workspace section
* **Recommended fix:** Rename label to “Bills & Reminders”.
* **Retest criteria:** No “Recurring” user-facing label except technical/API contexts.

---

### UI-008: Spending Limits / Savings Goals theme buttons are stubs

* **Feature:** Spending Limits, Savings Goals
* **Severity:** Medium
* **Priority:** P2
* **Browser:** Chrome
* **Viewport:** Desktop
* **Theme:** Dark
* **Description:** Moon/theme controls toast users to use Settings instead of toggling theme, after immersion already hid the global header theme control.
* **Expected result:** Theme toggles immediately (Overview/Settings behavior).
* **Actual result:** Informational toast only.
* **Evidence:** Code paths in `budgets-view.tsx` / `goals-view.tsx` (static review)
* **Recommended fix:** Wire `setTheme` like Overview.
* **Retest criteria:** First click flips theme on those pages.

---

### UI-009: Settings Premium badge hidden on small screens

* **Feature:** Settings
* **Severity:** Low
* **Priority:** P3
* **Browser:** Chrome
* **Viewport:** ≤820px
* **Theme:** Dark
* **Description:** `.s38-premium-pill { display: none }` removes “Premium User” badge on mobile Profile card.
* **Expected result:** Badge visible or replaced with compact chip.
* **Actual result:** Badge disappears.
* **Evidence:** `app-_settings-mobile-390-dark.png`; `settings38.css`
* **Recommended fix:** Compact badge under title on mobile.
* **Retest criteria:** Membership status visible at 390px.

---

### UI-010: Auth helper and legal text low contrast

* **Feature:** Login
* **Severity:** Low
* **Priority:** P3
* **Browser:** Chrome
* **Viewport:** 1440×900
* **Theme:** Dark
* **Description:** Helper “Your private login ID” and footer legal line are very dim on black/near-black.
* **Expected result:** WCAG AA contrast for body/helper text.
* **Actual result:** Low-contrast muted grays.
* **Evidence:** `auth-login-laptop-1440-dark.png`
* **Recommended fix:** Lighten muted tokens on auth surfaces.
* **Retest criteria:** Contrast ≥ 4.5:1 for helper text.

---

### UI-011: 404 resource request on Login

* **Feature:** Login
* **Severity:** Low
* **Priority:** P3
* **Browser:** Chrome
* **Viewport:** 1440×900
* **Theme:** Dark
* **Description:** Console shows `Failed to load resource: 404` once on `/login` during audit (no networkFails array entry for API). Likely missing static asset/favicon/map.
* **Expected result:** No 404s on first paint.
* **Actual result:** One 404 console error.
* **Evidence:** `results.json` consoleErrors
* **Recommended fix:** Identify URL in Network panel; add asset or remove reference.
* **Retest criteria:** Clean console on `/login` cold load.

---

### UI-012: IPO light theme leftover dark chips/menus

* **Feature:** IPO Tracker
* **Severity:** Medium
* **Priority:** P2
* **Browser:** Chrome
* **Viewport:** Desktop
* **Theme:** Light
* **Description:** Static CSS review: status chips, empty headings, menus, and some table cells keep dark palette hex values under light theme.
* **Expected result:** Full light palette.
* **Actual result:** Mixed dark components on light attempt.
* **Evidence:** `ipo38.css` light block scope (static)
* **Recommended fix:** Extend light overrides for chips/menus/empty/table cells.
* **Retest criteria:** IPO light screenshot has no dark leftover panels.

---

### UI-013: Overview empty-state delta copy is awkward

* **Feature:** Overview
* **Severity:** Enhancement
* **Priority:** P4
* **Description:** Zero-data KPIs show “— same from last month” / “— same across your accounts”, which reads like a regression delta rather than an empty state.
* **Evidence:** Overview dark/light screenshots
* **Recommended fix:** Use “No activity yet” style empty copy.
* **Retest criteria:** Empty KPIs use clear empty language.

---

### UI-014: Mobile “More” active while viewing nested tools

* **Feature:** Navigation
* **Severity:** Enhancement
* **Priority:** P4
* **Description:** On Analytics (and Settings), bottom nav highlights “More” rather than a dedicated Analytics item — expected with current IA, but easy to misread as wrong selection.
* **Evidence:** `app-_reports-mobile-390-dark.png`, Settings mobile
* **Recommended fix:** Optional secondary indicator or “More · Analytics” title treatment.
* **Retest criteria:** Users can tell which nested tool is open.

---

### UI-015: Incomplete light chrome on Bank / Transactions / Settings sidebars

* **Feature:** Bank, Transactions, Settings
* **Severity:** Medium
* **Priority:** P2
* **Description:** Light shell backgrounds exist, but brand gold / active nav icon treatments from dark immersion can linger (incomplete light nav chrome vs cards/lend).
* **Evidence:** Static CSS comparison; light spot screenshots
* **Recommended fix:** Port brand/nav light overrides from lend/cards.
* **Retest criteria:** Light sidebar matches non-immersed light design system.

---

### EN-001: Populate CRUD depth for release regression pack

* **Severity:** Enhancement
* **Description:** This audit verified empty states and primary CTAs after signup. Recommend a follow-up pack that adds transactions, budgets, goals, loans, cards, bills, and lend records and re-checks totals/charts.

### EN-002: Cross-browser matrix

* **Severity:** Enhancement
* **Description:** Firefox, Edge, and Safari were not available in this environment.

### EN-003: Production OTP-gated signup not retested here

* **Severity:** Enhancement / Blocked on prod
* **Description:** Full register→OTP on production was not repeated (OTP exposure is local-only). Login/register/forgot UIs were validated locally and via static production deployment parity.

### EN-004: Keyboard-only and zoom 150/200% not fully timed

* **Severity:** Enhancement
* **Description:** Spot-checked focusable controls and aria-labels on Overview/Settings; full WCAG keyboard tour and zoom matrix should be scheduled.

---

## 7. Screen-by-Screen Findings

### Overview (`/dashboard`)
* **Pass:** Immersed header with search, notify, theme, Add Transaction; KPI grid; empty charts; no horizontal overflow 320–1920 dark.
* **Fail:** Light shell (UI-001); 320px overlap (UI-004); empty delta copy (UI-013).
* **Evidence:** `app-_dashboard-*`

### Transactions (`/transactions`)
* **Pass:** Immersion, dark layout, mobile nav, no overflow.
* **Partial:** Light chrome (UI-015); CRUD with data not deep-tested.

### Bank (`/bank`)
* **Pass:** Dark immersion, responsive.
* **Partial:** Light chrome (UI-015).

### Spending Limits (`/budgets`)
* **Pass:** Premium layout, empty states, CTAs visible.
* **Fail:** Duplicate insights + React keys (UI-005); light shell (UI-001); stub theme (UI-008).

### Savings Goals (`/goals`)
* **Pass:** Loads all viewports dark; no overflow.
* **Fail:** Light shell (UI-001); stub theme (UI-008).

### Accounts (`/accounts`)
* **Pass:** Rich empty/default seeded accounts UI; filters; mix chart empty state.
* **Fail:** Missing notify/theme (UI-002); light shell (UI-001).

### Investments (`/investments`)
* **Pass:** Page renders all viewports.
* **Fail:** UI-001, UI-002.

### IPO Tracker (`/ipo`)
* **Pass:** Dark immersion usable.
* **Fail:** UI-001, UI-002, UI-012.

### EMI & Loans (`/loans`)
* **Pass:** Premium dark UI; hero/image pattern consistent with design system.
* **Partial:** Light theme better than Overview family; CRUD depth limited.

### Credit Cards (`/cards`)
* **Pass:** Premium dark UI across viewports.

### UPI Credit (`/upi-credit`)
* **Pass:** Premium dark UI across viewports.

### Bills & Reminders (`/recurring`)
* **Pass:** Immersion, hero image, solid icon tiles, empty state CTAs.
* **Partial:** Light theme mostly OK; CRUD depth limited.

### Borrow / Lend (`/lend`)
* **Pass:** Immersion, wallet hero, KPI/summary icon tiles, empty state.
* **Partial:** CRUD depth limited.

### Settings (`/settings`)
* **Pass:** Immersed Settings with tabs, save, logout, profile fields; theme + notify present.
* **Issues:** UI-007, UI-009; light chrome partial (UI-015).

### Login (`/login`)
* **Pass:** Split marketing + form; show password; keep signed in; links to register/forgot.
* **Issues:** UI-010, UI-011.

### Sign Up (`/register`)
* **Pass:** Local E2E path: send code → OTP → verify → password → `/dashboard` succeeded for audit account.

### Forgot Password (`/forgot-password`)
* **Pass:** Page loads 320/390/1440 light+dark; no overflow.
* **Partial:** Full email reset delivery not verified end-to-end against mailbox.

### Notifications
* **Pass:** Bell visible on Overview/Settings/Reports; panel openable on immersed pages that include it.
* **Fail:** Missing on Accounts/Investments/IPO (UI-002).

### Theme Switching
* **Pass:** Overview/Settings/Lend-style controls flip appearance when present.
* **Fail:** Global consistency (UI-001); missing controls (UI-002); stubs (UI-008).

### Navigation / header / sidebar / mobile / footer
* **Pass:** Desktop sidebar active states; mobile bottom nav present &lt;1024; More menu reaches tools.
* **Fail:** Truncation (UI-003); 320 overlap (UI-004); double headers (UI-006).

---

## 8. Functional Action Results

| Action | Result | Notes |
| --- | --- | --- |
| Register + OTP + create password | Pass | Local gateway with OTP exposure |
| Login form empty/invalid attempts | Pass | Validation UI present; Continue securely CTA |
| Forgot password page | Pass | Loads; submit deep-link email not mailbox-verified |
| Overview Add Transaction CTA | Pass | Control present/tappable |
| Theme toggle (Overview/Settings) | Pass | Present with aria-labels in screenshots |
| Notifications open | Pass | Where control exists |
| Settings Save Changes | Pass | Button present |
| Settings Log out control | Pass | Button present (confirm dialog not destructive-tested on shared env) |
| Nav to all 17 app routes | Pass | All returned shell + heading |
| Horizontal overflow | Pass | 0 failures |
| Budgets Add Category Limit CTA | Pass | Visible |
| Accounts Manage / filters | Pass | Visible |
| Duplicate insight click targets | Fail | UI-005 |
| Full CRUD money flows | Partial / Not completed | Empty account; recommend EN-001 |
| Browser Back/Forward deep matrix | Partial | Not fully scripted |
| Double-submit guards | Partial | Not force-tested on all forms |

---

## 9. Visual Consistency Findings

| Area | Finding |
| --- | --- |
| Margins / gaps | Immersed premium pages generally use ~14px gaps; consistent on dark desktop |
| Cards | Radius and borders largely consistent within each `*38` design system |
| Typography | Clear hierarchy on premium pages; auth marketing headline strong |
| Icons | Bills/Lend recently aligned to solid tiles; Accounts uses colored tiles well |
| Gradients | Dark immersion cohesive; light immersion incomplete (UI-001) |
| Shadows | Controlled on dark; not excessive |
| Alignment | Desktop grids aligned; mobile stacks correctly |
| Naming | “Recurring” vs “Bills & Reminders” inconsistency (UI-007) |
| Empty states | Generally good; Overview delta copy weak (UI-013) |

---

## 10. Responsive and UI-Breaking Issues

### Desktop (1280–1920)
* No overflow breakages.
* Light theme shell defects (UI-001, UI-012, UI-015).
* Missing chrome controls (UI-002).

### Tablet (768–1024)
* Mobile nav engages below 1024.
* Truncation begins (UI-003).
* Double headers on Analytics (UI-006).

### Mobile web (320–430)
* Truncated nav labels (UI-003).
* 320px content under nav (UI-004).
* Settings badge hidden (UI-009).
* Email truncation in Settings field (acceptable with `break-all`/ellipsis; monitor).

### Orientation
* Portrait tablet/mobile covered; landscape tablet 1024×768 covered.
* Dedicated landscape-phone rotation not separately captured.

### Zoom
* 125/150/200% not fully audited (EN-004).

---

## 11. Theme Findings

* Dark theme is the design-complete path for premium finance screens — **strong**.
* Light theme is **not release-consistent** for immersed Overview/Accounts/Investments/Goals/Budgets/IPO (UI-001).
* Theme persistence via next-themes works when toggles exist; several immersed pages remove the control (UI-002, UI-008).
* Auth pages support local theme toggle and look intentional in both modes.
* Contrast mostly good in dark; auth helpers weak (UI-010).

---

## 12. Accessibility Findings

| Check | Result |
| --- | --- |
| Icon button labels (Overview/Settings theme & notify) | Pass (`Switch to … theme`, `Notifications`) |
| Form labels on Settings/Login | Pass |
| Mobile nav accessible names | Pass (despite visible truncation) |
| Focus visibility | Partial — not fully toured |
| Escape to close panels | Partial — notify panels implement Escape in code paths reviewed earlier |
| Color-only meaning | Mostly paired with text; watch status chips |
| Touch targets | Generally ≥40px on premium buttons; bottom nav OK |
| Contrast | Dark pass; auth helpers fail AA risk (UI-010) |
| Screen reader | Not VoiceOver/NVDA tested |
| Reduced motion | Not verified |

---

## 13. Console, Network, and Performance Findings

| Finding | Route | Impact | Evidence |
| --- | --- | --- | --- |
| Duplicate React key warning (×9) | `/budgets` | List reconciliation risk; duplicate insight UI | `results.json` |
| Resource 404 (×1) | `/login` | Minor; possible missing asset | `results.json` |
| Failed API (4xx/5xx) during audit | — | **0** recorded in networkFails | `results.json` |
| Horizontal overflow | all | **0** | matrix |
| Hydration errors | — | None observed | — |

Performance profiling (LCP/INP/CLS) was **not** run (Chrome DevTools MCP unavailable). Recommend a follow-up web-perf pass.

---

## 14. Under-Development and Blocked Features

| Item | Status | Notes |
| --- | --- | --- |
| Data & Privacy / Connected Apps Settings tabs | Under development | Toast “coming soon” |
| Profile photo upload | Under development | Camera control toasts soon |
| Import from bank (Bills) | Under development | Toast soon |
| Some “Watch how it works” / How it works buttons | Informational toast | Not full media players |
| Production OTP email path | Blocked for this audit | Local OTP used instead |
| Firefox / Safari / Edge | Not available | — |
| Full populated CRUD regression | Not completed | EN-001 |

These were **not** counted as product defects unless an implemented surface was broken (e.g. duplicate insights is a defect).

---

## 15. Recommendations

### Immediate fixes
1. Fix Spending Limits duplicate insights + React keys (UI-005).
2. Increase mobile `padding-bottom` for 320px shell (UI-004).
3. Restore theme + notify on Accounts / Investments / IPO (UI-002).

### High-priority fixes
4. Light-theme immersion overrides for Overview/Accounts/Investments/Goals/Budgets/IPO (UI-001, UI-012).
5. Replace stub theme buttons on Budgets/Goals (UI-008).
6. Fix mobile nav label strategy (UI-003).

### Design-system improvements
7. One immersion checklist: hide shell header ⇒ require local search?/notify/theme/CTA parity.
8. Unify feature naming Bills & Reminders (UI-007).

### Responsive improvements
9. Bottom nav typography tokens per breakpoint.
10. Audit Analytics/Coach/Profile for single-header mobile pattern (UI-006).

### Theme improvements
11. Shared light immersion mixins for shell/aside/nav/brand.
12. Contrast tokens for auth helper text (UI-010).

### Accessibility improvements
13. Full keyboard tour + zoom 150/200% pack (EN-004).
14. Ensure truncated nav keeps clear `aria-label`.

### Performance improvements
15. Lighthouse/CWV pass with Chrome DevTools MCP (EN).
16. Resolve login 404 asset (UI-011).

---

## 16. Final Release Recommendation

**Ready with minor fixes**

**Rationale:** Dark-theme desktop and primary mobile widths are visually strong and navigable across all listed product screens, with zero automated horizontal overflow failures and a successful auth signup path. However, light-theme immersion is incomplete, several immersed pages drop theme/notification chrome, minimum-width mobile has content/nav collisions, and Spending Limits shows a real duplicate-key UI bug. Address High items UI-001/002/004/005 before calling the release theme-complete and mobile-min ready; Medium items can trail in a fast follow-up.

---

## 17. Issue Summary Table

| ID | Feature | Issue | Viewport | Theme | Severity | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-001 | Overview + immersed set | Dark shell in light theme | 1440 / 390 | Light | High | P1 | Open |
| UI-002 | Accounts / Investments / IPO | Missing theme & notify after immersion | 1920 / 1440 | Both | High | P1 | Open |
| UI-003 | Navigation | Bottom nav label truncation | 320–430 | Dark | Medium | P2 | Open |
| UI-004 | Overview | Content under bottom nav | 320×700 | Dark | High | P1 | Open |
| UI-005 | Spending Limits | Duplicate insight + React keys | 1440 | Dark | Medium | P1 | Open |
| UI-006 | Analytics (+ peers) | Double mobile header | 390 | Dark | Medium | P2 | Open |
| UI-007 | Settings | “Recurring” label mismatch | All | Both | Low | P3 | Open |
| UI-008 | Budgets / Goals | Theme button stubs | Desktop | Dark | Medium | P2 | Open |
| UI-009 | Settings | Premium badge hidden mobile | ≤820 | Dark | Low | P3 | Open |
| UI-010 | Login | Low-contrast helpers | 1440 | Dark | Low | P3 | Open |
| UI-011 | Login | 404 resource | 1440 | Dark | Low | P3 | Open |
| UI-012 | IPO | Light leftovers | Desktop | Light | Medium | P2 | Open |
| UI-013 | Overview | Awkward empty delta copy | All | Both | Enhancement | P4 | Open |
| UI-014 | Navigation | More-active ambiguity | Mobile | Dark | Enhancement | P4 | Open |
| UI-015 | Bank / Tx / Settings | Incomplete light nav chrome | Desktop | Light | Medium | P2 | Open |

---

## Appendix A — Evidence index

* Machine results: `docs/audit-evidence/qa-run/results.json`
* Screenshots: `docs/audit-evidence/qa-run/*.png` (186 files)
* Naming: `app-_<route>-<viewport>-<theme>.png`, `auth-<page>-<viewport>-<theme>.png`

## Appendix B — Method notes

* Automated checks: route load, heading presence, shell/mobile-nav visibility by breakpoint, horizontal overflow, broken `img.naturalWidth === 0`, console error capture.
* Visual review: sampled screenshots for layout, truncation, theme, empty states.
* Static review: immersion map, light CSS gaps, nav naming, key= patterns.
* Did **not** modify application source; temporary local harness was removed after the run.
