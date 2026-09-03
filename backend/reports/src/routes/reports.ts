import { ok } from "@hisaab/worker-lib";
import { Hono } from "hono";
import {
  byAccount,
  byCategory,
  daily,
  dashboard,
  exportCsv,
  monthly,
  reportingContext,
  totals,
} from "../services/service";

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
    trend: await daily(c.env, c.get("userId"), ctx.from, ctx.to, ctx.timezone),
  });
});
reportRoutes.get("/reports/monthly", async (c) => {
  const ctx = await reportingContext(c.env, c.get("userId"));
  const accountIds = c.req
    .query("accountIds")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return ok(
    c,
    await monthly(
      c.env,
      c.get("userId"),
      ctx.timezone,
      c.req.query("from"),
      c.req.query("to"),
      accountIds,
    ),
  );
});
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
