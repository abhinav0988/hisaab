import { AppError, errorResponse, ok, requestContext } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { requireInternalAuth } from "./middleware/internal-auth";
import { creditFacilityRoutes } from "./routes/credit-facilities";
import { investmentRoutes } from "./routes/investments";
import { ipoRoutes } from "./routes/ipos";
import { lendRecordRoutes } from "./routes/lend-records";
import { loanRoutes } from "./routes/loans";

type Variables = { requestId: string; userId: string };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();
app.use("*", requestContext);
app.get("/health", (c) => ok(c, { service: "hisaab-finance", status: "ok" }));
app.use("/api/v1/*", requireInternalAuth);
app.route("/api/v1/investments", investmentRoutes);
app.route("/api/v1/ipos", ipoRoutes);
app.route("/api/v1/loans", loanRoutes);
app.route("/api/v1/credit-facilities", creditFacilityRoutes);
app.route("/api/v1/lend-records", lendRecordRoutes);
app.notFound(() => {
  throw new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
});
app.onError((error, c) => errorResponse(c, error));
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
};
export { app };
