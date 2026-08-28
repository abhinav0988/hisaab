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
