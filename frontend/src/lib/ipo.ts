import type { IpoApplication, IpoMarketCategory, IpoStatus } from "@hisaab/types";
import { money } from "./format";
import { displayDate, displayDateLong } from "./finance-modules";

export const IPO_BROKERS = [
  "Zerodha",
  "Groww",
  "HDFC Securities",
  "ICICI Direct",
  "Paytm Money",
  "Angel One",
  "Kotak Securities",
  "Upstox",
] as const;

export const IPO_STATUSES: IpoStatus[] = [
  "Applied",
  "In progress",
  "Allotted",
  "Not Allotted",
  "Listed",
];

export const IPO_MARKET_CATEGORIES: IpoMarketCategory[] = ["Mainboard", "SME"];

export type IpoPeriod = "today" | "week" | "month" | "quarter" | "year" | "all";

export const UPCOMING_IPO_FEED = [
  {
    id: "up-tata",
    name: "Tata Electronics IPO",
    priceBand: "₹480 - ₹520",
    openOn: "2026-09-08",
    closeOn: "2026-09-10",
    tone: "tata",
  },
  {
    id: "up-lg",
    name: "LG Electronics IPO",
    priceBand: "₹1,080 - ₹1,140",
    openOn: "2026-09-12",
    closeOn: "2026-09-14",
    tone: "lg",
  },
  {
    id: "up-ola",
    name: "Ola Electric IPO",
    priceBand: "₹72 - ₹76",
    openOn: "2026-09-18",
    closeOn: "2026-09-20",
    tone: "ola",
  },
] as const;

export function activeIpoCount(list: IpoApplication[]) {
  return list.filter((item) => item.status === "Applied" || item.status === "In progress").length;
}

export function ipoCalendarEvents(list: IpoApplication[]) {
  const today = new Date().toISOString().slice(0, 10);
  const events: Array<{ id: string; name: string; date: string; kind: "allotment" | "applied" }> = [];
  for (const item of list) {
    if (item.allotmentOn && item.allotmentOn >= today) {
      events.push({ id: `${item.id}-allot`, name: item.name, date: item.allotmentOn, kind: "allotment" });
    } else if (item.appliedOn >= today.slice(0, 7)) {
      events.push({ id: `${item.id}-apply`, name: item.name, date: item.appliedOn, kind: "applied" });
    }
  }
  return events.sort((left, right) => left.date.localeCompare(right.date)).slice(0, 8);
}

export function ipoStatusTone(status: IpoStatus) {
  if (status === "Allotted") return "allotted";
  if (status === "Listed") return "listed";
  if (status === "Not Allotted") return "rejected";
  if (status === "In progress") return "progress";
  return "applied";
}

export function paymentSourceLabel(
  source: string | null | undefined,
  lookup: Array<{ id: string; label: string }>,
) {
  if (!source?.trim()) return "—";
  const match = lookup.find((item) => item.id === source);
  return match?.label ?? source;
}

export function formatLastUpdated(value: string) {
  return displayDateLong(value.slice(0, 10));
}

export function ipoRowDate(item: IpoApplication) {
  return displayDate(item.allotmentOn ?? item.appliedOn);
}

export function ipoAbbrev(name: string) {
  const words = name.replace(/\bIPO\b/gi, "").trim().split(/\s+/);
  if (!words.length) return "IP";
  if (words.length === 1) return words[0]?.slice(0, 2).toUpperCase() ?? "IP";
  return words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export function periodBounds(period: IpoPeriod) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (period === "today") return { start, end };
  if (period === "week") {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  if (period === "month") {
    start.setDate(1);
    return { start, end };
  }
  if (period === "quarter") {
    const quarter = Math.floor(now.getMonth() / 3);
    start.setMonth(quarter * 3, 1);
    return { start, end };
  }
  if (period === "year") {
    start.setMonth(0, 1);
    return { start, end };
  }
  return { start: null, end: null };
}

export function filterIposByPeriod(list: IpoApplication[], period: IpoPeriod) {
  if (period === "all") return list;
  const { start, end } = periodBounds(period);
  if (!start || !end) return list;
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  return list.filter((item) => item.appliedOn >= from && item.appliedOn <= to);
}

export function periodRangeLabel(period: IpoPeriod) {
  const { start, end } = periodBounds(period);
  if (!start || !end || period === "all") return "All time";
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

export function ipoAllottedMinor(item: IpoApplication) {
  if (item.status === "Not Allotted") return 0;
  if (item.allottedAmountMinor != null) return item.allottedAmountMinor;
  if (item.status === "Allotted" || item.status === "Listed") return item.amountMinor;
  return 0;
}

export function ipoStats(item: IpoApplication) {
  const investedMinor = item.amountMinor;
  const allottedMinor = ipoAllottedMinor(item);
  const basisMinor = allottedMinor > 0 ? allottedMinor : investedMinor;
  let currentValueMinor = basisMinor;
  if (
    item.listingPriceMinor &&
    item.currentPriceMinor &&
    item.listingPriceMinor > 0 &&
    basisMinor > 0
  ) {
    currentValueMinor = Math.round((basisMinor * item.currentPriceMinor) / item.listingPriceMinor);
  }
  const plMinor =
    item.status === "Not Allotted" || item.status === "Applied" || item.status === "In progress"
      ? 0
      : currentValueMinor - basisMinor;
  const plPct = basisMinor > 0 ? Math.round((plMinor / basisMinor) * 1000) / 10 : 0;
  return {
    investedMinor,
    allottedMinor,
    currentValueMinor,
    plMinor,
    plPct,
    listingPriceMinor: item.listingPriceMinor,
    currentPriceMinor: item.currentPriceMinor,
  };
}

export function ipoDashboardMetrics(list: IpoApplication[]) {
  const stats = list.map((item) => ({ item, stats: ipoStats(item) }));
  const totalInvestedMinor = stats.reduce((sum, row) => sum + row.stats.investedMinor, 0);
  const currentValueMinor = stats.reduce((sum, row) => sum + row.stats.currentValueMinor, 0);
  const totalPlMinor = stats.reduce((sum, row) => sum + row.stats.plMinor, 0);
  const allottedMinor = stats.reduce((sum, row) => sum + row.stats.allottedMinor, 0);
  const allottedCount = list.filter(
    (item) => item.status === "Allotted" || item.status === "Listed",
  ).length;
  const returnPct =
    totalInvestedMinor > 0 ? Math.round((totalPlMinor / totalInvestedMinor) * 1000) / 10 : 0;
  return {
    totalInvestedMinor,
    currentValueMinor,
    totalPlMinor,
    allottedMinor,
    allottedCount,
    returnPct,
    count: list.length,
  };
}

export function ipoStatusBreakdown(list: IpoApplication[]) {
  const allotted = list.filter((item) => item.status === "Allotted").length;
  const notAllotted = list.filter((item) => item.status === "Not Allotted").length;
  const inProgress = list.filter(
    (item) => item.status === "In progress" || item.status === "Applied",
  ).length;
  const listed = list.filter((item) => item.status === "Listed").length;
  return [
    { name: "Allotted", value: allotted, colour: "var(--primary)" },
    { name: "Listed", value: listed, colour: "#8b7cc9" },
    { name: "Not Allotted", value: notAllotted, colour: "var(--danger)" },
    { name: "In Progress", value: inProgress, colour: "#4d8ec8" },
  ].filter((item) => item.value > 0);
}

export function ipoPlSummary(list: IpoApplication[]) {
  const rows = list.map((item) => ipoStats(item));
  const positive = rows.filter((item) => item.plMinor > 0);
  const negative = rows.filter((item) => item.plMinor < 0);
  const breakEven = rows.filter((item) => item.plMinor === 0);
  return {
    positive: {
      count: positive.length,
      minor: positive.reduce((sum, item) => sum + item.plMinor, 0),
    },
    negative: {
      count: negative.length,
      minor: negative.reduce((sum, item) => sum + item.plMinor, 0),
    },
    breakEven: {
      count: breakEven.length,
      minor: 0,
    },
  };
}

function ipoValuationDate(item: IpoApplication) {
  return item.allotmentOn ?? item.appliedOn;
}

function valuedIpos(list: IpoApplication[]) {
  return list.filter((item) => item.status === "Allotted" || item.status === "Listed");
}

/** Cumulative current P/L ordered by allotment/application date (not a historical price series). */
export function ipoPerformanceTrend(list: IpoApplication[]) {
  const sorted = [...valuedIpos(list)].sort((left, right) =>
    ipoValuationDate(left).localeCompare(ipoValuationDate(right)),
  );
  let running = 0;
  return sorted.map((item) => {
    running += ipoStats(item).plMinor;
    return { label: displayDate(ipoValuationDate(item)), value: running };
  });
}

/** Cumulative current P/L by valuation date (allotment, else application). */
export function ipoReturnsTrend(list: IpoApplication[]) {
  const byDay = new Map<string, number>();
  for (const item of valuedIpos(list)) {
    const key = ipoValuationDate(item);
    const pl = ipoStats(item).plMinor;
    byDay.set(key, (byDay.get(key) ?? 0) + pl);
  }
  const keys = [...byDay.keys()].sort();
  let running = 0;
  return keys.map((key) => {
    running += byDay.get(key) ?? 0;
    return { label: displayDate(key), value: running };
  });
}

export function downloadIpoCsv(list: IpoApplication[], currency: string) {
  void currency;
  const rows = [
    [
      "IPO",
      "Category",
      "Applied On",
      "Applied Amount",
      "Allotted",
      "Listing Price",
      "Current Price",
      "P/L",
      "P/L %",
      "Status",
    ],
    ...list.map((item) => {
      const stats = ipoStats(item);
      return [
        item.name,
        item.marketCategory ?? "Mainboard",
        item.appliedOn,
        String(stats.investedMinor / 100),
        String(stats.allottedMinor / 100),
        stats.listingPriceMinor ? String(stats.listingPriceMinor / 100) : "",
        stats.currentPriceMinor ? String(stats.currentPriceMinor / 100) : "",
        String(stats.plMinor / 100),
        String(stats.plPct),
        item.status,
      ];
    }),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "hisaab-ipo-applications.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatPlCopy(plMinor: number, plPct: number, currency = "INR") {
  const sign = plMinor > 0 ? "+" : plMinor < 0 ? "−" : "";
  return `${sign}${money(Math.abs(plMinor), currency)} (${plPct > 0 ? "+" : ""}${plPct}%)`;
}
