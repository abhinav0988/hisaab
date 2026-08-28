import {
  createDatabase,
  defaultSubscription,
  defaultUserPreferences,
  subscriptions,
  userPreferences,
} from "@hisaab/database";
import { eq } from "drizzle-orm";

export async function seedUserWorkspace(env: Env, userId: string, countryCode?: string | null) {
  const db = createDatabase(env.DB);
  const existing = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!existing) {
    await db.insert(userPreferences).values(defaultUserPreferences(userId, countryCode));
  }
  const plan = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!plan) {
    await db.insert(subscriptions).values(defaultSubscription(userId, countryCode));
  }
}
