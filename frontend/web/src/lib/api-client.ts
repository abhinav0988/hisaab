import type { ApiResponse } from "@hisaab/types";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success)
    throw new ApiError(body.error.message, body.error.code, body.error.fieldErrors);
  return body.data;
}
export async function apiWithMeta<T>(path: string) {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success)
    throw new ApiError(body.error.message, body.error.code, body.error.fieldErrors);
  return { data: body.data, meta: body.meta };
}
