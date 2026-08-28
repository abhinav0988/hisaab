import { Hono } from "hono";
import { createAuth } from "../config/auth";

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

export const authRoutes = new Hono<{ Bindings: Env }>();
authRoutes.all("/api/auth/*", async (c) =>
  createAuth(c.env, c.executionCtx).handler(await withSignupCountry(c.req.raw)),
);
