import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { ipoPatchSchema, ipoSchema } from "@hisaab/validation";
import { Hono } from "hono";
import { createIpo, deleteIpo, getIpo, listIpos, updateIpo } from "../services/service";

export const ipoRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
ipoRoutes.get("/", async (c) => ok(c, await listIpos(c.env, c.get("userId"))));
ipoRoutes.post("/", async (c) => {
  const parsed = ipoSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createIpo(c.env, c.get("userId"), parsed.data));
});
ipoRoutes.get("/:id", async (c) => ok(c, await getIpo(c.env, c.get("userId"), c.req.param("id"))));
ipoRoutes.patch("/:id", async (c) => {
  const parsed = ipoPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateIpo(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
ipoRoutes.delete("/:id", async (c) => {
  await deleteIpo(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
