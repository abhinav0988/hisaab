import { requestContext } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { AppError, errorResponse } from "./lib/errors";
import { ok } from "./lib/http";
import { otpRoutes } from "./routes/otp";
import { authRoutes } from "./routes/auth";
import { sessionRoutes } from "./routes/session";

type Variables = { requestId: string };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", requestContext);
app.get("/health", (c) => ok(c, { service: "hisaab-auth", status: "ok" }));
app.route("/", otpRoutes);
app.route("/", authRoutes);
app.route("/internal/session", sessionRoutes);
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
