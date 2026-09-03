import { regionFromCountry } from "@hisaab/database";

export function profileRegionDefaults(
  countryCode?: string | null,
  existing?: { defaultCurrency?: string; timezone?: string },
) {
  const region = countryCode ? regionFromCountry(countryCode) : null;
  if (!region) return {};
  return {
    ...(existing?.defaultCurrency ? {} : { defaultCurrency: region.currency }),
    ...(existing?.timezone ? {} : { timezone: region.timezone }),
  };
}
