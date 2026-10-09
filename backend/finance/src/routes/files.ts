import { AppError, created, noContent } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { deleteOwnedFile, readOwnedFile, storeUpload } from "../storage/files";

export const fileRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

fileRoutes.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) throw new AppError(400, "VALIDATION_ERROR", "Choose a JPEG, PNG, or PDF to upload.");
  return created(c, await storeUpload(c.env, c.get("userId"), file));
});

fileRoutes.get("/:id", async (c) => readOwnedFile(c.env, c.get("userId"), c.req.param("id")));

fileRoutes.delete("/:id", async (c) => {
  await deleteOwnedFile(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
