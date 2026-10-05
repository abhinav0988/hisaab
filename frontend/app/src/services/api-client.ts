import type { ApiResponse } from "@hisaab/types";
import { API_URL } from "../config/env";
import { extractSessionCookie, getSessionCookie, setSessionCookie } from "./session-store";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function authHeaders(init?: RequestInit): Promise<HeadersInit> {
  const cookie = await getSessionCookie();
  return {
    ...(init?.body ? { "content-type": "application/json" } : {}),
    ...(cookie ? { cookie } : {}),
    ...init?.headers,
  };
}

async function captureSession(response: Response) {
  const raw =
    response.headers.get("set-cookie") ??
    response.headers.get("Set-Cookie") ??
    // React Native sometimes exposes multiple via getSetCookie
    (typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie().join(", ")
      : null);
  const next = extractSessionCookie(raw);
  if (next) await setSessionCookie(next);
}

export async function rawFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: await authHeaders(init),
  });
  await captureSession(response);
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await rawFetch(path, init);
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    if (response.status === 401) await setSessionCookie(null);
    throw new ApiError(body.error.message, body.error.code, body.error.fieldErrors);
  }
  return body.data;
}

export async function apiWithMeta<T>(path: string, init?: RequestInit) {
  const response = await rawFetch(path, init);
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    if (response.status === 401) await setSessionCookie(null);
    throw new ApiError(body.error.message, body.error.code, body.error.fieldErrors);
  }
  return { data: body.data, meta: body.meta };
}
