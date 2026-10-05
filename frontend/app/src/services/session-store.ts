import * as SecureStore from "expo-secure-store";

const SESSION_COOKIE_KEY = "hisaab.session_cookie";

export async function getSessionCookie() {
  return SecureStore.getItemAsync(SESSION_COOKIE_KEY);
}

export async function setSessionCookie(cookie: string | null) {
  if (!cookie) {
    await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_COOKIE_KEY, cookie);
}

/** Pull Better Auth session cookie pairs from a Set-Cookie header blob. */
export function extractSessionCookie(setCookie: string | null) {
  if (!setCookie) return null;
  const parts = setCookie.split(/,(?=\s*[^;]+=[^;]+)/);
  const pairs: string[] = [];
  for (const part of parts) {
    const [pair = ""] = part.split(";");
    const trimmed = pair.trim();
    if (!trimmed) continue;
    if (/session_token|session_data/i.test(trimmed)) pairs.push(trimmed);
  }
  return pairs.length ? pairs.join("; ") : null;
}
