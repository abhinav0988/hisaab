import type { CreditFacilityKind } from "@hisaab/types";

/** Maps account catalog type → credit facility kind (parity with web). */
export function creditKindForAccount(type: string | null | undefined): CreditFacilityKind | null {
  if (type === "CREDIT_CARD") return "CARD";
  if (type === "UPI") return "UPI";
  return null;
}

export function facilityAvailableMinor(item: {
  limitMinor: number;
  usedMinor: number;
  holdMinor?: number | null;
}) {
  return Math.max(0, item.limitMinor - (item.usedMinor ?? 0) - (item.holdMinor ?? 0));
}

export function facilityLabel(
  item: {
    name: string;
    mask?: string | null;
    provider?: string | null;
    limitMinor?: number;
    usedMinor?: number;
    holdMinor?: number | null;
    currency?: string;
  },
  opts?: { withAvailable?: boolean },
) {
  const mask = item.mask?.trim();
  const base = mask
    ? `${item.name} · ${mask}`
    : item.provider
      ? `${item.name} · ${item.provider}`
      : item.name;
  if (
    opts?.withAvailable &&
    item.limitMinor != null &&
    item.usedMinor != null
  ) {
    const available = facilityAvailableMinor({
      limitMinor: item.limitMinor,
      usedMinor: item.usedMinor,
      holdMinor: item.holdMinor,
    });
    const currency = item.currency ?? "INR";
    const symbol = currency === "INR" ? "₹" : `${currency} `;
    const formatted = (available / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${base} · ${symbol}${formatted} available`;
  }
  return base;
}
