import { AppError, errorResponse, ok, requestContext } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { requireInternalAuth } from "./middleware/internal-auth";
import { budgetRoutes } from "./routes/budgets";
import { goalRoutes } from "./routes/goals";

type Variables = { requestId: string; userId: string };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use("*", requestContext);
app.get("/health", (c) => ok(c, { service: "hisaab-budgets", status: "ok" }));
app.use("/api/v1/*", requireInternalAuth);
app.route("/api/v1/budgets", budgetRoutes);
app.route("/api/v1/goals", goalRoutes);
app.notFound(() => {
  throw new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
});
app.onError((error, c) => errorResponse(c, error));
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
};
export { app };
