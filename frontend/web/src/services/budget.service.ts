import type { Budget } from "@hisaab/types";
import { api } from "@/lib/api-client";

export const budgetService = {
  list: (month: string) => api<Budget[]>(`/api/v1/budgets?month=${month}`),
  create: (body: unknown) => api("/api/v1/budgets", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/api/v1/budgets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => api(`/api/v1/budgets/${id}`, { method: "DELETE" }),
};
