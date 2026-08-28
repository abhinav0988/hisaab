import type { GoalContribution, SavingsGoal } from "@hisaab/types";
import { api } from "@/lib/api-client";

export const goalService = {
  list: () => api<SavingsGoal[]>("/api/v1/goals"),
  create: (body: unknown) => api<SavingsGoal>("/api/v1/goals", { method: "POST", body: JSON.stringify(body) }),
  contributions: () => api<GoalContribution[]>("/api/v1/goals/contributions"),
  contribute: (id: string, body: unknown) =>
    api(`/api/v1/goals/${id}/contributions`, { method: "POST", body: JSON.stringify(body) }),
};
