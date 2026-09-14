import type { Account, AccountCatalogItem } from "@hisaab/types";
import { api } from "@/lib/api-client";

export const accountService = {
  catalog: () => api<AccountCatalogItem[]>("/api/v1/accounts/catalog"),
  list: () => api<Account[]>("/api/v1/accounts"),
  listBanks: () => api<Account[]>("/api/v1/accounts/banks"),
  createBank: (body: unknown) =>
    api<Account>("/api/v1/accounts/banks", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: unknown) =>
    api(`/api/v1/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
