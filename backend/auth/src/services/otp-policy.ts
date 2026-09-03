export function shouldExposeSignupOtp(env: {
  ENVIRONMENT: string;
  AUTH_DEV_EXPOSE_OTP?: string;
  E2E_DISABLE_RATE_LIMIT?: string;
}) {
  return (
    env.ENVIRONMENT !== "production" ||
    env.AUTH_DEV_EXPOSE_OTP === "true" ||
    env.E2E_DISABLE_RATE_LIMIT === "1"
  );
}
