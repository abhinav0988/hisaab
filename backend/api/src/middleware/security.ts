import { createMiddleware } from "hono/factory";
import { AppError } from "../shared/errors";
import { hashIp } from "../shared/http";

type Variables = { requestId: string; userId: string; session: unknown };
export const requestContext = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const requestId = c.req.header("cf-ray") ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    c.header("x-content-type-options", "nosniff");
    c.header("x-frame-options", "DENY");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
    c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    c.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    await next();
  },
);

export const csrfGuard = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin && origin !== c.env.APP_ORIGIN && origin !== new URL(c.env.BETTER_AUTH_URL).origin)
      throw new AppError(403, "CSRF_REJECTED", "Request origin was rejected.");
  }
  await next();
});

export const rateLimit = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    const key = await hashIp(ip, c.env.BETTER_AUTH_SECRET);
    const authRoute = c.req.path.includes("/sign-in") || c.req.path.includes("/forgot-password");
    const windowSeconds = authRoute ? 900 : 60;
    const maximum = authRoute ? 10 : 120;
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const result = await c.env.DB.prepare(
      "INSERT INTO api_rate_limits (key, bucket, count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT(key, bucket) DO UPDATE SET count = count + 1 RETURNING count",
    )
      .bind(key, bucket, new Date((bucket + 2) * windowSeconds * 1000).toISOString())
      .first<{ count: number }>();
    if ((result?.count ?? 1) > maximum)
      throw new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
    await next();
  },
);
