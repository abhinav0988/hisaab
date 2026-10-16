interface Env {
  DB: D1Database;
  FILES?: R2Bucket;
  AI?: Ai;
  INTERNAL_SERVICE_TOKEN?: string;
  SPLIT_RECEIPT_OCR?: string;
}

declare module "cloudflare:test" {
  // Vitest workers pool augments Env with ProvidedEnv.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Env {}
}
