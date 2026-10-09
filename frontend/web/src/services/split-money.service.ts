import type {
  SplitDashboard,
  SplitExpense,
  SplitGroup,
  SplitHistory,
  SplitPerson,
} from "@hisaab/types";
import { api } from "@/lib/api-client";

function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export const splitMoneyService = {
  dashboard: () => api<SplitDashboard>("/api/v1/split-money/dashboard"),
  analytics: () => api<SplitDashboard["summary"] & { topCategories: SplitDashboard["topCategories"]; expenseCount: number }>("/api/v1/split-money/analytics"),
  history: () => api<SplitHistory>("/api/v1/split-money/history"),

  listPeople: () => api<SplitPerson[]>("/api/v1/split-money/people"),
  createPerson: (body: unknown) => post<SplitPerson>("/api/v1/split-money/people", body),
  getPerson: (id: string) =>
    api<{ person: SplitPerson; youOweMinor: number; youAreOwedMinor: number; expenses: SplitExpense[] }>(
      `/api/v1/split-money/people/${id}`,
    ),
  patchPerson: (id: string, body: unknown) =>
    patch<SplitPerson>(`/api/v1/split-money/people/${id}`, body),

  listGroups: () => api<SplitGroup[]>("/api/v1/split-money/groups"),
  createGroup: (body: unknown) => post<SplitGroup>("/api/v1/split-money/groups", body),
  getGroup: (id: string) => api<SplitGroup>(`/api/v1/split-money/groups/${id}`),
  patchGroup: (id: string, body: unknown) =>
    patch<SplitGroup>(`/api/v1/split-money/groups/${id}`, body),
  addGroupMember: (id: string, personId: string) =>
    post<SplitGroup>(`/api/v1/split-money/groups/${id}/members`, { personId }),
  removeGroupMember: (id: string, memberId: string) =>
    api<SplitGroup>(`/api/v1/split-money/groups/${id}/members/${memberId}`, { method: "DELETE" }),

  listExpenses: (params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return api<SplitExpense[]>(`/api/v1/split-money/expenses${suffix}`);
  },
  createExpense: (body: unknown) => post<SplitExpense>("/api/v1/split-money/expenses", body),
  getExpense: (id: string) => api<SplitExpense>(`/api/v1/split-money/expenses/${id}`),
  patchExpense: (id: string, body: unknown) =>
    patch<SplitExpense>(`/api/v1/split-money/expenses/${id}`, body),
  deleteExpense: (id: string) =>
    api(`/api/v1/split-money/expenses/${id}`, { method: "DELETE" }),
  recordPayment: (id: string, body: unknown) =>
    post<SplitExpense>(`/api/v1/split-money/expenses/${id}/payments`, body),
  listPayments: (id: string) => api(`/api/v1/split-money/expenses/${id}/payments`),
  createAdjustment: (id: string, body: unknown) =>
    post<SplitExpense>(`/api/v1/split-money/expenses/${id}/adjustments`, body),
  scheduleReminder: (id: string, body: unknown) =>
    post(`/api/v1/split-money/expenses/${id}/reminders`, body),
  settleExpense: (id: string) => post<SplitExpense>(`/api/v1/split-money/expenses/${id}/settle`, {}),
  simplifyExpense: (id: string) => post(`/api/v1/split-money/expenses/${id}/simplify`, {}),
  convertToLend: (id: string) => post(`/api/v1/split-money/expenses/${id}/convert-lend`, {}),
  uploadReceipt: (body: unknown) =>
    post<{
      id: string;
      fileUrl: string;
      merchant: string | null;
      receiptDate: string | null;
      subtotalMinor: number | null;
      taxMinor: number | null;
      totalMinor: number | null;
      ocrStatus: string;
    }>("/api/v1/split-money/receipts", body),
  uploadFile: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api<import("@hisaab/types").StoredFile>("/api/v1/files", { method: "POST", body });
  },
  scanReceipt: (fileId: string) =>
    post<import("@hisaab/types").OcrReceiptResult>("/api/v1/ocr/receipt", { fileId }),
  attachReceipt: (expenseId: string, fileId: string) =>
    post<import("@hisaab/types").SplitReceipt>(`/api/v1/split-money/expenses/${expenseId}/receipts`, { fileId }),
  deleteReceipt: (expenseId: string, receiptId: string) =>
    api(`/api/v1/split-money/expenses/${expenseId}/receipts/${receiptId}`, { method: "DELETE" }),
  simplifyAll: () => post("/api/v1/split-money/simplify", {}),
};
