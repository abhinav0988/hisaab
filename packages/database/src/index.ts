import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
export * from "./defaults";
export * from "./schema";
export const createDatabase = (binding: D1Database) =>
  drizzle(binding, { schema, casing: "snake_case" });
export type Database = ReturnType<typeof createDatabase>;
