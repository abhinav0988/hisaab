# Split Money — Pending Work

Updated 2026-10-16 after completing all backend, web, and Android feature parity work, D1 financial concurrency tests, emulator cold-boot/TCG diagnostics, and full Playwright E2E + persisted database verification. Only items that require external infrastructure, host hardware virtualization (`/dev/kvm` or physical USB device), or explicit release authorization remain here.

---

## BLOCKED

| Item | Why blocked | Needed |
| --- | --- | --- |
| Live Android app runtime execution on emulator/device | We resolved the stale snapshot lock and missing `/dev/kvm` startup crash by cold-booting `NovaPlay_API35` in software TCG mode (`-no-snapshot -gpu swiftshader_indirect -accel off -qemu -cpu max`) with writable `ANDROID_AVD_HOME` and `XDG_RUNTIME_DIR`. `qemu-system-x86_64-headless` launched cleanly, initialized SwiftShader Vulkan/GLES, and registered `port.adb=5555`. However, booting full Android 15 (API 35) `x86_64` in pure software TCG without hardware KVM took >36 CPU-minutes without completing Android userspace / `adbd` initialization. | Enable KVM (`/dev/kvm`) on the host machine or attach a physical Android device via `adb`, then run the live Android UI smoke pass against `http://10.0.2.2:8787` |
| Live production receipt OCR | Receipt file upload, storage, viewing, expense linkage, and deterministic mock OCR (`SPLIT_RECEIPT_OCR=mock`) are **PASS**. Live AI receipt extraction requires external Cloudflare Workers AI / vision credentials in a production-like environment. | Configure production Workers AI / vision credentials and verify live receipt OCR extraction |
| Apply migration `0018_split_ledger_integrity.sql` to remote production D1 & deploy workers | Strict instruction: do not apply remote D1 migrations or deploy without authorization. Local migration on fresh D1 and pre-`0018` data upgrade tests are **PASS**. | Explicit authorization to run the production migration runbook in `docs/SPLIT_MONEY_FINAL_QA.md` §5 |
| Commit / push | Strict instruction: do not commit or push without authorization. | Explicit authorization |

---

## Out of Scope / Intentionally Disabled in This Release

| Item | Release scope | Current state |
| --- | --- | --- |
| Push notifications, Email, SMS, and WhatsApp reminder channels | Excluded from this release (**In-app reminders only**) | Clearly disabled in both Web and Android UIs (`Unavailable — in-app only`); backend scheduler marks any non-`in_app` channel row `failed` with `reminder_delivery_unavailable` activity instead of silently claiming delivery |
| iOS | Excluded (`Exclude iOS completely`) | Not modified or tested |
| Live Gmail / WhatsApp / Google Drive receipt import | Adapter boundary only | Buttons explicitly disabled with `Coming soon` |

---

## Completed & Verified (`PASS`)

| Item | Verification | Status |
| --- | --- | --- |
| Shared ledger engine & all 5 split methods (`equal`, `exact`, `percentage`, `shares`, `itemwise`) | 59/59 unit & property tests (including 3,000 random ledger invariants) + 12/12 D1 integration tests | **PASS** |
| Multi-payer routing, partial/full repayments, overpayment guard & 8-way concurrency | Verified in D1 integration suite (`ledger_version` optimistic locking) + Playwright E2E + persisted D1 verification | **PASS** |
| Void repayments & audit history preservation | Clicked in Playwright E2E and verified in D1 (`status = "voided"`, obligation restored, `Delete` hidden) | **PASS** |
| Adjustments & waivers (`waived`, `discounted`, `increased`, `corrected`) | Clicked in Playwright E2E (`₹500` waiver verified as `-50000` in D1) + D1 integration test | **PASS** |
| Mark all outstanding obligations settled (`settleAll`) + idempotency key replay/conflict | Clicked in Playwright E2E and verified in D1 integration test (`replayed: true`, `409 IDEMPOTENCY_KEY_REUSED`) | **PASS** |
| Edit expense details, cancel/reopen expense, auto-cancel reminders, and guarded delete | Clicked in Playwright E2E and verified in D1 integration test | **PASS** |
| In-app reminders scheduling, cancellation, and recurring worker delivery (`backend/recurring`) | 5/5 recurring worker tests + D1 integration test + Playwright E2E | **PASS** |
| People CRUD, archive guard (`PERSON_HAS_BALANCE`), `Show archived` toggle, and restore | Clicked in Playwright E2E and verified in D1 integration test | **PASS** |
| Groups CRUD, member add/remove guard (`MEMBER_HAS_BALANCE`), `Balances` & `Settings` tabs, and `groupId` expense pre-selection | Clicked in Playwright E2E and verified across Web, Android, and D1 integration tests | **PASS** |
| Web & Android feature parity (`SplitCreateScreen`, `SplitExpenseScreen`, `SplitHistoryScreen`, `SplitPeopleScreen`, `SplitGroupsScreen`) | Full feature-by-feature parity implemented; verified via TypeScript (`0 errors`) and production builds (`next build --webpack` + `expo export --platform android`) | **PASS** |
