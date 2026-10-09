import { fromZod, ok } from "@hisaab/worker-lib";
import { ocrReceiptSchema } from "@hisaab/validation";
import { Hono } from "hono";
import { scanReceipt } from "../ocr";

export const ocrRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

ocrRoutes.post("/receipt", async (c) => {
  const parsed = ocrReceiptSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await scanReceipt(c.env, c.get("userId"), parsed.data.fileId));
});
