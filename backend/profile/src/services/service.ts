import {
  createDatabase,
  defaultUserPreferences,
  userPreferences,
  users,
} from "@hisaab/database";
import type { profilePatchSchema } from "@hisaab/validation";
import { notFound, now } from "@hisaab/worker-lib";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { profileRegionDefaults } from "../patch";

type Patch = z.infer<typeof profilePatchSchema>;

export async function getProfile(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound("Profile");
  let preferences = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!preferences) {
    const value = defaultUserPreferences(userId);
    await db.insert(userPreferences).values(value);
    preferences = value;
  }
  return {
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
    language: preferences.language,
    profileNote: preferences.profileNote,
    smartNotifications: preferences.smartNotifications,
    weeklySummary: preferences.weeklySummary,
    appLockEnabled: preferences.appLockEnabled,
    createdAt: preferences.createdAt,
    updatedAt: preferences.updatedAt,
  };
}

export async function updateProfile(env: Env, userId: string, input: Patch) {
  const db = createDatabase(env.DB);
  const { name, ...preferences } = input;
  if (name) await db.update(users).set({ name, updatedAt: now() }).where(eq(users.id, userId));
  if (Object.keys(preferences).length) {
    const next = {
      ...preferences,
      ...profileRegionDefaults(preferences.countryCode, preferences),
    };
    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    if (existing)
      await db
        .update(userPreferences)
        .set({ ...next, updatedAt: now() })
        .where(eq(userPreferences.userId, userId));
    else await db.insert(userPreferences).values(defaultUserPreferences(userId, next.countryCode));
  }
  return { updated: true };
}

export async function deleteProfile(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  await db.delete(users).where(eq(users.id, userId));
  return { deleted: true };
}
