import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations("../../packages/database/migrations");
  return {
    test: {
      setupFiles: ["./src/test/setup.ts"],
      provide: { migrations },
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: { BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters" },
          },
        },
      },
    },
  };
});
