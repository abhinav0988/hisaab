import type { Context } from "hono";
export const ok = <T>(c: Context, data: T, meta?: Record<string, unknown>) =>
  c.json({ success: true as const, data, ...(meta ? { meta } : {}) });
export const created = <T>(c: Context, data: T) => c.json({ success: true as const, data }, 201);
export const noContent = (c: Context) => c.body(null, 204);
export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export async function hashIp(value: string, secret: string) {
  const bytes = new TextEncoder().encode(`${secret}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
