import { api } from "@/lib/api-client";

export const recurringService = {
  list: <T>() => api<T[]>("/api/v1/recurring-transactions"),
  create: (body: unknown) =>
    api("/api/v1/recurring-transactions", { method: "POST", body: JSON.stringify(body) }),
  pause: (id: string) => api(`/api/v1/recurring-transactions/${id}/pause`, { method: "POST" }),
  resume: (id: string) => api(`/api/v1/recurring-transactions/${id}/resume`, { method: "POST" }),
  remove: (id: string) => api(`/api/v1/recurring-transactions/${id}`, { method: "DELETE" }),
};
