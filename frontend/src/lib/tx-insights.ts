import type { Account, AccountType, Transaction } from "@hisaab/types";
import { accountDisplayName, accountTypeLabel } from "./accounts";
import { localDateKey, money } from "./format";

export function merchantTone(item: Pick<Transaction, "type" | "categoryName" | "merchant">) {
  const name = `${item.categoryName ?? ""} ${item.merchant ?? ""}`.toLowerCase();
  if (item.type === "INCOME" || name.includes("salary")) return "salary";
  if (name.includes("groc") || name.includes("supermarket") || name.includes("dmart")) return "grocery";
  if (name.includes("food") || name.includes("dining") || name.includes("cafe") || name.includes("swiggy") || name.includes("zomato"))
    return "food";
  if (name.includes("uber") || name.includes("transport") || name.includes("metro") || name.includes("fuel")) return "transport";
  if (name.includes("bill") || name.includes("utilit") || name.includes("electric") || name.includes("rent")) return "bills";
  if (name.includes("shop") || name.includes("amazon") || name.includes("store")) return "shop";
  if (name.includes("entertain") || name.includes("movie")) return "ent";
  return "shop";
}

export function paymentMode(account?: Account) {
  if (!account) return { method: "Account", provider: "Hisaab" };
  const type = account.type as AccountType;
  if (type === "UPI") return { method: "UPI", provider: account.institutionName || "UPI" };
  if (type === "CREDIT_CARD" || type === "DEBIT_CARD") return { method: "Card", provider: accountTypeLabel(type) };
  if (type === "BANK") return { method: "Bank", provider: account.institutionName || "Transfer" };
  if (type === "CASH") return { method: "Cash", provider: "Cash" };
  if (type === "MOBILE_WALLET") return { method: "Wallet", provider: account.institutionName || "Wallet" };
  return { method: accountTypeLabel(type), provider: account.institutionName || accountDisplayName(account) };
}

export function dayKeysEnding(end: Date, count: number) {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(localDateKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - offset)));
  }
  return keys;
}

export function spendByDay(items: Transaction[], keys: string[]) {
  return keys.map((key) => {
    const minor = items
      .filter((item) => item.type === "EXPENSE" && localDateKey(item.transactionAt) === key)
      .reduce((sum, item) => sum + item.amountMinor, 0);
    const date = new Date(`${key}T12:00:00`);
    return {
      key,
      minor,
      label: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date),
      longLabel: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date),
    };
  });
}

export function lastTenDaySpend(items: Transaction[], now = new Date()) {
  return spendByDay(items, dayKeysEnding(now, 10));
}

export function previousTenDaySpend(items: Transaction[], now = new Date()) {
  const endOfPrevious = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10);
  return spendByDay(items, dayKeysEnding(endOfPrevious, 10)).reduce((sum, item) => sum + item.minor, 0);
}

export function percentChange(current: number, previous: number) {
  if (!previous && !current) return { label: "No spend in the last 20 days", down: false };
  if (!previous) return { label: "No spend in the previous 10 days", down: false };
  const delta = ((current - previous) / previous) * 100;
  return {
    down: delta > 0,
    label: `${delta >= 0 ? "↗" : "↘"} ${Math.abs(delta).toFixed(1)}% vs previous 10 days`,
  };
}

export function niceAxis(maxMinor: number) {
  const rupees = Math.max(1, Math.ceil(maxMinor / 100));
  const step = rupees <= 5000 ? 1000 : rupees <= 15000 ? 5000 : 10000;
  return Math.max(step, Math.ceil(rupees / step) * step) * 100;
}

export function axisLabel(minor: number, currency: string) {
  const rupees = minor / 100;
  if (rupees >= 1000) return `${currency === "INR" ? "₹" : ""}${Math.round(rupees / 1000)}K`;
  return money(minor, currency).replace(".00", "");
}

export function topExpenseCategory(items: Transaction[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.type !== "EXPENSE") continue;
    const key = item.categoryName ?? "Uncategorised";
    totals.set(key, (totals.get(key) ?? 0) + item.amountMinor);
  }
  let name = "No expenses";
  let minor = 0;
  for (const [key, value] of totals) {
    if (value > minor) {
      name = key;
      minor = value;
    }
  }
  return { name, minor };
}

export function visiblePageNumbers(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)));
  return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
}
