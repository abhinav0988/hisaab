import type {
  CreditDashboard,
  CreditFacility,
  CreditFacilityKind,
  FacilityPayment,
  Investment,
  IpoApplication,
  LendRecord,
  LendRepayment,
  Loan,
  LoanPayment,
  LoanSchedule,
  UpcomingIpoFeed,
} from "@hisaab/types";
import { randomUUID } from "expo-crypto";
import { api } from "./api-client";

function post<T>(path: string, body: unknown, idempotencyKey?: string) {
  return api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}
function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export const financeService = {
  listInvestments: () => api<Investment[]>("/api/v1/investments"),
  createInvestment: (body: unknown) => post<Investment>("/api/v1/investments", body),
  updateInvestment: (id: string, body: unknown) => patch<Investment>(`/api/v1/investments/${id}`, body),
  deleteInvestment: (id: string) => api(`/api/v1/investments/${id}`, { method: "DELETE" }),
  listIpos: () => api<IpoApplication[]>("/api/v1/ipos"),
  listUpcomingIpos: () => api<UpcomingIpoFeed>("/api/v1/ipos/upcoming"),
  createIpo: (body: unknown) => post<IpoApplication>("/api/v1/ipos", body),
  updateIpo: (id: string, body: unknown) => patch<IpoApplication>(`/api/v1/ipos/${id}`, body),
  deleteIpo: (id: string) => api(`/api/v1/ipos/${id}`, { method: "DELETE" }),
  listLoans: () => api<Loan[]>("/api/v1/loans"),
  getLoan: (id: string) => api<Loan>(`/api/v1/loans/${id}`),
  createLoan: (body: unknown) => post<Loan>("/api/v1/loans", body),
  updateLoan: (id: string, body: unknown) => patch<Loan>(`/api/v1/loans/${id}`, body),
  deleteLoan: (id: string) => api(`/api/v1/loans/${id}`, { method: "DELETE" }),
  getLoanSchedule: (id: string) => api<LoanSchedule>(`/api/v1/loans/${id}/schedule`),
  payLoanEmi: (id: string, idempotencyKey = randomUUID()) => post<Loan>(`/api/v1/loans/${id}/pay`, {}, idempotencyKey),
  listLoanPayments: (id: string) => api<LoanPayment[]>(`/api/v1/loans/${id}/payments`),
  listCreditFacilities: (kind?: CreditFacilityKind) =>
    api<CreditFacility[]>(
      kind ? `/api/v1/credit-facilities?kind=${kind}` : "/api/v1/credit-facilities",
    ),
  getCreditFacility: (id: string) => api<CreditFacility>(`/api/v1/credit-facilities/${id}`),
  getCreditDashboard: () => api<CreditDashboard>("/api/v1/credit-facilities/dashboard"),
  createCreditFacility: (body: unknown) => post<CreditFacility>("/api/v1/credit-facilities", body),
  updateCreditFacility: (id: string, body: unknown) =>
    patch<CreditFacility>(`/api/v1/credit-facilities/${id}`, body),
  deleteCreditFacility: (id: string) => api(`/api/v1/credit-facilities/${id}`, { method: "DELETE" }),
  payCreditFacility: (id: string, idempotencyKey = randomUUID()) =>
    post<CreditFacility>(`/api/v1/credit-facilities/${id}/pay`, {}, idempotencyKey),
  listFacilityPayments: (id: string) => api<FacilityPayment[]>(`/api/v1/credit-facilities/${id}/payments`),
  listLendRecords: () => api<LendRecord[]>("/api/v1/lend-records"),
  getLendRecord: (id: string) => api<LendRecord>(`/api/v1/lend-records/${id}`),
  createLendRecord: (body: unknown) => post<LendRecord>("/api/v1/lend-records", body),
  patchLendRecord: (id: string, body: unknown) => patch<LendRecord>(`/api/v1/lend-records/${id}`, body),
  deleteLendRecord: (id: string) => api(`/api/v1/lend-records/${id}`, { method: "DELETE" }),
  listLendRepayments: (id: string) =>
    api<{ record: LendRecord; items: LendRepayment[] }>(`/api/v1/lend-records/${id}/repayments`),
  recordLendRepayment: (id: string, body: { amountMinor: number; paidAt?: string; note?: string | null }, idempotencyKey = randomUUID()) =>
    post<{ repayment: LendRepayment; record: LendRecord }>(`/api/v1/lend-records/${id}/repayments`, body, idempotencyKey),
  getLendReminder: (id: string) =>
    api<{
      reminder: { id: string; enabled: boolean; frequency: string; remindAt: string; lastSentAt: string | null; nextRunAt: string } | null;
      notices: Array<{ id: string; slot: string; channel: string; createdAt: string }>;
    }>(`/api/v1/lend-records/${id}/reminder`),
  putLendReminder: (id: string, body: { enabled: boolean; remindAt: string; frequency: "ONCE" | "DAILY" | "WEEKLY" | "BEFORE_DUE" }) =>
    api(`/api/v1/lend-records/${id}/reminder`, { method: "PUT", body: JSON.stringify(body) }),
  deleteLendReminder: (id: string) => api(`/api/v1/lend-records/${id}/reminder`, { method: "DELETE" }),
};
