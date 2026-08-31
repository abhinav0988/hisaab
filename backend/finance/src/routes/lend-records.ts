import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { lendRecordPatchSchema, lendRecordSchema } from "@hisaab/validation";
import { Hono } from "hono";
import {
  createLendRecord,
  deleteLendRecord,
  getLendRecord,
  listLendRecords,
  updateLendRecord,
} from "../services/service";

export const lendRecordRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
lendRecordRoutes.get("/", async (c) => ok(c, await listLendRecords(c.env, c.get("userId"))));
lendRecordRoutes.post("/", async (c) => {
  const parsed = lendRecordSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createLendRecord(c.env, c.get("userId"), parsed.data));
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
