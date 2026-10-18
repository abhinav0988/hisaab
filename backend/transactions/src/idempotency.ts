import { AppError } from "@hisaab/worker-lib";

const RETENTION_DAYS = 30;

export function parseIdempotencyKey(header: string | undefined) {
  if (!header) return null;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(header)) {
    throw new AppError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must be 8-128 letters, numbers, underscores, or hyphens.",
    );
  }
  return header;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export async function requestHash(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(payload)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readIdempotent<T>(
  env: Env,
  userId: string,
  scope: string,
  key: string | null,
  hash: string | null = null,
) {
  if (!key) return null;
  const row = await env.DB.prepare(
    "SELECT response_json AS responseJson, request_hash AS requestHash FROM idempotency_keys WHERE user_id = ? AND scope = ? AND key = ?",
  )
    .bind(userId, scope, key)
    .first<{ responseJson: string; requestHash: string | null }>();
  if (!row) return null;
  if (hash && row.requestHash && row.requestHash !== hash) {
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This request key was already used for a different request. Start a new action and try again.",
    );
  }
  return JSON.parse(row.responseJson) as T;
}

export function idempotencyInsert(
  env: Env,
  userId: string,
  scope: string,
  key: string,
  response: unknown,
  hash: string | null,
) {
  return env.DB.prepare(
    "INSERT INTO idempotency_keys (user_id, scope, key, response_json, request_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(userId, scope, key, JSON.stringify(response), hash, new Date().toISOString());
}

export function idempotencyPurge(env: Env, userId: string) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  return env.DB.prepare("DELETE FROM idempotency_keys WHERE user_id = ? AND created_at < ?").bind(userId, cutoff);
}

export function isIdempotencyConflict(error: unknown) {
  return error instanceof Error && /idempotency_keys/i.test(error.message);
}

export async function storeIdempotentResponse(
  env: Env,
  userId: string,
  scope: string,
  key: string | null,
  response: unknown,
  hash: string | null,
) {
  if (!key) return;
  try {
    await env.DB.batch([
      idempotencyInsert(env, userId, scope, key, response, hash),
      idempotencyPurge(env, userId),
    ]);
  } catch (error) {
    if (!isIdempotencyConflict(error)) throw error;
  }
}
