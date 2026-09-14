import type { IpoMarketCategory, UpcomingIpo, UpcomingIpoFeed, UpcomingIpoStatus } from "@hisaab/types";

const NSE_UPCOMING_URL = "https://www.nseindia.com/api/all-upcoming-issues?category=ipo";
const NSE_CURRENT_URL = "https://www.nseindia.com/api/ipo-current-issue";
const NSE_REFERER = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
const CACHE_KEY = "https://hisaab.internal/cache/nse-ipo-feed";
const CACHE_TTL_SECONDS = 30 * 60;

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const NSE_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  Referer: NSE_REFERER,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

export type NseIpoRow = {
  companyName?: string;
  symbol?: string;
  series?: string;
  status?: string;
  issueStartDate?: string;
  issueEndDate?: string;
  issuePrice?: string;
};

export function parseNseDate(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2] ?? ""];
  if (!month) return null;
  return `${match[3]}-${month}-${String(match[1]).padStart(2, "0")}`;
}

export function formatNsePriceBand(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "Price TBA";
  return raw.replace(/Rs\.?\s*/gi, "₹").replace(/\s+to\s+/i, " - ");
}

export function nseMarketCategory(series: string | null | undefined): IpoMarketCategory {
  return series?.toUpperCase() === "SME" ? "SME" : "Mainboard";
}

export function nseIssueStatus(status: string | null | undefined): UpcomingIpoStatus {
  return status?.toLowerCase() === "active" ? "Open" : "Upcoming";
}

export function mapNseIpo(row: NseIpoRow): UpcomingIpo | null {
  const name = row.companyName?.trim();
  const symbol = row.symbol?.trim();
  if (!name || !symbol) return null;
  return {
    id: `${symbol}-${row.series ?? "EQ"}`.toUpperCase(),
    symbol,
    name,
    priceBand: formatNsePriceBand(row.issuePrice),
    openOn: parseNseDate(row.issueStartDate),
    closeOn: parseNseDate(row.issueEndDate),
    status: nseIssueStatus(row.status),
    marketCategory: nseMarketCategory(row.series),
  };
}

export function normalizeNseIpos(rows: NseIpoRow[]) {
  const seen = new Set<string>();
  const items: UpcomingIpo[] = [];
  for (const row of rows) {
    const item = mapNseIpo(row);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items.sort((left, right) => {
    if (left.status !== right.status) return left.status === "Open" ? -1 : 1;
    return (left.openOn ?? "9999").localeCompare(right.openOn ?? "9999");
  });
}

async function fetchNseJson(url: string) {
  const response = await fetch(url, {
    headers: NSE_HEADERS,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`NSE request failed (${response.status})`);
  return response.json();
}

function asRows(payload: unknown): NseIpoRow[] {
  return Array.isArray(payload) ? (payload as NseIpoRow[]) : [];
}

async function readCache(): Promise<UpcomingIpoFeed | null> {
  try {
    const cached = await caches.default.match(CACHE_KEY);
    if (!cached) return null;
    return (await cached.json()) as UpcomingIpoFeed;
  } catch {
    return null;
  }
}

async function writeCache(feed: UpcomingIpoFeed) {
  try {
    await caches.default.put(
      CACHE_KEY,
      new Response(JSON.stringify(feed), {
        headers: {
          "content-type": "application/json",
          "cache-control": `max-age=${CACHE_TTL_SECONDS}`,
        },
      }),
    );
  } catch {
    /* Cache is optional in tests and local runtimes. */
  }
}

export async function getUpcomingIpoFeed(): Promise<UpcomingIpoFeed> {
  const cached = await readCache();
  if (cached?.items.length) return cached;
  try {
    let rows = asRows(await fetchNseJson(NSE_UPCOMING_URL));
    if (!rows.length) rows = asRows(await fetchNseJson(NSE_CURRENT_URL));
    const feed: UpcomingIpoFeed = {
      source: "NSE",
      fetchedAt: new Date().toISOString(),
      items: normalizeNseIpos(rows),
    };
    if (feed.items.length) await writeCache(feed);
    return feed;
  } catch {
    return {
      source: "NSE",
      fetchedAt: new Date().toISOString(),
      unavailable: true,
      items: cached?.items ?? [],
    };
  }
}
