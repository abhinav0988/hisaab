import { goalContributionSchema, goalPatchSchema, goalSchema } from "@hisaab/validation";
import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { Hono } from "hono";
import {
  addContribution,
  createGoal,
  deleteGoal,
  listContributions,
  listGoals,
  updateGoal,
} from "../services/goals";

export const goalRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
goalRoutes.get("/", async (c) => ok(c, await listGoals(c.env, c.get("userId"))));
goalRoutes.post("/", async (c) => {
  const parsed = goalSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createGoal(c.env, c.get("userId"), parsed.data));
});
goalRoutes.get("/contributions", async (c) =>
  ok(c, await listContributions(c.env, c.get("userId"))),
);
goalRoutes.patch("/:id", async (c) => {
  const parsed = goalPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateGoal(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
goalRoutes.delete("/:id", async (c) => {
  await deleteGoal(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
goalRoutes.post("/:id/contributions", async (c) => {
  const parsed = goalContributionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await addContribution(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
