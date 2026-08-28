import { profilePatchSchema } from "@hisaab/validation";
import { fromZod, ok } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { deleteProfile, getProfile, updateProfile } from "../services/service";

export const profileRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
profileRoutes.get("/", async (c) => ok(c, await getProfile(c.env, c.get("userId"))));
profileRoutes.patch("/", async (c) => {
  const parsed = profilePatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateProfile(c.env, c.get("userId"), parsed.data));
});
profileRoutes.delete("/", async (c) => ok(c, await deleteProfile(c.env, c.get("userId"))));
