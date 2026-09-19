/** Gateway origin. Cookies will not work in Expo Go; token auth is the next wiring step. */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://hisaab-gateway.blobforges.workers.dev";
