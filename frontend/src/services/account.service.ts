import type { Account, AccountCatalogItem } from "@hisaab/types";
import { api } from "@/lib/api-client";

export const accountService = {
  catalog: () => api<AccountCatalogItem[]>("/api/v1/accounts/catalog"),
  list: () => api<Account[]>("/api/v1/accounts"),
  update: (id: string, body: unknown) =>
    api(`/api/v1/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
