# Split Money — Financial Fixes

## Central ledger

| Item | Detail |
| --- | --- |
| Feature | Deterministic split ledger |
| Previous | Pending share treated as debt to first payer; self share counted as external debt |
| Root cause | No net-position / obligation matching; UI used participant.pending as UI debt |
| Files | `packages/validation/src/split-ledger.ts`, `backend/finance/src/services/split-money.ts`, web/app expense UIs |
| New behaviour | Upfront ≠ repayment; obligations are debtor→creditor edges; collectible excludes self absorption of own share |
| Tests | `split-ledger.test.ts` (19) + property 3000; finance integration 5 |
| Result | **PASS** |
| Status | **PASS** |

---

## Fix log

### 1. Collectible / remaining / progress

- **Previous:** Progress often used expense total.
- **Root cause:** Confusing bill total with collectible repayment.
- **New:** `ledger.collectibleMinor`, `collectedMinor`, `remainingMinor`, percent from collectible.
- **Tests:** Integration single-payer + multi-payer.
- **Status:** **PASS**

### 2. Multi-payer routing

- **Previous:** All repayments targeted first payer.
- **Root cause:** No creditor matching.
- **New:** `matchPositions` → obligations; payment validates edge via `checkRepayment`.
- **Tests:** Integration routes Priya→Rahul ₹100 then leaves Priya→You ₹300.
- **Status:** **PASS**

### 3. Idempotency + concurrency

- **Previous:** Double-click / retry could double-pay; settle-all partial.
- **Root cause:** Weak key handling; settle loop without atomic version gate.
- **Files:** `idempotency.ts` (`request_hash`), `ledger_version` in migration 0018, `settleAll` batch.
- **Tests:** Replay identical key; 8 concurrent pays.
- **Status:** **PASS**

### 4. Adjustments / absorption

- **Previous:** Web always reduced; discounts left unbalanced ledger.
- **Root cause:** No direction; no absorption of shortfall onto payers.
- **New:** Signed adjustment amounts; absorption proportional to upfront.
- **Tests:** Unit ledger tests include adjustments; UI direction wired.
- **Status:** Unit **PASS**; UI e2e **NOT TESTED**

### 5. Dashboard fake percentages

- **Previous:** Hard-coded receive/pay/pending change %.
- **New:** `null` for those fields; settlement % from ledger totals over all active expenses.
- **Tests:** Integration dashboard assertions.
- **Status:** **PASS**

### 6. Delete / archive

- **Previous:** Hard delete could erase history.
- **New:** Delete blocked when payments/adjustments exist; people soft-archived via `archived_at`.
- **Status:** Code **PASS**; UI archive flow **NOT TESTED**

### 7. Currency in simplify

- **Previous:** Edges from mixed currencies could merge.
- **New:** `byCurrency` map before `simplifyDebts`.
- **Status:** Code **PASS**; runtime UI **NOT TESTED**

---

## Invariants enforced in tests

1. Sum of shares = expense total (after allocation helpers).
2. Sum of upfront = expense total (create validation).
3. Total credits = total debts per currency.
4. No self-obligation edges.
5. Repayment reduces matching obligation only.
6. Rounding remainders allocated (largest remainder).
7. Over-obligation payments rejected.
8. Idempotent replay returns same logical payment count.
