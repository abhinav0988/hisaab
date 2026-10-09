import { API_URL } from "../config/env";
import { api, rawFetch } from "./api-client";

export type DailyReport = {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  averageDailySpending: number;
  trend: Array<{ date: string; income: number; expense: number }>;
};

export type ReportBreakdown = Array<{ id: string; name: string; value: number; colour?: string }>;

export const reportService = {
  daily: (range: string) => api<DailyReport>(`/api/v1/reports/daily?${range}`),
  monthly: (range?: string) =>
    api<Array<{ month: string; income: number; expense: number }>>(
      range ? `/api/v1/reports/monthly?${range}` : "/api/v1/reports/monthly",
    ),
  categories: (range: string) => api<ReportBreakdown>(`/api/v1/reports/categories?${range}`),
  accounts: (range: string) => api<ReportBreakdown>(`/api/v1/reports/accounts?${range}`),
  exportUrl: (range: string) => `${API_URL}/api/v1/reports/export.csv?${range}`,
  exportCsv: async (range: string) => {
    const response = await rawFetch(`/api/v1/reports/export.csv?${range}`);
    if (!response.ok) throw new Error("Could not export transactions.");
    return response.text();
  },
};
