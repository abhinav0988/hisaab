import { created, fromZod, noContent, ok } from "@hisaab/worker-lib";
import { creditFacilityKindSchema, creditFacilityPatchSchema, creditFacilitySchema } from "@hisaab/validation";
import { Hono } from "hono";
import {
  createCreditFacility,
  deleteCreditFacility,
  getCreditFacility,
  listCreditFacilities,
  updateCreditFacility,
} from "../services/service";

export const creditFacilityRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
creditFacilityRoutes.get("/", async (c) => {
  const kindQuery = c.req.query("kind");
  const kind = kindQuery ? creditFacilityKindSchema.safeParse(kindQuery) : null;
  if (kind && !kind.success) throw fromZod(kind.error);
  return ok(c, await listCreditFacilities(c.env, c.get("userId"), kind?.data));
});
creditFacilityRoutes.post("/", async (c) => {
  const parsed = creditFacilitySchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return created(c, await createCreditFacility(c.env, c.get("userId"), parsed.data));
});
creditFacilityRoutes.get("/:id", async (c) =>
  ok(c, await getCreditFacility(c.env, c.get("userId"), c.req.param("id"))),
);
creditFacilityRoutes.patch("/:id", async (c) => {
  const parsed = creditFacilityPatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  return ok(c, await updateCreditFacility(c.env, c.get("userId"), c.req.param("id"), parsed.data));
});
creditFacilityRoutes.delete("/:id", async (c) => {
  await deleteCreditFacility(c.env, c.get("userId"), c.req.param("id"));
  return noContent(c);
});
