import type { Account } from "@hisaab/types";
import { money } from "./format";

export const INDIAN_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "State Bank of India",
  "Punjab National Bank",
  "Bank of Baroda",
  "Yes Bank",
  "IndusInd Bank",
  "IDFC First Bank",
  "Union Bank of India",
  "Canara Bank",
] as const;

export const BANK_ACCOUNT_TYPES = ["Savings", "Current", "Salary"] as const;

const LAST4_RE = /···(\d{4})$/;

export function bankLast4(name: string) {
  const match = LAST4_RE.exec(name);
  return match?.[1] ?? null;
}

export function bankMaskDisplay(last4: string | null) {
  return last4 ? `**** ${last4}` : "**** ••••";
}

export function bankLabel(account: Pick<Account, "name" | "institutionName">) {
  const institution = account.institutionName?.trim();
  if (institution) {
    const base = institution.split(" ·")[0]?.trim();
    return base || institution;
  }
  return account.name.replace(LAST4_RE, "").trim() || "Bank";
}

export function bankSubtype(account: Pick<Account, "name">) {
  const base = account.name.replace(LAST4_RE, "").trim();
  const match = /^(Savings|Current|Salary)/i.exec(base);
  return match ? match[1] : "Savings";
}

export function bankNickname(account: Pick<Account, "name">) {
  const base = account.name.replace(LAST4_RE, "").trim();
  return base.replace(/^(Savings|Current|Salary)\s*/i, "").trim();
}

export function formatBankAccountName(
  subtype: string,
  last4: string,
  nickname?: string,
) {
  const label = nickname?.trim() || subtype;
  const digits = last4.replace(/\D/g, "").slice(-4);
  return digits ? `${label} ···${digits}` : label;
}

export function bankAbbrev(label: string) {
  const words = label.trim().split(/\s+/);
  if (words.length === 1) return words[0]?.slice(0, 2).toUpperCase() ?? "BK";
  return words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export function bankBrandTone(label: string) {
  const key = label.toLowerCase();
  if (key.includes("hdfc")) return "hdfc";
  if (key.includes("icici")) return "icici";
  if (key.includes("axis")) return "axis";
  if (key.includes("kotak")) return "kotak";
  if (key.includes("sbi") || key.includes("state bank")) return "sbi";
  return "default";
}

export function deltaPct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function avgMonthlyBalance(
  totalMinor: number,
  monthly: Array<{ income: number; expense: number }>,
) {
  if (!monthly.length) return totalMinor;
  const balances = [totalMinor];
  let running = totalMinor;
  for (let index = monthly.length - 2; index >= 0; index -= 1) {
    const item = monthly[index];
    if (!item) continue;
    running -= item.income - item.expense;
    balances.push(Math.max(0, running));
  }
  return Math.round(balances.reduce((sum, value) => sum + value, 0) / balances.length);
}

export function bankAccountLabel(
  account: Pick<Account, "name" | "institutionName" | "currentBalanceMinor" | "currency">,
  currency = "INR",
) {
  const label = bankLabel(account);
  const last4 = bankLast4(account.name);
  const digits = last4 ? ` · •••• ${last4}` : "";
  return `${label}${digits} · ${money(account.currentBalanceMinor, account.currency ?? currency)} available`;
}

export function bankSpendCopy(
  account: Pick<Account, "name" | "institutionName">,
  deltaMinor: number,
  nextBalanceMinor: number,
  currency = "INR",
) {
  const label = bankLabel(account);
  const last4 = bankLast4(account.name);
  const suffix = last4 ? ` (${last4})` : "";
  if (deltaMinor < 0) {
    return `${money(Math.abs(deltaMinor), currency)} deducted from ${label}${suffix}. Balance now ${money(nextBalanceMinor, currency)}.`;
  }
  if (deltaMinor > 0) {
    return `${money(deltaMinor, currency)} added to ${label}${suffix}. Balance now ${money(nextBalanceMinor, currency)}.`;
  }
  return `Transaction saved on ${label}${suffix}.`;
}

export function downloadBankCsv(
  accounts: Account[],
  currency: string,
  totalMinor: number,
) {
  const rows = [
    ["Bank", "Account", "Last 4", "Balance", "Currency"],
    ...accounts.map((account) => [
      bankLabel(account),
      bankSubtype(account),
      bankLast4(account.name) ?? "",
      String(account.currentBalanceMinor / 100),
      account.currency,
    ]),
    ["Total", "", "", String(totalMinor / 100), currency],
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "hisaab-bank-summary.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
