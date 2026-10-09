import {
  transactionPatchSchema,
  transactionQuerySchema,
  transactionSchema,
} from "@hisaab/validation";
import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { Hono } from "hono";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "../services/service";
import { attachToTransaction, listAttachments, removeAttachment } from "../services/attachments";
import { fileAttachSchema } from "@hisaab/validation";

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
transactionRoutes.get("/:id/attachments", async (c) =>
  ok(c, await listAttachments(c.env, c.get("userId"), c.req.param("id"))),
);
transactionRoutes.post("/:id/attachments", async (c) => {
  const parsed = fileAttachSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await attachToTransaction(c.env, c.get("userId"), c.req.param("id"), parsed.data.fileId));
});
transactionRoutes.delete("/:id/attachments/:attachmentId", async (c) => {
  await removeAttachment(c.env, c.get("userId"), c.req.param("id"), c.req.param("attachmentId"));
  return noContent(c);
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
