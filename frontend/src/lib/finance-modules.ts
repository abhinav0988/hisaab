import type { CreditFacility, Currency, IpoStatus, LendRecord } from "@hisaab/types";

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
  const extras = facilities.filter((item) => item.kind === "CARD");
  if (!liveCards.length) return extras;
  const byAccount = new Map(
    extras.filter((item) => item.accountId).map((item) => [item.accountId as string, item]),
  );
  const usedIds = new Set<string>();
  const merged = liveCards.map((account) => {
    const extra = byAccount.get(account.id) ?? extras.find((item) => item.name === account.name);
    if (extra) usedIds.add(extra.id);
    return {
      id: extra?.id ?? account.id,
      kind: "CARD" as const,
      name: account.name,
      provider: extra?.provider ?? null,
      mask: extra?.mask ?? null,
      accountId: extra?.accountId ?? account.id,
      limitMinor: extra?.limitMinor ?? 0,
      usedMinor: Math.abs(account.currentBalanceMinor),
      todaySpendMinor: extra?.todaySpendMinor ?? 0,
      overdueMinor: extra?.overdueMinor ?? 0,
      holdMinor: extra?.holdMinor ?? 0,
      minDueMinor: extra?.minDueMinor ?? 0,
      dueOn: extra?.dueOn ?? null,
      cycleStartOn: extra?.cycleStartOn ?? null,
      lastPaidOn: extra?.lastPaidOn ?? null,
      currency: extra?.currency ?? account.currency ?? ("INR" satisfies Currency),
      createdAt: extra?.createdAt ?? "",
      updatedAt: extra?.updatedAt ?? "",
    };
  });
  return [...merged, ...extras.filter((item) => !usedIds.has(item.id))];
}
