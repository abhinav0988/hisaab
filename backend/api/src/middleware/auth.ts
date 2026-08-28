import { createMiddleware } from "hono/factory";
import { createAuth } from "../config/auth";
import { AppError } from "../shared/errors";

type Variables = { requestId: string; userId: string; session: unknown };
export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const auth = createAuth(c.env, c.executionCtx);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    c.set("userId", session.user.id);
    c.set("session", session);
    await next();
  },
);
