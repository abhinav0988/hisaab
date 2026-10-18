import type { Account } from "@hisaab/types";

export const PAYMENT_METHOD_TYPES = ["BANK", "UPI", "CREDIT_CARD"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export function isOpenAccount(account: Account) {
  return account.isActive === true;
}

export function isPaymentMethodType(type: string): type is PaymentMethodType {
  return (PAYMENT_METHOD_TYPES as readonly string[]).includes(type);
}

/** One catalog stub per type (Cash / Bank / UPI / …) for the Account channel picker. */
export function uniqueCatalogChannels(accounts: Account[]): Account[] {
  const open = accounts.filter(isOpenAccount);
  const catalogued = open.filter((item) => item.catalogId);
  const pool = catalogued.length
    ? catalogued
    : open.filter((item) => !item.institutionName || item.type !== "BANK");
  const byType = new Map<string, Account>();
  for (const item of pool) {
    const existing = byType.get(item.type);
    if (!existing || (item.catalogId && !existing.catalogId)) {
      byType.set(item.type, item);
    }
  }
  const order = ["CASH", "BANK", "UPI", "MOBILE_WALLET", "DEBIT_CARD", "CREDIT_CARD"];
  return [...byType.values()].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.name.localeCompare(b.name),
  );
}

export function paymentMethodChannels(channels: Account[]) {
  return channels.filter((item) => isPaymentMethodType(item.type));
}

export function bankAccountLabel(account: Account, currency = account.currency ?? "INR") {
  const institution = account.institutionName?.trim();
  const base = institution ? `${account.name} · ${institution}` : account.name;
  const available = (account.currentBalanceMinor / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${base} · ${symbol}${available} available`;
}

/** Short bank chip label without balance (lists / previews that already show money). */
export function bankAccountName(account: Account) {
  const institution = account.institutionName?.trim();
  return institution ? `${account.name} · ${institution}` : account.name;
}

export function channelLabel(account: Account) {
  if (account.type === "CREDIT_CARD") return "Credit card";
  if (account.type === "DEBIT_CARD") return "Debit card";
  if (account.type === "MOBILE_WALLET") return "Wallet";
  if (account.type === "BANK") return "Bank";
  if (account.type === "UPI") return "UPI";
  if (account.type === "CASH") return "Cash";
  return account.name;
}
