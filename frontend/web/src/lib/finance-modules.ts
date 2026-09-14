import type { CreditFacility, CreditSpendImpact, Currency, IpoStatus, LendRecord } from "@hisaab/types";
import { money } from "./format";

export type { CreditFacility, IpoStatus, LendKind, LendStatus } from "@hisaab/types";
export type { Investment, IpoApplication, LendRecord, Loan } from "@hisaab/types";

export function returnPct(investedMinor: number, currentMinor: number) {
  if (!investedMinor) return 0;
  return Math.round(((currentMinor - investedMinor) / investedMinor) * 1000) / 10;
}

export function sumMinor<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((sum, item) => sum + pick(item), 0);
}

export function openLends(lends: LendRecord[]) {
  return lends.filter((item) => item.status !== "settled");
}

export function ipoStatusClass(status: IpoStatus) {
  if (status === "Allotted") return "allotted";
  if (status === "Not Allotted") return "notallotted";
  if (status === "In progress") return "pending";
  return "listed";
}

export function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isoPlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

export function displayDateLong(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function displayCreditCards(
  liveCards: Array<{ id: string; name: string; currentBalanceMinor: number; currency?: Currency }>,
  facilities: CreditFacility[],
): CreditFacility[] {
  const cards = facilities.filter((item) => item.kind === "CARD");
  if (cards.length) return cards;
  if (!liveCards.length) return [];
  return liveCards.map((account) => ({
    id: account.id,
    kind: "CARD" as const,
    name: account.name,
    provider: null,
    mask: null,
    accountId: account.id,
    limitMinor: 0,
    usedMinor: Math.abs(account.currentBalanceMinor),
    todaySpendMinor: 0,
    overdueMinor: 0,
    holdMinor: 0,
    minDueMinor: 0,
    dueOn: null,
    cycleStartOn: null,
    lastPaidOn: null,
    currency: account.currency ?? ("INR" satisfies Currency),
    createdAt: "",
    updatedAt: "",
  }));
}

export function cardLast4(mask: string | null | undefined) {
  const digits = (mask ?? "").replace(/\D/g, "");
  return digits.slice(-4);
}

export function creditFacilityLabel(
  card: { name: string; mask?: string | null; limitMinor?: number; usedMinor?: number; holdMinor?: number },
  currency = "INR",
) {
  const last4 = cardLast4(card.mask);
  const digits = last4 ? ` · •••• ${last4}` : "";
  if (card.limitMinor == null) return `${card.name}${digits}`;
  const available = Math.max(0, card.limitMinor - (card.usedMinor ?? 0) - (card.holdMinor ?? 0));
  return `${card.name}${digits} · ${money(available, currency)} available`;
}

export function creditSpendCopy(credit: CreditSpendImpact, currency = "INR") {
  const due = credit.dueOn ? ` · due ${displayDateLong(credit.dueOn)}` : "";
  const pending = `Pending ${money(credit.pendingMinor, currency)}${due}`;
  if (credit.spentMinor > 0) {
    return `${money(credit.spentMinor, currency)} spent on ${credit.name}. Available ${money(credit.availableMinor, currency)}. ${pending}.`;
  }
  return `${credit.name} updated. Available ${money(credit.availableMinor, currency)}. ${pending}.`;
}
