import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    migrations: Array<{ name: string; queries: string[] }>;
  }
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("migrations"));
});
