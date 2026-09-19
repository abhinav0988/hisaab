import type { ApiResponse } from "@hisaab/types";
import { API_URL } from "../config/env";

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
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new ApiError(body.error.message, body.error.code, body.error.fieldErrors);
  }
  return body.data;
}
