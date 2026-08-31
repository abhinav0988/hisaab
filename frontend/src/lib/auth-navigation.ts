const AUTH_PATH = /^\/(login|register|verify-email|forgot-password|reset-password|session-expired|access-denied)(\/|\?|$)/;

export function safeAppPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  if (AUTH_PATH.test(next)) return "/dashboard";
  return next;
}

export function enterApp(next?: string | null) {
  const path = safeAppPath(next);
  if (typeof window === "undefined") return;
  window.location.assign(path);
}
