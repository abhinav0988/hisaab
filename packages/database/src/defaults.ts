export const COUNTRY_REGIONS = {
  IN: { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata" },
  NP: { code: "NP", name: "Nepal", currency: "NPR", timezone: "Asia/Kathmandu" },
  PK: { code: "PK", name: "Pakistan", currency: "PKR", timezone: "Asia/Karachi" },
  BD: { code: "BD", name: "Bangladesh", currency: "BDT", timezone: "Asia/Dhaka" },
} as const;

export type CountryCode = keyof typeof COUNTRY_REGIONS;

export function regionFromCountry(code: string | null | undefined) {
  const key = (code ?? "IN").toUpperCase();
  if (key in COUNTRY_REGIONS) return COUNTRY_REGIONS[key as CountryCode];
  return COUNTRY_REGIONS.IN;
}

export function defaultUserPreferences(userId: string, countryCode?: string | null) {
  const region = regionFromCountry(countryCode);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    countryCode: region.code,
    defaultCurrency: region.currency,
    timezone: region.timezone,
    dateFormat: "DD/MM/YYYY" as const,
    theme: "system" as const,
    language: "en" as const,
    profileNote: null as string | null,
    smartNotifications: true,
    weeklySummary: true,
    appLockEnabled: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const ACCOUNT_CATALOG = [
  {
    id: "catalog-cash",
    type: "CASH" as const,
    name: "Cash",
    description: "Physical cash and day-to-day notes",
    sortOrder: 1,
  },
  {
    id: "catalog-bank",
    type: "BANK" as const,
    name: "Bank",
    description: "Savings or current bank account",
    sortOrder: 2,
  },
  {
    id: "catalog-upi",
    type: "UPI" as const,
    name: "UPI",
    description: "UPI apps and linked bank handles",
    sortOrder: 3,
  },
  {
    id: "catalog-wallet",
    type: "MOBILE_WALLET" as const,
    name: "Wallet",
    description: "Mobile wallets and prepaid balances",
    sortOrder: 4,
  },
  {
    id: "catalog-credit",
    type: "CREDIT_CARD" as const,
    name: "Credit card",
    description: "Credit card spending",
    sortOrder: 5,
  },
  {
    id: "catalog-debit",
    type: "DEBIT_CARD" as const,
    name: "Debit card",
    description: "Debit card linked to your bank",
    sortOrder: 6,
  },
] as const;

export function defaultSubscription(userId: string, countryCode?: string | null) {
  const region = regionFromCountry(countryCode);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    plan: "free" as const,
    status: "inactive" as const,
    billingInterval: null as string | null,
    currency: region.currency,
    amountMinor: null as number | null,
    trialEndsAt: null as string | null,
    currentPeriodEndsAt: null as string | null,
    canceledAt: null as string | null,
    createdAt: now,
    updatedAt: now,
  };
}
