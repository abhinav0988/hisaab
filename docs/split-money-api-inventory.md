# Split Money API inventory

All routes are authenticated (`/api/v1/*` gateway session resolution followed by internal-worker authentication), return the standard `ApiResponse<T>` envelope, and are implemented by `backend/finance/src/routes/split-money.ts`.

| Method | Path | Request validation / behavior | Response |
| --- | --- | --- | --- |
| GET | `/api/v1/split-money/dashboard` | None; server aggregation | `SplitDashboard` |
| GET | `/api/v1/split-money/analytics` | None | server analytics object |
| GET | `/api/v1/split-money/history` | None | `SplitHistory` |
| GET/POST | `/people` | POST `splitPersonSchema` | `SplitPerson[]` / `SplitPerson` |
| GET/PATCH | `/people/:id` | PATCH `splitPersonPatchSchema` | person detail / `SplitPerson` |
| GET/POST | `/groups` | POST `splitGroupSchema` | `SplitGroup[]` / `SplitGroup` |
| GET/PATCH | `/groups/:id` | PATCH `splitGroupPatchSchema` | group detail / `SplitGroup` |
| POST | `/groups/:id/members` | `{ personId }` | updated group |
| DELETE | `/groups/:id/members/:memberId` | None | updated group |
| GET/POST | `/expenses` | GET supports `status`, `q`, `limit`, `offset`; POST `splitExpenseSchema` | expense list / `SplitExpense` |
| GET/PATCH/DELETE | `/expenses/:id` | PATCH `splitExpensePatchSchema` | detail / updated / no content |
| GET/POST | `/expenses/:id/payments` | POST `splitPaymentSchema`; ledger entries are append-only | payment list / updated `SplitExpense` |
| POST | `/expenses/:id/adjustments` | `splitAdjustmentSchema` | updated `SplitExpense` |
| POST | `/expenses/:id/reminders` | channel, schedule, optional participant/frequency/message | reminder |
| POST | `/expenses/:id/settle` | Server records remaining participant payments | updated `SplitExpense` |
| POST | `/expenses/:id/simplify` | None | settlement suggestions |
| POST | `/expenses/:id/convert-lend` | None | conversion result |
| POST | `/receipts` | `splitReceiptUploadSchema`—metadata only, not file bytes | receipt record |
| POST | `/simplify` | None | global settlement suggestions |

The native client currently uses dashboard, history, people, groups, expense create/detail, payment, settlement, adjustment, reminder, receipt, and simplify adapters. The UI only activates flows whose current screen has enough native interaction to provide all required request fields.
