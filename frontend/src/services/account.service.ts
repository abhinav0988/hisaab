import type { Account } from "@hisaab/types";
import { api } from "@/lib/api-client";

export const accountService = {
  list: () => api<Account[]>("/api/v1/accounts"),
  create: (body: unknown) =>
    api("/api/v1/accounts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/api/v1/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
