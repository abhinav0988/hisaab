# Split Money — Group Testing

## Scope

Group creation → adding/removing members → group expense creation with `groupId` → group summary & member net balances → settlement & balance guards.

---

## Test Cases & Results

| ID | Case | Expected Behavior | Evidence | Status |
| --- | --- | --- | --- | --- |
| G1 | Create group with name, type & description | Creates group idempotently and auto-includes owner (`You`) | D1 Integration (`I10`) + Web Playwright E2E (`W1`, `W2`) | **PASS** (Web & Backend) / **BLOCKED** (Android runtime) |
| G2 | Add and remove group members | Adds member to group; removes member when balance in group is `0` | D1 Integration (`I10`) + Web Playwright E2E (`W1`, `W2`) | **PASS** (Web & Backend) / **BLOCKED** (Android runtime) |
| G3 | Block removing group member with unsettled balance | Rejects removal with `409 MEMBER_HAS_BALANCE` until obligations are settled | D1 Integration (`I10`: `enforces group member & person archive balance guards until obligations are settled`) | **PASS** |
| G4 | Pre-select group when clicking `Add Expense` inside Group Detail | Navigates to `/split-money/create?groupId=...` (web) or `SplitCreate({ groupId })` (Android) and pre-selects group + members | Code + TypeScript + Web build + Android Hermes bundle | **PASS** (Web & Code) / **BLOCKED** (Android runtime) |
| G5 | Group Detail `Balances` tab & summary metrics | Computes `totalSharedMinor`, `outstandingMinor`, `settledPercent`, and per-member `netMinor` from live expense ledgers | D1 Integration (`I10`) + Web Playwright E2E (`W2`: switches to `Balances` tab and verifies `Member Net Balances`) | **PASS** (Web & Backend) / **BLOCKED** (Android runtime) |
| G6 | Group Detail `Settings` tab (edit group name, type, description) | Updates group metadata via `PATCH /api/v1/split-money/groups/:id` | Web Playwright E2E (`W2`: edits description in `Settings` tab and clicks `Save Settings`) | **PASS** (Web & Backend) / **BLOCKED** (Android runtime) |
| G7 | Dashboard `groupBalances` summary | Aggregates `yourNetMinor` and `outstandingMinor` across active group expenses | D1 Integration (`I5`) + Web Playwright E2E (`W1`) | **PASS** |
