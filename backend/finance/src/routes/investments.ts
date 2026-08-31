import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { investmentPatchSchema, investmentSchema } from "@hisaab/validation";
import { Hono } from "hono";
import {
  createInvestment,
  deleteInvestment,
  getInvestment,
  listInvestments,
  updateInvestment,
} from "../services/service";

export const investmentRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
investmentRoutes.get("/", async (c) => ok(c, await listInvestments(c.env, c.get("userId"))));
investmentRoutes.post("/", async (c) => {
  const parsed = investmentSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createInvestment(c.env, c.get("userId"), parsed.data));
});
investmentRoutes.get("/:id", async (c) => ok(c, await getInvestment(c.env, c.get("userId"), c.req.param("id"))));
investmentRoutes.patch("/:id", async (c) => {
  const parsed = investmentPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateInvestment(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
investmentRoutes.delete("/:id", async (c) => {
  await deleteInvestment(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
