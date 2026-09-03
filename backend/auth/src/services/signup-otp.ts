import { newId, now } from "../lib/http";
import { sendAuthEmail } from "./send-auth-email";
import { shouldExposeSignupOtp } from "./otp-policy";

const OTP_TTL_MS = 10 * 60 * 1000;
const VERIFIED_TTL_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

type WaitUntilContext = { waitUntil(promise: Promise<unknown>): void };

function otpKey(email: string) {
  return `hisaab-signup-otp:${email.trim().toLowerCase()}`;
}
function verifiedKey(email: string) {
  return `hisaab-signup-otp-ok:${email.trim().toLowerCase()}`;
}
function failKey(email: string) {
  return `hisaab-signup-otp-fail:${email.trim().toLowerCase()}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.byteLength, b.byteLength);
  let diff = a.byteLength ^ b.byteLength;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function sixDigitCode() {
  const digits = new Array<string>(6);
  for (let index = 0; index < 6; index += 1) {
    const bytes = new Uint8Array(1);
    do {
      crypto.getRandomValues(bytes);
    } while ((bytes[0] ?? 0) >= 250);
    digits[index] = String((bytes[0] ?? 0) % 10);
  }
  return digits.join("");
}

async function replaceVerification(env: Env, identifier: string, value: string, expiresAt: string) {
  await env.DB.prepare("DELETE FROM verification WHERE identifier = ?").bind(identifier).run();
  await env.DB.prepare(
    "INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(newId(), identifier, value, expiresAt, now(), now())
    .run();
}

async function deleteVerification(env: Env, identifier: string) {
  await env.DB.prepare("DELETE FROM verification WHERE identifier = ?").bind(identifier).run();
}

export async function sendSignupOtp(env: Env, ctx: WaitUntilContext, email: string) {
  const normalized = email.trim().toLowerCase();
  const code = sixDigitCode();
  await replaceVerification(
    env,
    otpKey(normalized),
    await sha256(code),
    new Date(Date.now() + OTP_TTL_MS).toISOString(),
  );
  await deleteVerification(env, verifiedKey(normalized));
  await deleteVerification(env, failKey(normalized));
  await sendAuthEmail(env, ctx, "otp", normalized, code);
  const exposeOtp = shouldExposeSignupOtp(env);
  return {
    sent: true as const,
    otp: exposeOtp ? code : undefined,
  };
}

export async function verifySignupOtp(env: Env, email: string, code: string) {
  const normalized = email.trim().toLowerCase();
  const row = await env.DB.prepare(
    "SELECT value, expiresAt FROM verification WHERE identifier = ? LIMIT 1",
  )
    .bind(otpKey(normalized))
    .first<{ value: string; expiresAt: string }>();
  if (!row || new Date(row.expiresAt).getTime() < Date.now()) return false;
  if (!timingSafeEqual(row.value, await sha256(code.trim()))) {
    const fails = await env.DB.prepare(
      "SELECT value FROM verification WHERE identifier = ? LIMIT 1",
    )
      .bind(failKey(normalized))
      .first<{ value: string }>();
    const attempts = Number(fails?.value ?? 0) + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await deleteVerification(env, otpKey(normalized));
      await deleteVerification(env, failKey(normalized));
      return false;
    }
    await replaceVerification(env, failKey(normalized), String(attempts), row.expiresAt);
    return false;
  }
  await deleteVerification(env, otpKey(normalized));
  await deleteVerification(env, failKey(normalized));
  await replaceVerification(
    env,
    verifiedKey(normalized),
    "1",
    new Date(Date.now() + VERIFIED_TTL_MS).toISOString(),
  );
  await env.DB.prepare("UPDATE user SET emailVerified = 1, updatedAt = ? WHERE email = ?")
    .bind(now(), normalized)
    .run();
  return true;
}

export async function hasVerifiedSignupOtp(env: Env, email: string) {
  const row = await env.DB.prepare(
    "SELECT expiresAt FROM verification WHERE identifier = ? LIMIT 1",
  )
    .bind(verifiedKey(email.trim().toLowerCase()))
    .first<{ expiresAt: string }>();
  return Boolean(row && new Date(row.expiresAt).getTime() >= Date.now());
}

export async function consumeVerifiedSignupOtp(env: Env, email: string, userId: string) {
  await env.DB.prepare("UPDATE user SET emailVerified = 1, updatedAt = ? WHERE id = ?")
    .bind(now(), userId)
    .run();
  await deleteVerification(env, otpKey(email));
  await deleteVerification(env, verifiedKey(email));
  await deleteVerification(env, failKey(email));
}
