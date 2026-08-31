import { AppError } from "@hisaab/worker-lib";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { browserCors, csrfGuard, mutationIsCsrfSafe, sameOrigin } from "./middleware/security";

const APP_ORIGIN = "https://hisaab.blobforges.workers.dev";

function app() {
  const instance = new Hono<{ Bindings: Env }>();
  instance.use("/api/*", browserCors);
  instance.all("/api/auth/*", (c) =>
    c.json({ ok: true }, 200, { "x-upstream": "auth" }),
  );
  instance.all("/api/v1/*", (c) => c.json({ ok: true }, 401));
  return instance;
}

const env = { APP_ORIGIN } as Env;

describe("sameOrigin", () => {
  it("matches the configured app origin", () => {
    expect(sameOrigin(APP_ORIGIN, APP_ORIGIN)).toBe(true);
    expect(sameOrigin(`${APP_ORIGIN}/`, APP_ORIGIN)).toBe(true);
    expect(sameOrigin("https://evil.example", APP_ORIGIN)).toBe(false);
  });
});

describe("browser CORS", () => {
  it("allows signup preflight with the country header", async () => {
    const response = await app().request(
      "https://gateway.test/api/auth/sign-up/email",
      {
        method: "OPTIONS",
        headers: {
          Origin: APP_ORIGIN,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,x-hisaab-country",
        },
      },
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    const allowed = response.headers.get("Access-Control-Allow-Headers")?.toLowerCase() ?? "";
    expect(allowed).toContain("content-type");
    expect(allowed).toContain("x-hisaab-country");
  });

  it("stamps CORS on proxied auth and domain JSON responses", async () => {
    const auth = await app().request(
      "https://gateway.test/api/auth/get-session",
      { headers: { Origin: APP_ORIGIN } },
      env,
    );
    expect(auth.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
    const profile = await app().request(
      "https://gateway.test/api/v1/profile",
      { headers: { Origin: APP_ORIGIN } },
      env,
    );
    expect(profile.status).toBe(401);
    expect(profile.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
  });

  it("does not echo an unknown origin", async () => {
    const response = await app().request(
      "https://gateway.test/api/auth/sign-in/email",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "POST",
        },
      },
      env,
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("CSRF guard", () => {
  const csrfEnv = {
    APP_ORIGIN,
    BETTER_AUTH_URL: "https://hisaab-gateway.blobforges.workers.dev",
  } as Env;

  it("allows same-site browser mutations from the app origin", () => {
    expect(
      mutationIsCsrfSafe("POST", APP_ORIGIN, "same-site", csrfEnv),
    ).toBe(true);
  });

  it("rejects cross-site mutations", () => {
    expect(mutationIsCsrfSafe("POST", "https://evil.example", "cross-site", csrfEnv)).toBe(false);
  });

  it("rejects mutating requests with no origin and no fetch metadata", () => {
    expect(mutationIsCsrfSafe("PATCH", undefined, undefined, csrfEnv)).toBe(false);
  });

  it("blocks forged origin on the gateway", async () => {
    const instance = new Hono<{ Bindings: Env }>();
    instance.use("/api/*", csrfGuard);
    instance.post("/api/v1/investments", (c) => c.json({ ok: true }));
    instance.onError((error, c) => {
      if (error instanceof AppError) return c.json({ code: error.code }, error.status);
      return c.json({ code: "INTERNAL" }, 500);
    });
    const response = await instance.request(
      "https://gateway.test/api/v1/investments",
      { method: "POST", headers: { Origin: "https://evil.example" } },
      csrfEnv,
    );
    expect(response.status).toBe(403);
  });
});
