import { Hono } from "hono";
import { AppError } from "../lib/errors";
import { ok } from "../lib/http";
import { sendSignupOtp, verifySignupOtp } from "../services/signup-otp";

function readEmail(body: unknown) {
  if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string") {
    throw new AppError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }
  return email;
}

export const otpRoutes = new Hono<{ Bindings: Env }>();

otpRoutes.post("/api/auth/send-verification-code", async (c) => {
  const email = readEmail(await c.req.json().catch(() => ({})));
  return ok(c, await sendSignupOtp(c.env, c.executionCtx, email));
});

otpRoutes.post("/api/auth/verify-email-code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = readEmail(body);
  const code =
    body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code.trim()
      : "";
  if (!/^\d{6}$/.test(code)) {
    throw new AppError(400, "INVALID_OTP", "Enter the complete 6-digit verification code.");
  }
  const verified = await verifySignupOtp(c.env, email, code);
  if (!verified) {
    throw new AppError(400, "INVALID_OTP", "The verification code is incorrect or expired.");
  }
  return ok(c, { verified: true });
});
