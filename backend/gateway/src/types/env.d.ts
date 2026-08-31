interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  APP_ORIGIN: string;
  BETTER_AUTH_URL: string;
  RATE_LIMIT_SECRET: string;
  E2E_DISABLE_RATE_LIMIT?: string;
  AUTH: Fetcher;
  PROFILE: Fetcher;
  ACCOUNTS: Fetcher;
  CATEGORIES: Fetcher;
  TRANSACTIONS: Fetcher;
  BUDGETS: Fetcher;
  REPORTS: Fetcher;
  RECURRING: Fetcher;
  FINANCE: Fetcher;
}
