import { Hono } from "hono";
import { ok } from "../../shared/http";
import {
  byAccount,
  byCategory,
  daily,
  dashboard,
  exportCsv,
  monthly,
  reportingContext,
  totals,
} from "./service";
export const reportRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
reportRoutes.get("/dashboard/summary", async (c) => ok(c, await dashboard(c.env, c.get("userId"))));
reportRoutes.get("/reports/daily", async (c) => {
  const ctx = await reportingContext(
    c.env,
    c.get("userId"),
    c.req.query("from"),
    c.req.query("to"),
  );
  return ok(c, {
    ...(await totals(c.env, c.get("userId"), ctx.from, ctx.to)),
    trend: await daily(c.env, c.get("userId"), ctx.from, ctx.to),
  });
});
reportRoutes.get("/reports/monthly", async (c) => ok(c, await monthly(c.env, c.get("userId"))));
reportRoutes.get("/reports/categories", async (c) => {
  const ctx = await reportingContext(
    c.env,
    c.get("userId"),
    c.req.query("from"),
    c.req.query("to"),
  );
  return ok(c, await byCategory(c.env, c.get("userId"), ctx.from, ctx.to));
});
reportRoutes.get("/reports/accounts", async (c) => {
  const ctx = await reportingContext(
    c.env,
    c.get("userId"),
    c.req.query("from"),
    c.req.query("to"),
  );
  return ok(c, await byAccount(c.env, c.get("userId"), ctx.from, ctx.to));
});
reportRoutes.get("/reports/export.csv", async (c) => {
  const ctx = await reportingContext(
    c.env,
    c.get("userId"),
    c.req.query("from"),
    c.req.query("to"),
  );
  return c.body(await exportCsv(c.env, c.get("userId"), ctx.from, ctx.to), 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="hisaab-${ctx.from.slice(0, 10)}-${ctx.to.slice(0, 10)}.csv"`,
  });
});
