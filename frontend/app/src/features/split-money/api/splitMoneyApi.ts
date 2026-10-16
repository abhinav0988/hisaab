import type { SplitDashboard, SplitExpense, SplitGroup, SplitHistory, SplitPerson } from "@hisaab/types";
import { randomUUID } from "expo-crypto";
import { api } from "../../../services/api-client";
import type {
  CreateSplitAdjustmentInput,
  CreateSplitExpenseInput,
  CreateSplitGroupInput,
  CreateSplitPersonInput,
  RecordSplitPaymentInput,
  SplitExpensePage,
  UploadSplitReceiptInput,
} from "./splitMoneyTypes";

export type SplitPersonDetails = {
  person: SplitPerson;
  youOweMinor: number;
  youAreOwedMinor: number;
  currency?: string;
  balances?: Array<{ currency: string; youOweMinor: number; youAreOwedMinor: number }>;
  expenses: SplitExpense[];
};

/** Mirrors `splitExpensePatchSchema`: metadata only; amounts/shares are financial history. */
export type SplitExpensePatch = {
  title?: string;
  description?: string | null;
  category?: string;
  dueDate?: string | null;
  noteForParticipants?: string | null;
  /** "cancelled" cancels; any other status reopens. */
  status?: string;
  /** Send false to publish a draft. */
  isDraft?: false;
  sendNotifications?: boolean;
  allowPartialPayments?: boolean;
};

const root = "/api/v1/split-money";
const idemKey = () => randomUUID().replace(/-/g, "").slice(0, 24);

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

/** Native adapter for the existing finance worker; it contains no business rules. */
export const splitMoneyApi = {
  dashboard: () => api<SplitDashboard>(`${root}/dashboard`),
  history: () => api<SplitHistory>(`${root}/history`),
  listExpenses: (params: { status?: string; q?: string; limit?: number; offset?: number; groupId?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value !== undefined && query.set(key, String(value)));
    return api<SplitExpense[] | SplitExpensePage>(`${root}/expenses${query.size ? `?${query}` : ""}`);
  },
  getExpense: (id: string) => api<SplitExpense>(`${root}/expenses/${id}`),
  createExpense: (input: CreateSplitExpenseInput, key = idemKey()) =>
    post<SplitExpense>(`${root}/expenses`, input, key),
  updateExpense: (id: string, input: SplitExpensePatch, key = idemKey()) =>
    patch<SplitExpense>(`${root}/expenses/${id}`, input, key),
  deleteExpense: (id: string) => api<unknown>(`${root}/expenses/${id}`, { method: "DELETE" }),
  replaceSplit: (id: string, input: unknown, key = idemKey()) =>
    put<SplitExpense>(`${root}/expenses/${id}/split`, input, key),
  payment: (id: string, input: RecordSplitPaymentInput, key = idemKey()) =>
    post<SplitExpense>(`${root}/expenses/${id}/payments`, input, key),
  voidPayment: (id: string, paymentId: string, reason?: string | null, key = idemKey()) =>
    post<SplitExpense>(`${root}/expenses/${id}/payments/${paymentId}/void`, { reason: reason ?? null }, key),
  adjustment: (id: string, input: CreateSplitAdjustmentInput, key = idemKey()) =>
    post<SplitExpense>(`${root}/expenses/${id}/adjustments`, input, key),
  reminder: (id: string, input: unknown, key = idemKey()) =>
    post<unknown>(`${root}/expenses/${id}/reminders`, input, key),
  cancelReminder: (id: string, reminderId: string) =>
    api(`${root}/expenses/${id}/reminders/${reminderId}`, { method: "DELETE" }),
  settle: (
    id: string,
    body: { method?: string; paymentDate?: string; note?: string | null } = {},
    key = idemKey(),
  ) => post<SplitExpense>(`${root}/expenses/${id}/settle`, body, key),
  simplify: (id?: string) => post<unknown>(id ? `${root}/expenses/${id}/simplify` : `${root}/simplify`, {}),
  convertToLend: (id: string) =>
    post<{ expenseId: string; created: boolean; suggestions: unknown[] }>(
      `${root}/expenses/${id}/convert-lend`,
      {},
    ),
  receipt: (input: UploadSplitReceiptInput) => post<{ id: string }>(`${root}/receipts`, input),
  attachReceipt: (expenseId: string, fileId: string, description?: string) =>
    post<{ id: string; fileUrl: string }>(`${root}/expenses/${expenseId}/receipts`, { fileId, description }),
  deleteReceipt: (expenseId: string, receiptId: string) =>
    api(`${root}/expenses/${expenseId}/receipts/${receiptId}`, { method: "DELETE" }),
  people: (includeArchived = false) =>
    api<SplitPerson[]>(`${root}/people${includeArchived ? "?includeArchived=1" : ""}`),
  person: (id: string) => api<SplitPersonDetails>(`${root}/people/${id}`),
  createPerson: (input: CreateSplitPersonInput, key = idemKey()) =>
    post<SplitPerson>(`${root}/people`, input, key),
  updatePerson: (id: string, input: Partial<CreateSplitPersonInput>) =>
    patch<SplitPerson>(`${root}/people/${id}`, input),
  archivePerson: (id: string) => api<SplitPerson>(`${root}/people/${id}`, { method: "DELETE" }),
  restorePerson: (id: string) => post<SplitPerson>(`${root}/people/${id}/restore`, {}),
  groups: () => api<SplitGroup[]>(`${root}/groups`),
  group: (id: string) => api<SplitGroup>(`${root}/groups/${id}`),
  createGroup: (input: CreateSplitGroupInput, key = idemKey()) =>
    post<SplitGroup>(`${root}/groups`, input, key),
  updateGroup: (id: string, input: Partial<CreateSplitGroupInput>) =>
    patch<SplitGroup>(`${root}/groups/${id}`, input),
  addGroupMember: (id: string, personId: string) =>
    post<SplitGroup>(`${root}/groups/${id}/members`, { personId }),
  removeGroupMember: (id: string, memberId: string) =>
    api<SplitGroup>(`${root}/groups/${id}/members/${memberId}`, { method: "DELETE" }),
};
