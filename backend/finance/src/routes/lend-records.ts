import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { lendRecordPatchSchema, lendRecordSchema } from "@hisaab/validation";
import { Hono } from "hono";
import {
  createLendRecord,
  deleteLendRecord,
  getLendRecord,
  listLendRecords,
  listLendRepayments,
  recordLendRepayment,
  updateLendRecord,
} from "../services/service";
import { parseIdempotencyKey } from "../idempotency";
import { lendReminderSchema, lendRepaymentSchema } from "@hisaab/validation";
import { deleteLendReminder, getLendReminder, putLendReminder } from "../services/reminders";

export const lendRecordRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
lendRecordRoutes.get("/", async (c) => ok(c, await listLendRecords(c.env, c.get("userId"))));
lendRecordRoutes.post("/", async (c) => {
  const parsed = lendRecordSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createLendRecord(c.env, c.get("userId"), parsed.data));
});
lendRecordRoutes.get("/:id/repayments", async (c) =>
  ok(c, await listLendRepayments(c.env, c.get("userId"), c.req.param("id"))),
);
lendRecordRoutes.post("/:id/repayments", async (c) => {
  const parsed = lendRepaymentSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(
    c,
    await recordLendRepayment(
      c.env,
      c.get("userId"),
      c.req.param("id"),
      parsed.data,
      parseIdempotencyKey(c.req.header("Idempotency-Key")),
    ),
  );
});
lendRecordRoutes.get("/:id/reminder", async (c) =>
  ok(c, await getLendReminder(c.env, c.get("userId"), c.req.param("id"))),
);
lendRecordRoutes.put("/:id/reminder", async (c) => {
  const parsed = lendReminderSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await putLendReminder(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
lendRecordRoutes.delete("/:id/reminder", async (c) => {
  await deleteLendReminder(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
lendRecordRoutes.get("/:id", async (c) =>
  ok(c, await getLendRecord(c.env, c.get("userId"), c.req.param("id"))),
);
lendRecordRoutes.patch("/:id", async (c) => {
  const parsed = lendRecordPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateLendRecord(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
lendRecordRoutes.delete("/:id", async (c) => {
  await deleteLendRecord(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
