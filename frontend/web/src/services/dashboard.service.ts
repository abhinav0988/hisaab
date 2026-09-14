import type { DashboardSummary } from "@hisaab/types";
import { api } from "@/lib/api-client";

export const dashboardService = {
  summary: () => api<DashboardSummary & { currency: string }>("/api/v1/dashboard/summary"),
};
