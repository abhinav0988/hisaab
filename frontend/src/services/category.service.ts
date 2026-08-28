import type { Category } from "@hisaab/types";
import { api } from "@/lib/api-client";

export const categoryService = {
  list: () => api<Category[]>("/api/v1/categories"),
  create: (body: unknown) =>
    api("/api/v1/categories", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/api/v1/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (id: string) => api(`/api/v1/categories/${id}`, { method: "DELETE" }),
};
