import { AppError, hashIp } from "@hisaab/worker-lib";
import { createMiddleware } from "hono/factory";

const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "X-Hisaab-Country",
];
const MAX_JSON_BODY_BYTES = 64 * 1024;
const SENSITIVE_AUTH = [
  "/sign-in",
  "/sign-up",
  "/forget-password",
  "/forgot-password",
  "/request-password-reset",
  "/reset-password",
  "/change-password",
  "send-verification-code",
  "verify-email-code",
];

export function sameOrigin(origin: string | undefined, allowed: string) {
  if (!origin || !allowed) return false;
  return origin.replace(/\/$/, "") === allowed.replace(/\/$/, "");
}

function allowedMutationOrigin(origin: string | undefined, env: Env) {
  return (
    sameOrigin(origin, env.APP_ORIGIN) || sameOrigin(origin, new URL(env.BETTER_AUTH_URL).origin)
  );
}

export function mutationIsCsrfSafe(
  method: string,
  origin: string | undefined,
  fetchSite: string | undefined,
  env: Env,
) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  const site = fetchSite?.toLowerCase();
  if (site === "cross-site") return false;
  if (origin) return allowedMutationOrigin(origin, env);
  return site === "same-origin" || site === "same-site" || site === "none";
}

function isSensitiveAuth(path: string) {
  return SENSITIVE_AUTH.some((item) => path.includes(item));
}

export const browserCors = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const origin = c.req.header("origin");
  const allowed = sameOrigin(origin, c.env.APP_ORIGIN);
  const stamp = () => {
    if (!allowed || !origin) return;
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin", { append: true });
  };
  if (c.req.method === "OPTIONS") {
    stamp();
    c.header("Access-Control-Allow-Methods", "GET,HEAD,POST,PATCH,DELETE,OPTIONS");
    c.header("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(","));
    c.header("Access-Control-Max-Age", "86400");
    c.header("Vary", "Access-Control-Request-Headers", { append: true });
    return c.body(null, 204);
  }
  try {
    await next();
  } finally {
    stamp();
  }
});

export const csrfGuard = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (
    !mutationIsCsrfSafe(c.req.method, c.req.header("origin"), c.req.header("sec-fetch-site"), c.env)
  ) {
    throw new AppError(403, "CSRF_REJECTED", "Request origin was rejected.");
  }
  await next();
});

export const bodyLimit = createMiddleware(async (c, next) => {
  if (!["POST", "PUT", "PATCH"].includes(c.req.method)) {
    await next();
    return;
  }
  const raw = c.req.header("content-length");
  if (!raw) {
    await next();
    return;
  }
  const length = Number(raw);
  if (!Number.isFinite(length) || length < 0 || length > MAX_JSON_BODY_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "This request is too large.");
  }
  await next();
});

export const rateLimit = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (c.env.E2E_DISABLE_RATE_LIMIT === "1") {
    await next();
    return;
  }
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const key = await hashIp(ip, c.env.RATE_LIMIT_SECRET);
  const authRoute = isSensitiveAuth(c.req.path);
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
});
