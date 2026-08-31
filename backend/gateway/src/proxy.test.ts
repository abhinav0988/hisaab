import { INTERNAL_HEADER, USER_ID_HEADER } from "@hisaab/worker-lib";
import { describe, expect, it } from "vitest";
import { proxyTo } from "./lib/proxy";

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
