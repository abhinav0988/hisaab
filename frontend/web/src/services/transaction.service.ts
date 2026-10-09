import type { CreditSpendImpact, Transaction, TransactionAttachment, Tag } from "@hisaab/types";
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
  listTags: () => api<Tag[]>("/api/v1/tags"),
  createTag: (name: string) => api<Tag>("/api/v1/tags", { method: "POST", body: JSON.stringify({ name }) }),
  listAttachments: (id: string) => api<TransactionAttachment[]>(`/api/v1/transactions/${id}/attachments`),
  attach: (id: string, fileId: string) =>
    api<TransactionAttachment>(`/api/v1/transactions/${id}/attachments`, { method: "POST", body: JSON.stringify({ fileId }) }),
  removeAttachment: (id: string, attachmentId: string) =>
    api(`/api/v1/transactions/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
};
