import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { processRecurring } from "../modules/recurring-transactions/service";

const origin = "http://localhost:3000";
const jsonHeaders = { "content-type": "application/json", origin };
async function signUp(email: string) {
  const response = await SELF.fetch("http://localhost/api/auth/sign-up/email", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name: "Test User", email, password: "Secure!12345" }),
  });
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const sessionCookie = setCookie
    .split(/,(?=\s*[^;]+=)/)
    .map((item) => {
      const [cookie = ""] = item.split(";");
      return cookie;
    })
    .find((item) => item.includes("session_token"));
  expect(sessionCookie).toBeTruthy();
  return sessionCookie!;
}
async function request(path: string, cookie: string, init?: RequestInit) {
  return SELF.fetch(`http://localhost${path}`, {
    ...init,
    headers: { ...jsonHeaders, cookie, ...init?.headers },
  });
}

describe.sequential("Hisaab API integration", () => {
  it("reports health and rejects anonymous private access", async () => {
    expect((await SELF.fetch("http://localhost/health")).status).toBe(200);
    expect(
      (await SELF.fetch("http://localhost/api/v1/accounts", { headers: { origin } })).status,
    ).toBe(401);
  });
  it("rejects invalid login without leaking credentials", async () => {
    const response = await SELF.fetch("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email: "nobody@example.com", password: "Wrong!12345" }),
    });
    expect([400, 401]).toContain(response.status);
    expect(await response.text()).not.toContain("Wrong!12345");
  });
  it("supports transaction CRUD and prevents cross-user reads", async () => {
    const cookie = await signUp("owner@example.com");
    const profile = await request("/api/v1/profile", cookie);
    expect(profile.status).toBe(200);
    const accountResponse = await request("/api/v1/accounts", cookie, {
      method: "POST",
      body: JSON.stringify({
        name: "Cash",
        type: "CASH",
        openingBalanceMinor: 50000,
        currency: "INR",
        isActive: true,
      }),
    });
    expect(accountResponse.status).toBe(201);
    const account = ((await accountResponse.json()) as { data: { id: string } }).data;
    await env.DB.prepare(
      "INSERT OR IGNORE INTO categories (id,user_id,name,type,icon,colour,is_system,created_at,updated_at) VALUES ('test-food',NULL,'Food','EXPENSE','Utensils','#D97706',1,datetime('now'),datetime('now'))",
    ).run();
    const transactionResponse = await request("/api/v1/transactions", cookie, {
      method: "POST",
      body: JSON.stringify({
        accountId: account.id,
        categoryId: "test-food",
        type: "EXPENSE",
        amountMinor: 1250,
        currency: "INR",
        merchant: "Cafe",
        notes: "Lunch",
        transactionAt: new Date().toISOString(),
        tags: ["work"],
      }),
    });
    expect(transactionResponse.status).toBe(201);
    const transaction = ((await transactionResponse.json()) as { data: { id: string } }).data;
    expect((await request(`/api/v1/transactions/${transaction.id}`, cookie)).status).toBe(200);
    const otherCookie = await signUp("other@example.com");
    expect((await request(`/api/v1/transactions/${transaction.id}`, otherCookie)).status).toBe(404);
    expect(
      (await request(`/api/v1/transactions/${transaction.id}`, cookie, { method: "DELETE" }))
        .status,
    ).toBe(204);
  });
  it("enforces overall budget uniqueness", async () => {
    const cookie = await signUp("budget@example.com");
    const body = JSON.stringify({
      month: "2026-08",
      categoryId: null,
      amountMinor: 100000,
      alertPercentage: 80,
    });
    expect((await request("/api/v1/budgets", cookie, { method: "POST", body })).status).toBe(201);
    expect((await request("/api/v1/budgets", cookie, { method: "POST", body })).status).toBe(409);
  });
  it("processes a recurring occurrence idempotently", async () => {
    const cookie = await signUp("recurring@example.com");
    const accountResponse = await request("/api/v1/accounts", cookie, {
      method: "POST",
      body: JSON.stringify({
        name: "Bank",
        type: "BANK",
        openingBalanceMinor: 0,
        currency: "INR",
        isActive: true,
      }),
    });
    const account = ((await accountResponse.json()) as { data: { id: string } }).data;
    await env.DB.prepare(
      "INSERT OR IGNORE INTO categories (id,user_id,name,type,icon,colour,is_system,created_at,updated_at) VALUES ('test-rent',NULL,'Rent','EXPENSE','House','#7C3AED',1,datetime('now'),datetime('now'))",
    ).run();
    const scheduled = new Date("2026-08-01T00:00:00.000Z");
    const created = await request("/api/v1/recurring-transactions", cookie, {
      method: "POST",
      body: JSON.stringify({
        accountId: account.id,
        categoryId: "test-rent",
        type: "EXPENSE",
        amountMinor: 25000,
        currency: "INR",
        merchant: "Landlord",
        notes: null,
        frequency: "MONTHLY",
        startAt: scheduled.toISOString(),
      }),
    });
    expect(created.status).toBe(201);
    await processRecurring(env, scheduled);
    await processRecurring(env, scheduled);
    const count = await env.DB.prepare(
      "SELECT count(*) AS count FROM recurring_occurrences",
    ).first<{ count: number }>();
    expect(count?.count).toBe(1);
  });
});
