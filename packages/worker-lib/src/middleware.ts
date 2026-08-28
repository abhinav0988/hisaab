import { createMiddleware } from "hono/factory";
import { INTERNAL_HEADER, INTERNAL_HEADER_VALUE, USER_ID_HEADER } from "./constants";
import { AppError } from "./errors";

type Variables = { requestId: string; userId: string };

export const requestContext = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const requestId = c.req.header("cf-ray") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);
  c.header("x-content-type-options", "nosniff");
  c.header("x-frame-options", "DENY");
  c.header("referrer-policy", "strict-origin-when-cross-origin");
  c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
  c.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  await next();
});

export const requireInternal = createMiddleware(async (c, next) => {
  if (c.req.header(INTERNAL_HEADER) !== INTERNAL_HEADER_VALUE)
    throw new AppError(403, "INTERNAL_ONLY", "This endpoint is not public.");
  await next();
});

export const requireInternalUser = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (c.req.header(INTERNAL_HEADER) !== INTERNAL_HEADER_VALUE)
    throw new AppError(403, "INTERNAL_ONLY", "This endpoint is not public.");
  const userId = c.req.header(USER_ID_HEADER);
  if (!userId) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  c.set("userId", userId);
  await next();
});
