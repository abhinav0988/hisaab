import { Hono } from "hono";
import { createAuth } from "../config/auth";
import { AppError } from "../lib/errors";
import { ok } from "../lib/http";
import { internalOnly } from "../middleware/internal-only";

export const sessionRoutes = new Hono<{ Bindings: Env }>();
sessionRoutes.use("*", internalOnly);
sessionRoutes.get("/", async (c) => {
  const session = await createAuth(c.env, c.executionCtx).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return ok(c, { userId: session.user.id, session });
});
