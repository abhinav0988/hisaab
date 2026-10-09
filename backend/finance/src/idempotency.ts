import { AppError } from "@hisaab/worker-lib";

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

export async function readIdempotent<T>(env: Env, userId: string, scope: string, key: string | null) {
  if (!key) return null;
  const row = await env.DB.prepare(
    "SELECT response_json AS responseJson FROM idempotency_keys WHERE user_id = ? AND scope = ? AND key = ?",
  )
    .bind(userId, scope, key)
    .first<{ responseJson: string }>();
  if (!row) return null;
  return JSON.parse(row.responseJson) as T;
}

export async function commitStatements<T>(
  env: Env,
  statements: D1PreparedStatement[],
  userId: string,
  scope: string,
  key: string | null,
  response: T,
) {
  const batch = [...statements];
  if (key) {
    batch.push(
      env.DB.prepare(
        "INSERT INTO idempotency_keys (user_id, scope, key, response_json, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(userId, scope, key, JSON.stringify(response), new Date().toISOString()),
    );
  }
  try {
    await env.DB.batch(batch);
  } catch (error) {
    if (key && error instanceof Error && /idempotency_keys/i.test(error.message)) {
      const previous = await readIdempotent<T>(env, userId, scope, key);
      if (previous) return previous;
    }
    throw error;
  }
  return response;
}
