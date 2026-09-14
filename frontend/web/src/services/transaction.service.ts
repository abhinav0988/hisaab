import type { CreditSpendImpact, Transaction } from "@hisaab/types";
import { api, apiWithMeta } from "@/lib/api-client";

export type SavedTransaction = Transaction & { credit?: CreditSpendImpact | null };

export const transactionService = {
  list: (query: string) => apiWithMeta<Transaction[]>(`/api/v1/transactions?${query}`),
  create: (body: unknown) =>
    api<SavedTransaction>("/api/v1/transactions", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api<SavedTransaction>(`/api/v1/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: string) => api(`/api/v1/transactions/${id}`, { method: "DELETE" }),
};
