import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { loanPatchSchema, loanSchema } from "@hisaab/validation";
import { Hono } from "hono";
import { createLoan, deleteLoan, getLoan, listLoans, updateLoan } from "../services/service";

export const loanRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
loanRoutes.get("/", async (c) => ok(c, await listLoans(c.env, c.get("userId"))));
loanRoutes.post("/", async (c) => {
  const parsed = loanSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createLoan(c.env, c.get("userId"), parsed.data));
});
loanRoutes.get("/:id", async (c) => ok(c, await getLoan(c.env, c.get("userId"), c.req.param("id"))));
loanRoutes.patch("/:id", async (c) => {
  const parsed = loanPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateLoan(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
loanRoutes.delete("/:id", async (c) => {
  await deleteLoan(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
