import { createDatabase, userPreferences, users } from "@hisaab/database";
import { profilePatchSchema } from "@hisaab/validation";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { fromZod, notFound } from "../../shared/errors";
import { newId, now, ok } from "../../shared/http";

export const profileRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

profileRoutes.get("/", async (c) => {
  const db = createDatabase(c.env.DB);
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound("Profile");
  let preferences = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!preferences) {
    const value = {
      id: newId(),
      userId,
      countryCode: "IN",
      defaultCurrency: "INR",
      timezone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      theme: "system",
      createdAt: now(),
      updatedAt: now(),
    };
    await db.insert(userPreferences).values(value);
    preferences = value;
  }
  return ok(c, {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    countryCode: preferences.countryCode,
    defaultCurrency: preferences.defaultCurrency,
    timezone: preferences.timezone,
    dateFormat: preferences.dateFormat,
    theme: preferences.theme,
    createdAt: preferences.createdAt,
    updatedAt: preferences.updatedAt,
  });
});

profileRoutes.patch("/", async (c) => {
  const parsed = profilePatchSchema.safeParse(await c.req.json());
  if (!parsed.success) throw fromZod(parsed.error);
  const db = createDatabase(c.env.DB);
  const userId = c.get("userId");
  const { name, ...preferences } = parsed.data;
  if (name) await db.update(users).set({ name, updatedAt: now() }).where(eq(users.id, userId));
  if (Object.keys(preferences).length) {
    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    if (existing)
      await db
        .update(userPreferences)
        .set({ ...preferences, updatedAt: now() })
        .where(eq(userPreferences.userId, userId));
    else
      await db.insert(userPreferences).values({
        id: newId(),
        userId,
        countryCode: preferences.countryCode ?? "IN",
        defaultCurrency: preferences.defaultCurrency ?? "INR",
        timezone: preferences.timezone ?? "Asia/Kolkata",
        dateFormat: preferences.dateFormat ?? "DD/MM/YYYY",
        theme: preferences.theme ?? "system",
        createdAt: now(),
        updatedAt: now(),
      });
  }
  return ok(c, { updated: true });
});

profileRoutes.delete("/", async (c) => {
  const db = createDatabase(c.env.DB);
  await db.delete(users).where(eq(users.id, c.get("userId")));
  return ok(c, { deleted: true });
});
