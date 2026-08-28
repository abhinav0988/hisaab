import { betterAuth } from "better-auth";

type WaitUntilContext = { waitUntil(promise: Promise<unknown>): void };
async function sendAuthEmail(
  env: Env,
  ctx: WaitUntilContext,
  kind: "verification" | "password-reset",
  to: string,
  url: string,
) {
  if (!env.EMAIL_WEBHOOK_URL) {
    if (env.ENVIRONMENT === "development")
      console.info(
        JSON.stringify({
          level: "info",
          event: "auth_email_skipped",
          kind,
          reason: "provider_not_configured",
        }),
      );
    return;
  }
  const promise = fetch(env.EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.EMAIL_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ template: kind, to, url, product: "Hisaab" }),
  }).then((response) => {
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  });
  ctx.waitUntil(promise);
}

export function createAuth(env: Env, ctx: WaitUntilContext) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [env.APP_ORIGIN],
    advanced: { useSecureCookies: env.ENVIRONMENT === "production", cookiePrefix: "hisaab" },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) =>
        sendAuthEmail(env, ctx, "password-reset", user.email, url),
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) =>
        sendAuthEmail(env, ctx, "verification", user.email, url),
      sendOnSignUp: true,
      expiresIn: 3600,
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
