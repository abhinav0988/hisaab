import { accountPatchSchema, accountSchema } from "@hisaab/validation";
import { Hono } from "hono";
import { created, fromZod, ok } from "@hisaab/worker-lib";
import {
  createAccount,
  deactivateAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from "../services/service";

export const accountRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
accountRoutes.get("/", async (c) => ok(c, await listAccounts(c.env, c.get("userId"))));
accountRoutes.post("/", async (c) => {
  const parsed = accountSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createAccount(c.env, c.get("userId"), parsed.data));
});
accountRoutes.get("/:id", async (c) =>
  ok(c, await getAccount(c.env, c.get("userId"), c.req.param("id"))),
);
accountRoutes.patch("/:id", async (c) => {
  const parsed = accountPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateAccount(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
accountRoutes.delete("/:id", async (c) =>
  ok(c, await deactivateAccount(c.env, c.get("userId"), c.req.param("id"))),
);
