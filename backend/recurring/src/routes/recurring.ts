import { recurringPatchSchema, recurringSchema } from "@hisaab/validation";
import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { Hono } from "hono";
import {
  createRecurring,
  deleteRecurring,
  listRecurring,
  setRecurringActive,
  updateRecurring,
} from "../services/service";

export const recurringRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
recurringRoutes.get("/", async (c) => ok(c, await listRecurring(c.env, c.get("userId"))));
recurringRoutes.post("/", async (c) => {
  const parsed = recurringSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createRecurring(c.env, c.get("userId"), parsed.data));
});
recurringRoutes.patch("/:id", async (c) => {
  const parsed = recurringPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateRecurring(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
recurringRoutes.delete("/:id", async (c) => {
  await deleteRecurring(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
recurringRoutes.post("/:id/pause", async (c) =>
  ok(c, await setRecurringActive(c.env, c.get("userId"), c.req.param("id"), false)),
);
recurringRoutes.post("/:id/resume", async (c) =>
  ok(c, await setRecurringActive(c.env, c.get("userId"), c.req.param("id"), true)),
);
