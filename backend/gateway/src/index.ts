import { AppError, errorResponse, ok, requestContext } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { domainFetcher, proxyTo, resolveUserId } from "./lib/proxy";
import { bodyLimit, browserCors, csrfGuard, rateLimit } from "./middleware/security";

type Variables = { requestId: string };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", requestContext);
app.use("*", async (c, next) => {
  if (c.env.ENVIRONMENT === "production") {
    c.header("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  await next();
});
app.use("/api/*", browserCors);
app.use("/api/*", csrfGuard);
app.use("/api/*", bodyLimit);
app.use("/api/*", rateLimit);

app.get("/health", (c) => ok(c, { service: "hisaab-gateway", status: "ok" }));

app.all("/api/auth/*", (c) => proxyTo(c.env.AUTH, c.req.raw));

app.all("/api/v1/*", async (c) => {
  const session = await resolveUserId(c);
  if (!session.userId) {
    if (session.response) return session.response;
    throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }
  const target = domainFetcher(c.env, c.req.path);
  if (!target) throw new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
  return proxyTo(target, c.req.raw, session.userId);
});

app.notFound(() => {
  throw new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
});
app.onError((error, c) => errorResponse(c, error));

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
export { app };
