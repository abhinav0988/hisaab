interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  APP_ORIGIN: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  EMAIL_WEBHOOK_URL?: string;
  EMAIL_WEBHOOK_TOKEN?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_DEV_EXPOSE_OTP?: string;
}
