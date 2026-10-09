import type { ApiResponse, ClientPlatform, SalesChannel } from "@hisaab/types";
import { Platform } from "react-native";
import { API_URL, APP_VERSION, REQUEST_TIMEOUT_MS } from "../config/env";
import { notifyUnauthorized } from "./session-events";
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

function platformHeader(): ClientPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

async function authHeaders(init?: RequestInit): Promise<HeadersInit> {
  const cookie = await getSessionCookie();
  const formData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  return {
    ...init?.headers,
    ...(init?.body && !formData ? { "content-type": "application/json" } : {}),
    ...(cookie ? { cookie } : {}),
    "X-Sales-Channel": "APP" satisfies SalesChannel,
    "X-Client-Platform": platformHeader(),
    "X-App-Version": APP_VERSION,
    ...(Platform.OS === "web" ? {} : { Origin: "hisaab://app" }),
  };
}

export async function requestHeaders(): Promise<Record<string, string>> {
  return (await authHeaders()) as Record<string, string>;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: await authHeaders(init),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The request timed out. Check your connection and try again.", "TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  await captureSession(response);
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await rawFetch(path, init);
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    if (response.status === 401) {
      await setSessionCookie(null);
      notifyUnauthorized();
    }
    throw new ApiError(body.error.message, body.error.code, body.error.fieldErrors);
  }
  return body.data;
}

export async function apiWithMeta<T>(path: string, init?: RequestInit) {
  const response = await rawFetch(path, init);
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    if (response.status === 401) {
      await setSessionCookie(null);
      notifyUnauthorized();
    }
    throw new ApiError(body.error.message, body.error.code, body.error.fieldErrors);
  }
  return { data: body.data, meta: body.meta };
}
