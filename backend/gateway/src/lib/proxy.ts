import { INTERNAL_HEADER, INTERNAL_HEADER_VALUE, USER_ID_HEADER } from "@hisaab/worker-lib";
import type { Context } from "hono";

export function proxyTo(fetcher: Fetcher, request: Request, userId?: string) {
  const headers = new Headers(request.headers);
  headers.delete(INTERNAL_HEADER);
  headers.delete(USER_ID_HEADER);
  if (userId) {
    headers.set(INTERNAL_HEADER, INTERNAL_HEADER_VALUE);
    headers.set(USER_ID_HEADER, userId);
  }
  return fetcher.fetch(new Request(request, { headers, redirect: "manual" }));
}

export function domainFetcher(env: Env, path: string): Fetcher | null {
  if (path.startsWith("/api/v1/profile")) return env.PROFILE;
  if (path.startsWith("/api/v1/accounts")) return env.ACCOUNTS;
  if (path.startsWith("/api/v1/categories")) return env.CATEGORIES;
  if (path.startsWith("/api/v1/transactions")) return env.TRANSACTIONS;
  if (path.startsWith("/api/v1/budgets") || path.startsWith("/api/v1/goals")) return env.BUDGETS;
  if (path.startsWith("/api/v1/recurring-transactions")) return env.RECURRING;
  if (
    path.startsWith("/api/v1/investments") ||
    path.startsWith("/api/v1/ipos") ||
    path.startsWith("/api/v1/loans") ||
    path.startsWith("/api/v1/credit-facilities") ||
    path.startsWith("/api/v1/lend-records")
  )
    return env.FINANCE;
  if (path.startsWith("/api/v1/dashboard") || path.startsWith("/api/v1/reports"))
    return env.REPORTS;
  return null;
}

export async function resolveUserId(
  c: Context<{ Bindings: Env; Variables: { requestId: string } }>,
) {
  const headers = new Headers();
  const cookie = c.req.header("cookie");
  if (cookie) headers.set("cookie", cookie);
  headers.set(INTERNAL_HEADER, INTERNAL_HEADER_VALUE);
  const response = await c.env.AUTH.fetch(
    new Request(new URL("/internal/session", c.req.url), { method: "GET", headers }),
  );
  if (!response.ok) return { response };
  const body = (await response.json()) as { data?: { userId?: string } };
  const userId = body.data?.userId;
  if (!userId) return {};
  return { userId };
}
