import type { CreditLedgerEntry, CreditRecentTransaction } from "@hisaab/types";
import { localDateKey } from "./format";

export type CardTrendPoint = {
  label: string;
  spendMinor: number;
  outstandingMinor: number;
  limitMinor: number;
  daySpendMinor: number;
};

function ledgerDateKey(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return localDateKey(value);
}

export function cardOutstandingDelta(type: string, amountMinor: number) {
  const amount = Math.max(0, Math.trunc(amountMinor) || 0);
  if (type === "EXPENSE") return amount;
  if (type === "INCOME") return -amount;
  return 0;
}

function asLedger(items: Array<CreditLedgerEntry | CreditRecentTransaction>): CreditLedgerEntry[] {
  return items.map((item) => ({
    id: item.id,
    type: "type" in item && item.type ? item.type : "EXPENSE",
    amountMinor: item.amountMinor,
    transactionAt: item.transactionAt,
  }));
}

/**
 * Reconstructs end-of-day outstanding from the current balance and dated
 * card expenses/payments in the window. Interest/fees appear only if recorded.
 */
export function buildSpendingTrend(
  ledger: Array<CreditLedgerEntry | CreditRecentTransaction>,
  cycleSpendMinor: number,
  outstandingMinor: number,
  limitMinor: number,
  now = new Date(),
) {
  const days = 30;
  const entries = asLedger(ledger);
  const byDay = new Map<string, { spend: number; delta: number }>();
  for (const item of entries) {
    const key = ledgerDateKey(item.transactionAt);
    const current = byDay.get(key) ?? { spend: 0, delta: 0 };
    const delta = cardOutstandingDelta(item.type, item.amountMinor);
    current.delta += delta;
    if (item.type === "EXPENSE") current.spend += Math.max(0, item.amountMinor);
    byDay.set(key, current);
  }
  const windowKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    windowKeys.push(ledgerDateKey(date));
  }
  const windowDelta = windowKeys.reduce((sum, key) => sum + (byDay.get(key)?.delta ?? 0), 0);
  let outstanding = Math.max(0, outstandingMinor - windowDelta);
  let cumulative = 0;
  let peakDay = 0;
  const points: CardTrendPoint[] = [];
  for (const key of windowKeys) {
    const day = byDay.get(key) ?? { spend: 0, delta: 0 };
    outstanding = Math.max(0, outstanding + day.delta);
    cumulative += day.spend;
    peakDay = Math.max(peakDay, day.spend);
    const date = new Date(`${key}T12:00:00`);
    points.push({
      label: new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(date),
      spendMinor: cumulative,
      outstandingMinor: outstanding,
      limitMinor,
      daySpendMinor: day.spend,
    });
  }
  const activeDays = [...byDay.values()].filter((value) => value.spend > 0).length || 1;
  return {
    points,
    peakDayMinor: peakDay,
    avgDailyMinor: Math.round(cycleSpendMinor / activeDays),
    totalSpendMinor: cycleSpendMinor,
    totalOutstandingMinor: outstandingMinor,
  };
}
