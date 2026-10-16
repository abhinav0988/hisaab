import { AppError, created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import {
  splitAdjustmentSchema,
  splitExpensePatchSchema,
  splitExpenseSchema,
  splitGroupPatchSchema,
  splitGroupSchema,
  splitPaymentSchema,
  splitPersonPatchSchema,
  splitPersonSchema,
  splitReceiptUploadSchema,
  splitReminderChannelSchema,
  splitReplaceSchema,
  splitSettleSchema,
  splitVoidPaymentSchema,
} from "@hisaab/validation";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { parseIdempotencyKey, requestHash } from "../idempotency";
import {
  addGroupMember,
  archivePerson,
  attachExpenseReceipt,
  cancelReminder,
  convertExpenseToLend,
  createAdjustment,
  createExpense,
  createGroup,
  createPerson,
  deleteExpense,
  deleteExpenseReceipt,
  getAnalytics,
  getDashboard,
  getExpense,
  getGroup,
  getHistory,
  getPersonDetails,
  listExpenses,
  listGroups,
  listPeople,
  recordPayment,
  removeGroupMember,
  replaceSplit,
  scheduleReminder,
  settleAll,
  simplifySettlements,
  updateExpense,
  updateGroup,
  updatePerson,
  uploadReceipt,
  voidPayment,
  type Idem,
} from "../services/split-money";

type Vars = { Bindings: Env; Variables: { userId: string } };

export const splitMoneyRoutes = new Hono<Vars>();

async function body(c: Context<Vars>) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

async function idem(c: Context<Vars>, payload: unknown): Promise<Idem> {
  const key = parseIdempotencyKey(c.req.header("Idempotency-Key"));
  if (!key) return { key: null, hash: null };
  return { key, hash: await requestHash({ path: c.req.path, method: c.req.method, payload }) };
}

function replayed(c: Context<Vars>, value: boolean) {
  if (value) c.header("Idempotent-Replayed", "true");
}

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw fromZod(parsed.error);
  return parsed.data;
}

splitMoneyRoutes.get("/dashboard", async (c) => ok(c, await getDashboard(c.env, c.get("userId"))));
splitMoneyRoutes.get("/analytics", async (c) => ok(c, await getAnalytics(c.env, c.get("userId"))));
splitMoneyRoutes.get("/history", async (c) => ok(c, await getHistory(c.env, c.get("userId"))));

splitMoneyRoutes.get("/people", async (c) =>
  ok(c, await listPeople(c.env, c.get("userId"), c.req.query("includeArchived") === "1")),
);
splitMoneyRoutes.post("/people", async (c) => {
  const payload = await body(c);
  const input = parse(splitPersonSchema, payload);
  const person = await createPerson(c.env, c.get("userId"), input, await idem(c, payload));
  return person.existing ? ok(c, person) : created(c, person);
});
splitMoneyRoutes.get("/people/:id", async (c) =>
  ok(c, await getPersonDetails(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.patch("/people/:id", async (c) => {
  const input = parse(splitPersonPatchSchema, await body(c));
  return ok(c, await updatePerson(c.env, c.get("userId"), c.req.param("id"), input));
});
splitMoneyRoutes.delete("/people/:id", async (c) =>
  ok(c, await archivePerson(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.post("/people/:id/restore", async (c) =>
  ok(c, await archivePerson(c.env, c.get("userId"), c.req.param("id"), true)),
);

splitMoneyRoutes.get("/groups", async (c) => ok(c, await listGroups(c.env, c.get("userId"))));
splitMoneyRoutes.post("/groups", async (c) => {
  const payload = await body(c);
  const input = parse(splitGroupSchema, payload);
  const result = await createGroup(c.env, c.get("userId"), input, await idem(c, payload));
  replayed(c, result.replayed);
  return result.replayed ? ok(c, result.group) : created(c, result.group);
});
splitMoneyRoutes.get("/groups/:id", async (c) =>
  ok(c, await getGroup(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.patch("/groups/:id", async (c) => {
  const input = parse(splitGroupPatchSchema, await body(c));
  return ok(c, await updateGroup(c.env, c.get("userId"), c.req.param("id"), input));
});
splitMoneyRoutes.post("/groups/:id/members", async (c) => {
  const input = parse(z.object({ personId: z.string().min(8).max(64) }), await body(c));
  return ok(c, await addGroupMember(c.env, c.get("userId"), c.req.param("id"), input.personId));
});
splitMoneyRoutes.delete("/groups/:id/members/:memberId", async (c) =>
  ok(c, await removeGroupMember(c.env, c.get("userId"), c.req.param("id"), c.req.param("memberId"))),
);

splitMoneyRoutes.get("/expenses", async (c) => {
  const result = await listExpenses(c.env, c.get("userId"), {
    status: c.req.query("status") ?? undefined,
    query: c.req.query("q") ?? undefined,
    groupId: c.req.query("groupId") ?? undefined,
    limit: Number(c.req.query("limit") ?? 50) || 50,
    offset: Number(c.req.query("offset") ?? 0) || 0,
  });
  c.header("X-Total-Count", String(result.total));
  return ok(c, result.items);
});
splitMoneyRoutes.post("/expenses", async (c) => {
  const payload = await body(c);
  const input = parse(splitExpenseSchema, payload);
  const result = await createExpense(c.env, c.get("userId"), input, await idem(c, payload));
  replayed(c, result.replayed);
  return result.replayed ? ok(c, result.expense) : created(c, result.expense);
});
splitMoneyRoutes.get("/expenses/:id", async (c) =>
  ok(c, await getExpense(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.patch("/expenses/:id", async (c) => {
  const payload = await body(c);
  const input = parse(splitExpensePatchSchema, payload);
  return ok(c, await updateExpense(c.env, c.get("userId"), c.req.param("id"), input, await idem(c, payload)));
});
splitMoneyRoutes.put("/expenses/:id/split", async (c) => {
  const payload = await body(c);
  const input = parse(splitReplaceSchema, payload);
  return ok(c, await replaceSplit(c.env, c.get("userId"), c.req.param("id"), input, await idem(c, payload)));
});
splitMoneyRoutes.delete("/expenses/:id", async (c) => {
  await deleteExpense(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});

splitMoneyRoutes.get("/expenses/:id/payments", async (c) => {
  const expense = await getExpense(c.env, c.get("userId"), c.req.param("id"));
  return ok(c, expense.payments);
});
splitMoneyRoutes.post("/expenses/:id/payments", async (c) => {
  const payload = await body(c);
  const input = parse(splitPaymentSchema, payload);
  const result = await recordPayment(c.env, c.get("userId"), c.req.param("id"), input, await idem(c, payload));
  replayed(c, result.replayed);
  return result.replayed ? ok(c, result.expense) : created(c, result.expense);
});
splitMoneyRoutes.post("/expenses/:id/payments/:paymentId/void", async (c) => {
  const payload = await body(c);
  const input = parse(splitVoidPaymentSchema, payload);
  const result = await voidPayment(
    c.env,
    c.get("userId"),
    c.req.param("id"),
    c.req.param("paymentId"),
    input.reason ?? null,
    await idem(c, payload),
  );
  replayed(c, result.replayed);
  return ok(c, result.expense);
});
splitMoneyRoutes.post("/expenses/:id/settle", async (c) => {
  const payload = await body(c);
  const input = parse(splitSettleSchema, payload);
  const result = await settleAll(c.env, c.get("userId"), c.req.param("id"), input, await idem(c, payload));
  replayed(c, result.replayed);
  return ok(c, result.expense);
});
splitMoneyRoutes.post("/expenses/:id/adjustments", async (c) => {
  const payload = await body(c);
  const input = parse(splitAdjustmentSchema, payload);
  const result = await createAdjustment(c.env, c.get("userId"), c.req.param("id"), input, await idem(c, payload));
  replayed(c, result.replayed);
  return result.replayed ? ok(c, result.expense) : created(c, result.expense);
});
splitMoneyRoutes.post("/expenses/:id/reminders", async (c) => {
  const payload = await body(c);
  const input = parse(
    z.object({
      channel: splitReminderChannelSchema,
      scheduledAt: z.string().min(10),
      message: z.string().max(200).nullable().optional(),
      participantId: z.string().min(8).max(64).nullable().optional(),
      frequency: z.string().max(40).nullable().optional(),
      stopAfterSettlement: z.boolean().optional(),
    }),
    payload,
  );
  return created(c, await scheduleReminder(c.env, c.get("userId"), c.req.param("id"), input, await idem(c, payload)));
});
splitMoneyRoutes.delete("/expenses/:id/reminders/:reminderId", async (c) => {
  await cancelReminder(c.env, c.get("userId"), c.req.param("id"), c.req.param("reminderId"));
  return noContent(c);
});
splitMoneyRoutes.post("/expenses/:id/simplify", async (c) =>
  ok(c, await simplifySettlements(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.post("/expenses/:id/convert-lend", async (c) =>
  ok(c, await convertExpenseToLend(c.env, c.get("userId"), c.req.param("id"))),
);

splitMoneyRoutes.post("/expenses/:id/receipts", async (c) => {
  const input = parse(splitReceiptUploadSchema, await body(c));
  if (!input.fileId) {
    throw new AppError(400, "VALIDATION_ERROR", "Upload the file first and send its fileId.");
  }
  return created(
    c,
    await attachExpenseReceipt(c.env, c.get("userId"), c.req.param("id"), {
      fileId: input.fileId,
      description: input.description,
    }),
  );
});
splitMoneyRoutes.delete("/expenses/:id/receipts/:receiptId", async (c) => {
  await deleteExpenseReceipt(c.env, c.get("userId"), c.req.param("id"), c.req.param("receiptId"));
  return noContent(c);
});
splitMoneyRoutes.post("/receipts", async (c) => {
  const input = parse(splitReceiptUploadSchema, await body(c));
  return created(c, await uploadReceipt(c.env, c.get("userId"), input));
});

splitMoneyRoutes.post("/simplify", async (c) => ok(c, await simplifySettlements(c.env, c.get("userId"))));
