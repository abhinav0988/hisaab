import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { tagCreateSchema, tagPatchSchema } from "@hisaab/validation";
import { Hono } from "hono";
import { createTag, deleteTag, listTags, updateTag } from "../services/tags";

export const tagRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
tagRoutes.get("/", async (c) => ok(c, await listTags(c.env, c.get("userId"))));
tagRoutes.post("/", async (c) => {
  const parsed = tagCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createTag(c.env, c.get("userId"), parsed.data.name));
});
tagRoutes.patch("/:id", async (c) => {
  const parsed = tagPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateTag(c.env, c.get("userId"), c.req.param("id"), parsed.data.name));
});
tagRoutes.delete("/:id", async (c) => {
  await deleteTag(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
