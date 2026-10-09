/** Gateway origin. Cookies will not work in Expo Go; token auth is the next wiring step. */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://hisaab-gateway.blobforges.workers.dev";

/** These values are sent centrally by the API client, never chosen by a screen. */
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? "1.0.0";
export const REQUEST_TIMEOUT_MS = 15_000;
