import { api } from "@/lib/api-client";
import type { Profile } from "@hisaab/types";

export type { Profile };

export const profileService = {
  get: () => api<Profile>("/api/v1/profile"),
  update: (body: unknown) =>
    api("/api/v1/profile", { method: "PATCH", body: JSON.stringify(body) }),
};
