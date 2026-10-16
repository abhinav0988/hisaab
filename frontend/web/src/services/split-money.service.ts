import type {
  SplitDashboard,
  SplitExpense,
  SplitGroup,
  SplitHistory,
  SplitPerson,
} from "@hisaab/types";
import { api } from "@/lib/api-client";

function idemKey() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function post<T>(path: string, body: unknown, idempotencyKey?: string) {
  return api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}
function patch<T>(path: string, body: unknown, idempotencyKey?: string) {
  return api<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}
function put<T>(path: string, body: unknown, idempotencyKey?: string) {
  return api<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export const splitMoneyService = {
  dashboard: () => api<SplitDashboard>("/api/v1/split-money/dashboard"),
  analytics: () =>
    api<
      SplitDashboard["summary"] & {
        topCategories: SplitDashboard["topCategories"];
        expenseCount: number;
        byCurrency?: SplitDashboard["byCurrency"];
        monthly?: Array<{ month: string; amountMinor: number }>;
      }
    >("/api/v1/split-money/analytics"),
  history: () => api<SplitHistory>("/api/v1/split-money/history"),

  listPeople: (includeArchived = false) =>
    api<SplitPerson[]>(
      `/api/v1/split-money/people${includeArchived ? "?includeArchived=1" : ""}`,
    ),
  createPerson: (body: unknown, key = idemKey()) =>
    post<SplitPerson>("/api/v1/split-money/people", body, key),
  getPerson: (id: string) =>
    api<{
      person: SplitPerson;
      youOweMinor: number;
      youAreOwedMinor: number;
      currency?: string;
      balances?: Array<{ currency: string; youOweMinor: number; youAreOwedMinor: number }>;
      expenses: SplitExpense[];
    }>(`/api/v1/split-money/people/${id}`),
  patchPerson: (id: string, body: unknown) =>
    patch<SplitPerson>(`/api/v1/split-money/people/${id}`, body),
  archivePerson: (id: string) =>
    api<SplitPerson>(`/api/v1/split-money/people/${id}`, { method: "DELETE" }),
  restorePerson: (id: string) => post<SplitPerson>(`/api/v1/split-money/people/${id}/restore`, {}),

  listGroups: () => api<SplitGroup[]>("/api/v1/split-money/groups"),
  createGroup: (body: unknown, key = idemKey()) =>
    post<SplitGroup>("/api/v1/split-money/groups", body, key),
  getGroup: (id: string) => api<SplitGroup>(`/api/v1/split-money/groups/${id}`),
  patchGroup: (id: string, body: unknown) =>
    patch<SplitGroup>(`/api/v1/split-money/groups/${id}`, body),
  addGroupMember: (id: string, personId: string) =>
    post<SplitGroup>(`/api/v1/split-money/groups/${id}/members`, { personId }),
  removeGroupMember: (id: string, memberId: string) =>
    api<SplitGroup>(`/api/v1/split-money/groups/${id}/members/${memberId}`, { method: "DELETE" }),

  listExpenses: (params?: { status?: string; q?: string; groupId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    if (params?.groupId) qs.set("groupId", params.groupId);
    const suffix = qs.toString() ? `?${qs}` : "";
    return api<SplitExpense[]>(`/api/v1/split-money/expenses${suffix}`);
  },
  createExpense: (body: unknown, key = idemKey()) =>
    post<SplitExpense>("/api/v1/split-money/expenses", body, key),
  getExpense: (id: string) => api<SplitExpense>(`/api/v1/split-money/expenses/${id}`),
  patchExpense: (id: string, body: unknown, key = idemKey()) =>
    patch<SplitExpense>(`/api/v1/split-money/expenses/${id}`, body, key),
  replaceSplit: (id: string, body: unknown, key = idemKey()) =>
    put<SplitExpense>(`/api/v1/split-money/expenses/${id}/split`, body, key),
  deleteExpense: (id: string) =>
    api(`/api/v1/split-money/expenses/${id}`, { method: "DELETE" }),
  recordPayment: (id: string, body: unknown, key = idemKey()) =>
    post<SplitExpense>(`/api/v1/split-money/expenses/${id}/payments`, body, key),
  voidPayment: (id: string, paymentId: string, reason?: string | null, key = idemKey()) =>
    post<SplitExpense>(
      `/api/v1/split-money/expenses/${id}/payments/${paymentId}/void`,
      { reason: reason ?? null },
      key,
    ),
  listPayments: (id: string) => api(`/api/v1/split-money/expenses/${id}/payments`),
  createAdjustment: (id: string, body: unknown, key = idemKey()) =>
    post<SplitExpense>(`/api/v1/split-money/expenses/${id}/adjustments`, body, key),
  scheduleReminder: (id: string, body: unknown, key = idemKey()) =>
    post(`/api/v1/split-money/expenses/${id}/reminders`, body, key),
  cancelReminder: (id: string, reminderId: string) =>
    api(`/api/v1/split-money/expenses/${id}/reminders/${reminderId}`, { method: "DELETE" }),
  settleExpense: (
    id: string,
    body: { method?: string; paymentDate?: string; note?: string | null } = {},
    key = idemKey(),
  ) => post<SplitExpense>(`/api/v1/split-money/expenses/${id}/settle`, body, key),
  simplifyExpense: (id: string) => post(`/api/v1/split-money/expenses/${id}/simplify`, {}),
  convertToLend: (id: string) =>
    post<{
      expenseId: string;
      created: boolean;
      suggestions: Array<{
        person: string;
        kind: "lent" | "borrowed";
        amountMinor: number;
        givenOn: string;
        dueOn: string;
        currency: string;
        note: string;
      }>;
    }>(`/api/v1/split-money/expenses/${id}/convert-lend`, {}),
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
    post<import("@hisaab/types").SplitReceipt>(
      `/api/v1/split-money/expenses/${expenseId}/receipts`,
      { fileId },
    ),
  deleteReceipt: (expenseId: string, receiptId: string) =>
    api(`/api/v1/split-money/expenses/${expenseId}/receipts/${receiptId}`, { method: "DELETE" }),
  simplifyAll: () => post("/api/v1/split-money/simplify", {}),
};
