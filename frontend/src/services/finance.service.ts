import type {
  CreditFacility,
  CreditFacilityKind,
  Investment,
  IpoApplication,
  LendRecord,
  Loan,
} from "@hisaab/types";
import { api } from "@/lib/api-client";

function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export const financeService = {
  listInvestments: () => api<Investment[]>("/api/v1/investments"),
  createInvestment: (body: unknown) => post<Investment>("/api/v1/investments", body),
  listIpos: () => api<IpoApplication[]>("/api/v1/ipos"),
  createIpo: (body: unknown) => post<IpoApplication>("/api/v1/ipos", body),
  listLoans: () => api<Loan[]>("/api/v1/loans"),
  createLoan: (body: unknown) => post<Loan>("/api/v1/loans", body),
  listCreditFacilities: (kind?: CreditFacilityKind) =>
    api<CreditFacility[]>(
      kind ? `/api/v1/credit-facilities?kind=${kind}` : "/api/v1/credit-facilities",
    ),
  createCreditFacility: (body: unknown) => post<CreditFacility>("/api/v1/credit-facilities", body),
  listLendRecords: () => api<LendRecord[]>("/api/v1/lend-records"),
  createLendRecord: (body: unknown) => post<LendRecord>("/api/v1/lend-records", body),
  patchLendRecord: (id: string, body: unknown) => patch<LendRecord>(`/api/v1/lend-records/${id}`, body),
};
