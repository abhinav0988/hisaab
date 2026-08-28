import {
  transactionPatchSchema,
  transactionQuerySchema,
  transactionSchema,
} from "@hisaab/validation";
import { Hono } from "hono";
import { fromZod } from "../../shared/errors";
import { created, noContent, ok } from "../../shared/http";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "./service";
export const transactionRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
transactionRoutes.get("/", async (c) => {
  const parsed = transactionQuerySchema.safeParse(c.req.query());
  if (!parsed.success) throw fromZod(parsed.error);
  const result = await listTransactions(c.env, c.get("userId"), parsed.data);
  return ok(c, result.items, result.meta);
});
transactionRoutes.post("/", async (c) => {
  const parsed = transactionSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createTransaction(c.env, c.get("userId"), parsed.data));
});
transactionRoutes.get("/:id", async (c) =>
  ok(c, await getTransaction(c.env, c.get("userId"), c.req.param("id"))),
);
transactionRoutes.patch("/:id", async (c) => {
  const parsed = transactionPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateTransaction(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
transactionRoutes.delete("/:id", async (c) => {
  await deleteTransaction(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
