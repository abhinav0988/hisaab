import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./config/auth";
import { accountRoutes } from "./modules/accounts/routes";
import { budgetRoutes } from "./modules/budgets/routes";
import { categoryRoutes } from "./modules/categories/routes";
import { profileRoutes } from "./modules/profile/routes";
import { recurringRoutes } from "./modules/recurring-transactions/routes";
import { processRecurring } from "./modules/recurring-transactions/service";
import { reportRoutes } from "./modules/reports/routes";
import { transactionRoutes } from "./modules/transactions/routes";
import { requireAuth } from "./middleware/auth";
import { csrfGuard, rateLimit, requestContext } from "./middleware/security";
import { AppError, errorResponse } from "./shared/errors";
import { ok } from "./shared/http";

type Variables = { requestId: string; userId: string; session: unknown };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", requestContext);
app.use("/api/*", async (c, next) =>
  cors({
    origin: (origin) => (origin === c.env.APP_ORIGIN ? origin : ""),
    credentials: true,
    allowHeaders: ["Content-Type", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })(c, next),
);
app.use("/api/*", csrfGuard);
app.use("/api/*", rateLimit);

app.get("/health", (c) => ok(c, { service: "hisaab-api", status: "ok" }));
app.all("/api/auth/*", (c) => createAuth(c.env, c.executionCtx).handler(c.req.raw));

app.use("/api/v1/*", requireAuth);
app.route("/api/v1/profile", profileRoutes);
app.route("/api/v1/accounts", accountRoutes);
app.route("/api/v1/categories", categoryRoutes);
app.route("/api/v1/transactions", transactionRoutes);
app.route("/api/v1/budgets", budgetRoutes);
app.route("/api/v1/recurring-transactions", recurringRoutes);
app.route("/api/v1", reportRoutes);

app.notFound(() => {
  throw new AppError(404, "ROUTE_NOT_FOUND", "The requested endpoint does not exist.");
});
app.onError((error, c) => errorResponse(c, error));

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const job = processRecurring(env, new Date(controller.scheduledTime));
    const cleanup = env.DB.prepare("DELETE FROM api_rate_limits WHERE expires_at < ?")
      .bind(new Date().toISOString())
      .run();
    ctx.waitUntil(Promise.all([job, cleanup]));
  },
} satisfies ExportedHandler<Env>;

export { app };
