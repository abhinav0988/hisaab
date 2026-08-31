import { betterAuth } from "better-auth";
import { sendAuthEmail } from "../services/send-auth-email";
import { consumeVerifiedSignupOtp } from "../services/signup-otp";
import { seedUserWorkspace } from "../services/seed-user-workspace";

type WaitUntilContext = { waitUntil(promise: Promise<unknown>): void };

export function createAuth(env: Env, ctx: WaitUntilContext) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [env.APP_ORIGIN],
    advanced: {
      useSecureCookies: env.ENVIRONMENT === "production",
      cookiePrefix: "hisaab",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.ENVIRONMENT === "production",
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: env.ENVIRONMENT === "production",
      sendResetPassword: async ({ user, url }) =>
        sendAuthEmail(env, ctx, "password-reset", user.email, url),
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) =>
        sendAuthEmail(env, ctx, "verification", user.email, url),
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      expiresIn: 3600,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, context) => {
            const ctx = context as {
              headers?: Headers;
              request?: Request;
              body?: { countryCode?: string };
            } | null;
            const headerCountry =
              ctx?.headers?.get("x-hisaab-country") ??
              ctx?.request?.headers.get("x-hisaab-country");
            await seedUserWorkspace(env, user.id, ctx?.body?.countryCode ?? headerCountry);
            await consumeVerifiedSignupOtp(env, user.email, user.id);
          },
        },
      },
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
