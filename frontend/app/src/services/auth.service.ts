/**
 * Auth is UI-first in this pass. Wire these methods to Better Auth +
 * expo-secure-store before shipping a signed-in production build.
 */
export const authService = {
  async signIn(_input: { email: string; password: string }) {
    return { ok: true as const };
  },
  async signUp(_input: { name: string; email: string; password: string }) {
    return { ok: true as const };
  },
  async requestReset(_email: string) {
    return { ok: true as const };
  },
  async verifyOtp(_code: string) {
    return { ok: true as const };
  },
  async resetPassword(_password: string) {
    return { ok: true as const };
  },
  async signOut() {
    return { ok: true as const };
  },
};
