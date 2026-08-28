import { processRecurring } from "../services/service";

export async function runScheduled(env: Env, scheduledTime: number, ctx: ExecutionContext) {
  const job = processRecurring(env, new Date(scheduledTime));
  const cleanup = env.DB.prepare("DELETE FROM api_rate_limits WHERE expires_at < ?")
    .bind(new Date().toISOString())
    .run();
  ctx.waitUntil(Promise.all([job, cleanup]));
}
