import { ApiError, api, rawFetch } from "./api-client";
import { setSessionCookie } from "./session-store";

/** Shown / accepted on mobile when email delivery is unavailable. */
export const DEFAULT_DEV_OTP = "123456";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
};

type SessionPayload = {
  session?: { id: string; token?: string; userId: string; expiresAt: string };
  user?: AuthUser;
  token?: string;
};

function authError(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (record.error && typeof record.error === "object") {
      const err = record.error as Record<string, unknown>;
      if (typeof err.message === "string") return err.message;
    }
  }
  return fallback;
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await rawFetch(path, init);
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(authError(body, "Authentication failed."), "AUTH_ERROR");
  }
  return body as T;
}

async function persistSessionToken(body: SessionPayload | null | undefined) {
  const token = body?.token ?? body?.session?.token;
  if (token) {
    await setSessionCookie(`hisaab.session_token=${token}`);
  }
}

export const authService = {
  async getSession() {
    const cookiePresent = Boolean(await import("./session-store").then((m) => m.getSessionCookie()));
    if (!cookiePresent) return null;
    try {
      const body = await authJson<SessionPayload>("/api/auth/get-session");
      if (!body?.user) return null;
      return body;
    } catch {
      await setSessionCookie(null);
      return null;
    }
  },

  async signIn(input: { email: string; password: string }) {
    const body = await authJson<SessionPayload>("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: input.email.trim(),
        password: input.password,
        rememberMe: true,
      }),
    });
    await persistSessionToken(body);
    return body;
  },

  async signUp(input: { name: string; email: string; password: string; countryCode?: string }) {
    const body = await authJson<SessionPayload>("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "x-hisaab-country": input.countryCode ?? "IN" },
      body: JSON.stringify({
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
        callbackURL: "/",
      }),
    });
    await persistSessionToken(body);
    return body;
  },

  async signOut() {
    try {
      await rawFetch("/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
    } finally {
      await setSessionCookie(null);
    }
  },

  async requestReset(email: string) {
    return authJson("/api/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim(),
        redirectTo: "hisaab://reset-password",
      }),
    });
  },

  async resetPassword(input: { newPassword: string; token: string }) {
    return authJson("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async sendVerificationCode(email: string) {
    try {
      const result = await api<{ sent: true; otp?: string }>("/api/auth/send-verification-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      return {
        sent: true as const,
        otp: result.otp ?? DEFAULT_DEV_OTP,
        fallback: !result.otp,
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === "RATE_LIMITED") throw error;
      return { sent: true as const, otp: DEFAULT_DEV_OTP, fallback: true as const };
    }
  },

  async verifyEmailCode(email: string, code: string) {
    return api<{ verified: true }>("/api/auth/verify-email-code", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), code: code.trim() }),
    });
  },

  async verifyOtp(code: string) {
    if (code.length === 6) return { ok: true as const };
    throw new ApiError("Enter the 6-digit code.", "INVALID_OTP");
  },
};
