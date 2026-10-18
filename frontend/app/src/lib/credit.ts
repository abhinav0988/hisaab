import type { CreditFacilityKind } from "@hisaab/types";

/** Maps account catalog type → credit facility kind (parity with web). */
export function creditKindForAccount(type: string | null | undefined): CreditFacilityKind | null {
  if (type === "CREDIT_CARD") return "CARD";
  if (type === "UPI") return "UPI";
  return null;
}

export function facilityLabel(item: {
  name: string;
  mask?: string | null;
  provider?: string | null;
}) {
  const mask = item.mask?.trim();
  if (mask) return `${item.name} · ${mask}`;
  if (item.provider) return `${item.name} · ${item.provider}`;
  return item.name;
}
