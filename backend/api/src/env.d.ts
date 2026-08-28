declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    EMAIL_WEBHOOK_URL?: string;
    EMAIL_WEBHOOK_TOKEN?: string;
  }
}

declare module "cloudflare:test" {
  // Vitest requires interface augmentation for the generated Worker bindings.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Env {}
}
