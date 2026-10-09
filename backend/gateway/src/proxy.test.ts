import { INTERNAL_HEADER, USER_ID_HEADER } from "@hisaab/worker-lib";
import { describe, expect, it } from "vitest";
import { domainFetcher, proxyTo } from "./lib/proxy";

describe("proxy header isolation", () => {
  it("drops client-supplied internal identity headers", async () => {
    let seen: Headers | undefined;
    const fetcher = {
      fetch: async (request: Request) => {
        seen = new Headers(request.headers);
        return new Response("ok");
      },
    } as Fetcher;
    await proxyTo(
      fetcher,
      new Request("https://gateway.test/api/auth/get-session", {
        headers: { [INTERNAL_HEADER]: "1", [USER_ID_HEADER]: "attacker" },
      }),
    );
    expect(seen?.get(INTERNAL_HEADER)).toBeNull();
    expect(seen?.get(USER_ID_HEADER)).toBeNull();
  });

  it("sets internal identity only after the gateway resolves a session", async () => {
    let seen: Headers | undefined;
    const fetcher = {
      fetch: async (request: Request) => {
        seen = new Headers(request.headers);
        return new Response("ok");
      },
    } as Fetcher;
    await proxyTo(
      fetcher,
      new Request("https://gateway.test/api/v1/profile", {
        headers: { [USER_ID_HEADER]: "attacker" },
      }),
      "user-123",
    );
    expect(seen?.get(INTERNAL_HEADER)).toBe("1");
    expect(seen?.get(USER_ID_HEADER)).toBe("user-123");
  });
});

describe("domain routing", () => {
  const env = {
    TRANSACTIONS: { name: "transactions" },
    FINANCE: { name: "finance" },
  } as unknown as Env;

  it("sends new file, OCR, and tag routes to the owning workers", () => {
    expect(domainFetcher(env, "/api/v1/files")).toBe(env.FINANCE);
    expect(domainFetcher(env, "/api/v1/ocr/receipt")).toBe(env.FINANCE);
    expect(domainFetcher(env, "/api/v1/loans/abc/payments")).toBe(env.FINANCE);
    expect(domainFetcher(env, "/api/v1/credit-facilities/abc/payments")).toBe(env.FINANCE);
    expect(domainFetcher(env, "/api/v1/lend-records/abc/repayments")).toBe(env.FINANCE);
    expect(domainFetcher(env, "/api/v1/tags")).toBe(env.TRANSACTIONS);
    expect(domainFetcher(env, "/api/v1/transactions/abc/attachments")).toBe(env.TRANSACTIONS);
  });
});
