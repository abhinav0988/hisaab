# Hisaab finance Worker

Internal Worker for Overview finance tools: investments, IPO applications, loans, credit facilities (cards and UPI credit), and borrow/lend records.

## Routes

| Resource | Path |
| -------- | ---- |
| Investments | `/api/v1/investments` |
| IPO applications | `/api/v1/ipos` |
| Loans | `/api/v1/loans` |
| Credit facilities | `/api/v1/credit-facilities` |
| Lend records | `/api/v1/lend-records` |

Each resource supports `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, and `DELETE /:id`. Credit facilities accept `?kind=CARD` or `?kind=UPI`.

## Bindings

D1 `hisaab` as `DB`. Tables `investments`, `ipo_applications`, `loans`, `credit_facilities`, `lend_records`.

## Local

Started by `pnpm --filter @hisaab/gateway dev`.
