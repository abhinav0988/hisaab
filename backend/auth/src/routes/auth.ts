import { Hono } from "hono";
import { AppError } from "../lib/errors";
import { createAuth } from "../config/auth";
import { hasVerifiedSignupOtp } from "../services/signup-otp";

async function withSignupCountry(request: Request) {
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.endsWith("/sign-up/email")) return request;
  if (request.headers.get("x-hisaab-country")) return request;
  try {
    const body = (await request.clone().json()) as { countryCode?: string };
    if (!body.countryCode) return request;
    const headers = new Headers(request.headers);
    headers.set("x-hisaab-country", body.countryCode);
    return new Request(request, { headers });
  } catch {
    return request;
  }
}

async function requireSignupEmailVerified(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method !== "POST" || !url.pathname.endsWith("/sign-up/email")) return;
  const body = (await request.clone().json().catch(() => null)) as { email?: string } | null;
  if (!body?.email || !(await hasVerifiedSignupOtp(env, body.email))) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email before creating your account.");
  }
}

export const authRoutes = new Hono<{ Bindings: Env }>();
authRoutes.all("/api/auth/*", async (c) => {
  const request = await withSignupCountry(c.req.raw);
  await requireSignupEmailVerified(request, c.env);
  return createAuth(c.env, c.executionCtx).handler(request);
});
