import type { Account, AccountType } from "@hisaab/types";

const ACCOUNT_LABELS: Record<AccountType, string> = {
  CASH: "Cash",
  BANK: "Bank",
  UPI: "UPI",
  MOBILE_WALLET: "Wallet",
  CREDIT_CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  OTHER: "Other",
};

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "CASH",
  "BANK",
  "UPI",
  "MOBILE_WALLET",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "OTHER",
];

export function accountTypeLabel(type: AccountType | string) {
  return ACCOUNT_LABELS[type as AccountType] ?? "Other";
}

export function accountDisplayName(account: Pick<Account, "name" | "type">) {
  const canonical = accountTypeLabel(account.type);
  const raw = account.name.trim();
  const typeWords = account.type.replaceAll("_", " ");
  const stripped = raw.replace(new RegExp(`[\\s]*[-–—][\\s]*${typeWords}$`, "i"), "").trim();
  if (!stripped) return canonical;
  const lower = stripped.toLowerCase();
  if (lower === typeWords.toLowerCase() || lower === canonical.toLowerCase()) return canonical;
  return stripped;
}

export function tidyAccountLabel(value: string | null | undefined) {
  if (!value?.trim()) return "Account";
  const trimmed = value.trim();
  for (const [type, label] of Object.entries(ACCOUNT_LABELS)) {
    const slug = type.replaceAll("_", " ");
    const pattern = new RegExp(`^(${label}|${slug})\\s*[-–—]\\s*${slug}$`, "i");
    if (pattern.test(trimmed)) return label;
  }
  return trimmed;
}

export function resolveAccountLabel(
  accounts: Account[] | undefined,
  accountId: string | undefined,
  fallback?: string | null,
) {
  const match = accounts?.find((item) => item.id === accountId);
  if (match) return accountDisplayName(match);
  return tidyAccountLabel(fallback);
}

export function isOpenAccount(account: Account) {
  return account.isActive === true || Number(account.isActive) === 1;
}

export const PAYMENT_METHOD_TYPES = ["UPI", "CREDIT_CARD"] as const;

export function isPaymentMethodType(type: string) {
  return (PAYMENT_METHOD_TYPES as readonly string[]).includes(type);
}

export function paymentMethodAccounts(accounts: Account[]) {
  return uniqueCatalogAccounts(accounts).filter((item) => isPaymentMethodType(item.type));
}

export function uniqueCatalogAccounts(accounts: Account[], keepId?: string) {
  const open = accounts.filter(isOpenAccount);
  const source = open.length ? open : accounts;
  const catalogued = source.filter((item) => item.catalogId);
  const pool = catalogued.length ? catalogued : source;
  const ranked = [...pool].sort((left, right) => {
    const linked = Number(!left.catalogId) - Number(!right.catalogId);
    if (linked) return linked;
    const typeDelta =
      ACCOUNT_TYPE_ORDER.indexOf(left.type) - ACCOUNT_TYPE_ORDER.indexOf(right.type);
    if (typeDelta) return typeDelta;
    return accountDisplayName(left).localeCompare(accountDisplayName(right));
  });
  const seen = new Set<string>();
  const unique: Account[] = [];
  for (const item of ranked) {
    const typeKey = (item.catalogId || item.type).toLowerCase();
    const nameKey = accountDisplayName(item).toLowerCase();
    if (seen.has(`type:${typeKey}`) || seen.has(`name:${nameKey}`)) continue;
    seen.add(`type:${typeKey}`);
    seen.add(`name:${nameKey}`);
    unique.push(item);
  }
  if (keepId && !unique.some((item) => item.id === keepId)) {
    const kept = accounts.find((item) => item.id === keepId);
    if (kept) unique.unshift(kept);
  }
  return unique;
}
