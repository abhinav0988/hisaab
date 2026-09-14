import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";

export const authService = {
  useSession: () => authClient.useSession(),
  getSession: () => authClient.getSession(),
  signIn: (input: { email: string; password: string; rememberMe: boolean }) =>
    authClient.signIn.email({
      ...input,
      callbackURL: typeof window === "undefined" ? "/dashboard" : `${window.location.origin}/dashboard`,
    }),
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    callbackURL: string;
    countryCode: string;
  }) =>
    authClient.signUp.email({
      name: input.name,
      email: input.email,
      password: input.password,
      callbackURL: input.callbackURL,
      fetchOptions: { headers: { "x-hisaab-country": input.countryCode } },
    }),
  signOut: () => authClient.signOut(),
  requestPasswordReset: (input: { email: string; redirectTo: string }) =>
    authClient.requestPasswordReset(input),
  resetPassword: (input: { newPassword: string; token: string }) => authClient.resetPassword(input),
  sendVerificationEmail: (email: string) =>
    authClient.sendVerificationEmail({
      email,
      callbackURL: typeof window === "undefined" ? "/dashboard" : `${window.location.origin}/dashboard`,
    }),
  sendVerificationCode: (email: string) =>
    api<{ sent: true; otp?: string }>("/api/auth/send-verification-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verifyEmailCode: (email: string, code: string) =>
    api<{ verified: true }>("/api/auth/verify-email-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
};
