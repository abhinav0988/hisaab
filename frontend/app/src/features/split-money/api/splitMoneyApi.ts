import type { SplitDashboard, SplitExpense, SplitGroup, SplitHistory, SplitPerson } from "@hisaab/types";
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
  expenses: SplitExpense[];
};

const root = "/api/v1/split-money";
const post = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

/** Native adapter for the existing finance worker; it contains no business rules. */
export const splitMoneyApi = {
  dashboard: () => api<SplitDashboard>(`${root}/dashboard`),
  history: () => api<SplitHistory>(`${root}/history`),
  listExpenses: (params: { status?: string; q?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value !== undefined && query.set(key, String(value)));
    return api<SplitExpense[] | SplitExpensePage>(`${root}/expenses${query.size ? `?${query}` : ""}`);
  },
  getExpense: (id: string) => api<SplitExpense>(`${root}/expenses/${id}`),
  createExpense: (input: CreateSplitExpenseInput) => post<SplitExpense>(`${root}/expenses`, input),
  updateExpense: (id: string, input: Partial<CreateSplitExpenseInput>) => patch<SplitExpense>(`${root}/expenses/${id}`, input),
  payment: (id: string, input: RecordSplitPaymentInput) => post<SplitExpense>(`${root}/expenses/${id}/payments`, input),
  adjustment: (id: string, input: CreateSplitAdjustmentInput) => post<SplitExpense>(`${root}/expenses/${id}/adjustments`, input),
  reminder: (id: string, input: unknown) => post<unknown>(`${root}/expenses/${id}/reminders`, input),
  settle: (id: string) => post<SplitExpense>(`${root}/expenses/${id}/settle`, {}),
  simplify: (id?: string) => post<unknown>(id ? `${root}/expenses/${id}/simplify` : `${root}/simplify`, {}),
  receipt: (input: UploadSplitReceiptInput) => post<{ id: string }>(`${root}/receipts`, input),
  attachReceipt: (expenseId: string, fileId: string, description?: string) =>
    post<{ id: string; fileUrl: string }>(`${root}/expenses/${expenseId}/receipts`, { fileId, description }),
  deleteReceipt: (expenseId: string, receiptId: string) =>
    api(`${root}/expenses/${expenseId}/receipts/${receiptId}`, { method: "DELETE" }),
  people: () => api<SplitPerson[]>(`${root}/people`),
  person: (id: string) => api<SplitPersonDetails>(`${root}/people/${id}`),
  createPerson: (input: CreateSplitPersonInput) => post<SplitPerson>(`${root}/people`, input),
  updatePerson: (id: string, input: Partial<CreateSplitPersonInput>) => patch<SplitPerson>(`${root}/people/${id}`, input),
  groups: () => api<SplitGroup[]>(`${root}/groups`),
  group: (id: string) => api<SplitGroup>(`${root}/groups/${id}`),
  createGroup: (input: CreateSplitGroupInput) => post<SplitGroup>(`${root}/groups`, input),
  updateGroup: (id: string, input: Partial<CreateSplitGroupInput>) => patch<SplitGroup>(`${root}/groups/${id}`, input),
  addGroupMember: (id: string, personId: string) => post<SplitGroup>(`${root}/groups/${id}/members`, { personId }),
  removeGroupMember: (id: string, memberId: string) => api<SplitGroup>(`${root}/groups/${id}/members/${memberId}`, { method: "DELETE" }),
};
