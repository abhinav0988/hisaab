import { AppError, errorResponse, ok, requestContext } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { requireInternalAuth } from "./middleware/internal-auth";
import { accountRoutes } from "./routes/accounts";

type Variables = { requestId: string; userId: string };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use("*", requestContext);
app.get("/health", (c) => ok(c, { service: "hisaab-accounts", status: "ok" }));
app.use("/api/v1/*", requireInternalAuth);
app.route("/api/v1/accounts", accountRoutes);
app.notFound(() => {
  throw new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
});
app.onError((error, c) => errorResponse(c, error));
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
};
export { app };
