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
