#!/usr/bin/env node
/**
 * Split Money API QA harness (local gateway).
 * Does not touch production data.
 */
import { writeFileSync } from "node:fs";

const BASE = process.env.HISAAB_API || "http://localhost:8797";
const ORIGIN = process.env.HISAAB_ORIGIN || "http://localhost:3001";
const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

function jar() {
  const cookies = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      for (const c of raw) {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      // fallback for undici
      const single = res.headers.get("set-cookie");
      if (single && raw.length === 0) {
        for (const part of single.split(/,(?=[^;]+?=)/)) {
          const [pair] = part.split(";");
          const eq = pair.indexOf("=");
          if (eq > 0) cookies.set(pair.trim().slice(0, eq), pair.trim().slice(eq + 1));
        }
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function api(session, path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      cookie: session.header(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  session.store(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function register(prefix) {
  const session = jar();
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const send = await api(session, "/api/auth/send-verification-code", {
    method: "POST",
    body: { email },
  });
  const otp = send.json?.data?.otp || send.json?.otp;
  if (!otp) throw new Error(`OTP missing: ${JSON.stringify(send)}`);
  const verify = await api(session, "/api/auth/verify-email-code", {
    method: "POST",
    body: { email, code: String(otp) },
  });
  if (verify.status >= 400) throw new Error(`verify failed: ${JSON.stringify(verify)}`);
  const signup = await api(session, "/api/auth/sign-up/email", {
    method: "POST",
    body: {
      name: "QA Split User",
      email,
      password: "Secure!12345",
      callbackURL: `${ORIGIN}/dashboard`,
    },
  });
  // Better Auth may set cookies on signup; some flows need sign-in
  if (signup.status >= 400) {
    const signin = await api(session, "/api/auth/sign-in/email", {
      method: "POST",
      body: { email, password: "Secure!12345", rememberMe: true },
    });
    if (signin.status >= 400) throw new Error(`signup/signin failed: ${JSON.stringify({ signup, signin })}`);
  }
  return { session, email };
}

async function main() {
  // Health
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  record("ENV-health", health?.data?.service === "hisaab-gateway" || health?.service === "hisaab-gateway" || JSON.stringify(health).includes("hisaab"), JSON.stringify(health));

  const a = await register("split-a");
  record("AUTH-register-A", true, a.email);

  const dashEmpty = await api(a.session, "/api/v1/split-money/dashboard");
  record(
    "API-dashboard-empty",
    dashEmpty.status === 200 && (dashEmpty.json?.data?.summary?.totalSharedMinor ?? dashEmpty.json?.summary?.totalSharedMinor) === 0,
    `status=${dashEmpty.status} body=${JSON.stringify(dashEmpty.json).slice(0, 200)}`,
  );

  // Invalid expense rejected
  const badExpense = await api(a.session, "/api/v1/split-money/expenses", {
    method: "POST",
    body: {
      title: "Bad",
      category: "Food",
      totalAmountMinor: 1000,
      expenseDate: "2026-10-05",
      payers: [{ personId: "short", paidAmountMinor: 500 }],
      participants: [{ personId: "short" }],
    },
  });
  record("API-reject-invalid-payload", badExpense.status >= 400, `status=${badExpense.status}`);

  // Create people
  const selfList = await api(a.session, "/api/v1/split-money/people");
  const people = selfList.json?.data || selfList.json || [];
  record("API-people-list", selfList.status === 200 && Array.isArray(people), `count=${people.length}`);

  async function createPerson(name) {
    const res = await api(a.session, "/api/v1/split-money/people", {
      method: "POST",
      body: { fullName: name, phone: "9000000000", relationship: "friend", countryCode: "IN" },
    });
    if (res.status >= 400) throw new Error(JSON.stringify(res));
    return res.json?.data || res.json;
  }
  const rohit = await createPerson("Rohit Sharma");
  const priya = await createPerson("Priya Verma");
  const aman = await createPerson("Aman Gupta");
  const refreshed = await api(a.session, "/api/v1/split-money/people");
  const allPeople = refreshed.json?.data || refreshed.json || [];
  const self = allPeople.find((p) => p.isSelf);
  record("API-create-people", !!(self && rohit?.id && priya?.id && aman?.id), `self=${self?.id}`);

  // Payer mismatch rejected
  const mismatch = await api(a.session, "/api/v1/split-money/expenses", {
    method: "POST",
    body: {
      title: "Mismatch",
      category: "Food & Dining",
      totalAmountMinor: 600_000,
      expenseDate: "2026-10-05",
      splitMethod: "equal",
      payers: [{ personId: self.id, paidAmountMinor: 400_000 }],
      participants: [
        { personId: self.id },
        { personId: rohit.id },
        { personId: priya.id },
        { personId: aman.id },
      ],
    },
  });
  record("API-reject-payer-mismatch", mismatch.status >= 400, `status=${mismatch.status}`);

  // Valid equal split
  const created = await api(a.session, "/api/v1/split-money/expenses", {
    method: "POST",
    body: {
      title: "Dinner at Restaurant",
      category: "Food & Dining",
      totalAmountMinor: 600_000,
      currency: "INR",
      expenseDate: "2026-10-05",
      expenseTime: "20:30",
      splitMethod: "equal",
      dueDate: "2026-10-15",
      payers: [{ personId: self.id, paidAmountMinor: 600_000 }],
      participants: [
        { personId: self.id },
        { personId: rohit.id },
        { personId: priya.id },
        { personId: aman.id },
      ],
      reminder: {
        enabled: true,
        channels: ["in_app"],
        firstReminderDaysBefore: 2,
        recurring: true,
        stopAfterSettlement: true,
        message: "Please settle",
      },
    },
  });
  const expense = created.json?.data || created.json;
  record("API-create-equal-expense", created.status < 300 && !!expense?.id, `status=${created.status} id=${expense?.id}`);
  const shares = (expense?.participants || []).map((p) => p.shareAmountMinor);
  record(
    "CALC-equal-1500",
    shares.length === 4 && shares.every((s) => s === 150_000),
    `shares=${JSON.stringify(shares)}`,
  );

  // Partial payment
  const debtor = (expense.participants || []).find((p) => p.personId === rohit.id);
  const pay1 = await api(a.session, `/api/v1/split-money/expenses/${expense.id}/payments`, {
    method: "POST",
    body: {
      participantId: debtor.id,
      payerPersonId: rohit.id,
      receiverPersonId: self.id,
      amountMinor: 50_000,
      method: "upi",
      paymentDate: "2026-10-06",
    },
  });
  const after1 = pay1.json?.data || pay1.json;
  const rohitAfter1 = (after1.participants || []).find((p) => p.personId === rohit.id);
  record(
    "API-partial-payment-1",
    pay1.status < 300 &&
      rohitAfter1?.paidAmountMinor === 50_000 &&
      rohitAfter1?.pendingAmountMinor === 100_000 &&
      (rohitAfter1?.status === "partially_paid" || rohitAfter1?.status === "partially_paid"),
    JSON.stringify(rohitAfter1),
  );

  const pay2 = await api(a.session, `/api/v1/split-money/expenses/${expense.id}/payments`, {
    method: "POST",
    body: {
      participantId: debtor.id,
      payerPersonId: rohit.id,
      receiverPersonId: self.id,
      amountMinor: 40_000,
      method: "cash",
      paymentDate: "2026-10-07",
    },
  });
  const after2 = pay2.json?.data || pay2.json;
  const payments = after2.payments || [];
  const rohitAfter2 = (after2.participants || []).find((p) => p.personId === rohit.id);
  record(
    "API-multiple-partial-history",
    payments.length >= 2 && rohitAfter2?.paidAmountMinor === 90_000 && rohitAfter2?.pendingAmountMinor === 60_000,
    `paid=${rohitAfter2?.paidAmountMinor} payments=${payments.length}`,
  );

  // Overpayment
  const payOver = await api(a.session, `/api/v1/split-money/expenses/${expense.id}/payments`, {
    method: "POST",
    body: {
      participantId: debtor.id,
      payerPersonId: rohit.id,
      receiverPersonId: self.id,
      amountMinor: 80_000,
      method: "upi",
      paymentDate: "2026-10-08",
    },
  });
  const afterOver = payOver.json?.data || payOver.json;
  const rohitOver = (afterOver.participants || []).find((p) => p.personId === rohit.id);
  record(
    "API-overpayment",
    rohitOver?.paidAmountMinor === 170_000 && rohitOver?.status === "overpaid",
    JSON.stringify({ paid: rohitOver?.paidAmountMinor, status: rohitOver?.status, pending: rohitOver?.pendingAmountMinor }),
  );

  // Adjustment
  const adj = await api(a.session, `/api/v1/split-money/expenses/${expense.id}/adjustments`, {
    method: "POST",
    body: {
      participantId: debtor.id,
      amountMinor: -20_000,
      type: "discount",
      reason: "QA discount",
    },
  });
  const afterAdj = adj.json?.data || adj.json;
  const rohitAdj = (afterAdj.participants || []).find((p) => p.personId === rohit.id);
  record(
    "API-adjustment",
    adj.status < 300 && rohitAdj?.adjustedShareAmountMinor === 130_000,
    JSON.stringify(rohitAdj),
  );

  // Multi payer create
  const multi = await api(a.session, "/api/v1/split-money/expenses", {
    method: "POST",
    body: {
      title: "Multi Payer Trip",
      category: "Travel",
      totalAmountMinor: 600_000,
      expenseDate: "2026-10-05",
      splitMethod: "equal",
      payers: [
        { personId: self.id, paidAmountMinor: 400_000 },
        { personId: rohit.id, paidAmountMinor: 200_000 },
      ],
      participants: [
        { personId: self.id },
        { personId: rohit.id },
        { personId: priya.id },
        { personId: aman.id },
      ],
    },
  });
  const multiExp = multi.json?.data || multi.json;
  record("API-multi-payer", multi.status < 300 && (multiExp.payers || []).length === 2, `status=${multi.status}`);

  // Group
  const group = await api(a.session, "/api/v1/split-money/groups", {
    method: "POST",
    body: {
      name: "Friends Group",
      description: "QA group",
      category: "Friends & Social",
      groupType: "shared",
      memberPersonIds: [rohit.id, priya.id],
    },
  });
  record("API-create-group", group.status < 300, `status=${group.status}`);

  // History
  const history = await api(a.session, "/api/v1/split-money/history");
  const hist = history.json?.data || history.json;
  record(
    "API-history",
    history.status === 200 && (hist.summary?.totalExpenses ?? 0) >= 1,
    JSON.stringify(hist.summary),
  );

  // Authz
  const b = await register("split-b");
  const forbidden = await api(b.session, `/api/v1/split-money/expenses/${expense.id}`);
  record("AUTHZ-cross-user", [403, 404].includes(forbidden.status), `status=${forbidden.status}`);

  // Percentage validation
  const badPct = await api(a.session, "/api/v1/split-money/expenses", {
    method: "POST",
    body: {
      title: "Bad pct",
      category: "Food",
      totalAmountMinor: 10000,
      expenseDate: "2026-10-05",
      splitMethod: "percentage",
      payers: [{ personId: self.id, paidAmountMinor: 10000 }],
      participants: [
        { personId: self.id, sharePercentageBps: 5000 },
        { personId: rohit.id, sharePercentageBps: 4000 },
      ],
    },
  });
  record("API-reject-bad-percentage", badPct.status === 400, `status=${badPct.status}`);

  // Receipt upload adapter
  const receipt = await api(a.session, "/api/v1/split-money/receipts", {
    method: "POST",
    body: {
      fileUrl: "local://qa-receipt.jpg",
      fileName: "qa.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1200,
    },
  });
  record("API-receipt-upload", receipt.status < 300, `status=${receipt.status}`);

  // Simplify suggestions
  const simplify = await api(a.session, `/api/v1/split-money/expenses/${expense.id}/simplify`, {
    method: "POST",
    body: {},
  });
  record("API-simplify", simplify.status < 300, `status=${simplify.status}`);

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const report = { base: BASE, passed, failed, total: results.length, results };
  writeFileSync(
    new URL("./api-qa-results.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(`\nSUMMARY ${passed}/${results.length} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
