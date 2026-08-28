import { budgetPatchSchema, budgetSchema } from "@hisaab/validation";
import { created, currentMonth, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { Hono } from "hono";
import {
  createBudget,
  deleteBudget,
  getBudget,
  listBudgets,
  updateBudget,
} from "../services/service";

export const budgetRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
budgetRoutes.get("/", async (c) =>
  ok(c, await listBudgets(c.env, c.get("userId"), c.req.query("month") ?? currentMonth("UTC"))),
);
budgetRoutes.post("/", async (c) => {
  const parsed = budgetSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createBudget(c.env, c.get("userId"), parsed.data));
});
budgetRoutes.get("/:id", async (c) =>
  ok(c, await getBudget(c.env, c.get("userId"), c.req.param("id"))),
);
budgetRoutes.patch("/:id", async (c) => {
  const parsed = budgetPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateBudget(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
budgetRoutes.delete("/:id", async (c) => {
  await deleteBudget(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
