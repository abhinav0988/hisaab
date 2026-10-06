import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
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
} from "@hisaab/validation";
import { Hono } from "hono";
import { z } from "zod";
import {
  addGroupMember,
  convertExpenseToLend,
  createAdjustment,
  createExpense,
  createGroup,
  createPerson,
  deleteExpense,
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
  scheduleReminder,
  simplifySettlements,
  updateExpense,
  updateGroup,
  updatePerson,
  uploadReceipt,
} from "../services/split-money";

type Vars = { Bindings: Env; Variables: { userId: string } };

export const splitMoneyRoutes = new Hono<Vars>();

splitMoneyRoutes.get("/dashboard", async (c) =>
  ok(c, await getDashboard(c.env, c.get("userId"))),
);
splitMoneyRoutes.get("/analytics", async (c) =>
  ok(c, await getAnalytics(c.env, c.get("userId"))),
);
splitMoneyRoutes.get("/history", async (c) => ok(c, await getHistory(c.env, c.get("userId"))));

splitMoneyRoutes.get("/people", async (c) => ok(c, await listPeople(c.env, c.get("userId"))));
splitMoneyRoutes.post("/people", async (c) => {
  const parsed = splitPersonSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createPerson(c.env, c.get("userId"), parsed.data));
});
splitMoneyRoutes.get("/people/:id", async (c) =>
  ok(c, await getPersonDetails(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.patch("/people/:id", async (c) => {
  const parsed = splitPersonPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updatePerson(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});

splitMoneyRoutes.get("/groups", async (c) => ok(c, await listGroups(c.env, c.get("userId"))));
splitMoneyRoutes.post("/groups", async (c) => {
  const parsed = splitGroupSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createGroup(c.env, c.get("userId"), parsed.data));
});
splitMoneyRoutes.get("/groups/:id", async (c) =>
  ok(c, await getGroup(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.patch("/groups/:id", async (c) => {
  const parsed = splitGroupPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateGroup(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
splitMoneyRoutes.post("/groups/:id/members", async (c) => {
  const parsed = z.object({ personId: z.string().min(8).max(64) }).safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(
    c,
    await addGroupMember(c.env, c.get("userId"), c.req.param("id"), parsed.data.personId),
  );
});
splitMoneyRoutes.delete("/groups/:id/members/:memberId", async (c) =>
  ok(
    c,
    await removeGroupMember(
      c.env,
      c.get("userId"),
      c.req.param("id"),
      c.req.param("memberId"),
    ),
  ),
);

splitMoneyRoutes.get("/expenses", async (c) => {
  const status = c.req.query("status") ?? undefined;
  const query = c.req.query("q") ?? undefined;
  const limit = Number(c.req.query("limit") ?? 50);
  const offset = Number(c.req.query("offset") ?? 0);
  return ok(
    c,
    await listExpenses(c.env, c.get("userId"), { status, query, limit, offset }),
  );
});
splitMoneyRoutes.post("/expenses", async (c) => {
  const parsed = splitExpenseSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createExpense(c.env, c.get("userId"), parsed.data));
});
splitMoneyRoutes.get("/expenses/:id", async (c) =>
  ok(c, await getExpense(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.patch("/expenses/:id", async (c) => {
  const parsed = splitExpensePatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateExpense(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
splitMoneyRoutes.delete("/expenses/:id", async (c) => {
  await deleteExpense(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
splitMoneyRoutes.post("/expenses/:id/payments", async (c) => {
  const parsed = splitPaymentSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(
    c,
    await recordPayment(c.env, c.get("userId"), c.req.param("id"), parsed.data),
  );
});
splitMoneyRoutes.get("/expenses/:id/payments", async (c) => {
  const expense = await getExpense(c.env, c.get("userId"), c.req.param("id"));
  return ok(c, expense.payments);
});
splitMoneyRoutes.post("/expenses/:id/adjustments", async (c) => {
  const parsed = splitAdjustmentSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(
    c,
    await createAdjustment(c.env, c.get("userId"), c.req.param("id"), parsed.data),
  );
});
splitMoneyRoutes.post("/expenses/:id/reminders", async (c) => {
  const parsed = z
    .object({
      channel: splitReminderChannelSchema,
      scheduledAt: z.string().min(10),
      message: z.string().max(200).nullable().optional(),
      participantId: z.string().min(8).max(64).nullable().optional(),
      frequency: z.string().max(40).nullable().optional(),
      stopAfterSettlement: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(
    c,
    await scheduleReminder(c.env, c.get("userId"), c.req.param("id"), parsed.data),
  );
});
splitMoneyRoutes.post("/expenses/:id/settle", async (c) => {
  const expense = await getExpense(c.env, c.get("userId"), c.req.param("id"));
  const pending = expense.participants.filter((p) => p.pendingAmountMinor > 0);
  let current = expense;
  for (const part of pending) {
    const receiver =
      expense.payers[0]?.personId ??
      expense.participants.find((p) => p.personId !== part.personId)?.personId;
    if (!receiver) continue;
    current = await recordPayment(c.env, c.get("userId"), c.req.param("id"), {
      participantId: part.id,
      payerPersonId: part.personId,
      receiverPersonId: receiver,
      amountMinor: part.pendingAmountMinor,
      method: "other",
      paymentDate: new Date().toISOString().slice(0, 10),
      isFinalSettlement: true,
    });
  }
  return ok(c, current);
});
splitMoneyRoutes.post("/expenses/:id/simplify", async (c) =>
  ok(c, await simplifySettlements(c.env, c.get("userId"), c.req.param("id"))),
);
splitMoneyRoutes.post("/expenses/:id/convert-lend", async (c) =>
  ok(c, await convertExpenseToLend(c.env, c.get("userId"), c.req.param("id"))),
);

splitMoneyRoutes.post("/receipts", async (c) => {
  const parsed = splitReceiptUploadSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await uploadReceipt(c.env, c.get("userId"), parsed.data));
});

splitMoneyRoutes.post("/simplify", async (c) =>
  ok(c, await simplifySettlements(c.env, c.get("userId"))),
);
