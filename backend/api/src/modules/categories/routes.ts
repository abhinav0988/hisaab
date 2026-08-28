import { categoryPatchSchema, categorySchema } from "@hisaab/validation";
import { Hono } from "hono";
import { fromZod } from "../../shared/errors";
import { created, noContent, ok } from "../../shared/http";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./service";
export const categoryRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
categoryRoutes.get("/", async (c) => ok(c, await listCategories(c.env, c.get("userId"))));
categoryRoutes.post("/", async (c) => {
  const parsed = categorySchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createCategory(c.env, c.get("userId"), parsed.data));
});
categoryRoutes.patch("/:id", async (c) => {
  const parsed = categoryPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateCategory(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
categoryRoutes.delete("/:id", async (c) => {
  await deleteCategory(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
