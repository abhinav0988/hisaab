import { authClient } from "@/lib/auth-client";

export const authService = {
  useSession: () => authClient.useSession(),
  signIn: (input: { email: string; password: string; rememberMe: boolean }) =>
    authClient.signIn.email(input),
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
};
