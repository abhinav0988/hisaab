"use client";

import type { IpoApplication, IpoMarketCategory, IpoStatus } from "@hisaab/types";
import { Button, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  CalendarDays,
  FileText,
  Filter,
  MoreVertical,
  PieChart,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ImmersedNotifyButton, ImmersedThemeButton } from "@/components/layout/immersed-chrome";
import { Modal } from "@/components/layout/modal";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { bankLabel } from "@/lib/bank";
import { isoToday } from "@/lib/finance-modules";
import { money } from "@/lib/format";
import {
  downloadIpoCsv,
  filterIposByPeriod,
  IPO_MARKET_CATEGORIES,
  IPO_STATUSES,
  ipoAbbrev,
  ipoDashboardMetrics,
  ipoStats,
  periodRangeLabel,
  UPCOMING_IPO_FEED,
  type IpoPeriod,
} from "@/lib/ipo";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";
import "../../app/ipo38.css";

type StatusTab = "all" | "upcoming" | "applied" | "allotted" | "listed" | "cancelled";

const PERIOD_CYCLE: IpoPeriod[] = ["month", "quarter", "year", "all", "today", "week"];

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function isAllottedStatus(status: IpoStatus) {
  return status === "Allotted" || status === "Listed";
}

function shouldBlockBankHold(status: IpoStatus) {
  return status === "Applied" || status === "In progress";
}

function shouldReleaseBankHold(status: IpoStatus) {
  return status === "Not Allotted";
}

function expenseCategoryId(categories: { id: string; name: string; type: string }[]) {
  const match =
    categories.find((item) => item.name === "Other" && item.type === "EXPENSE") ??
    categories.find((item) => item.type === "EXPENSE");
  if (!match) throw new Error("No expense category found. Add a category first.");
  return match.id;
}

function incomeCategoryId(categories: { id: string; name: string; type: string }[]) {
  const match =
    categories.find((item) => item.name === "Salary" && item.type === "INCOME") ??
    categories.find((item) => item.name === "Other" && item.type === "INCOME") ??
    categories.find((item) => item.type === "INCOME");
  if (!match) throw new Error("No income category found. Add a category first.");
  return match.id;
}

async function blockBankForIpo(
  bankAccountId: string,
  categories: { id: string; name: string; type: string }[],
  payload: {
    amountMinor: number;
    name: string;
    appliedOn: string;
    currency: string;
  },
) {
  await transactionService.create({
    type: "EXPENSE",
    accountId: bankAccountId,
    categoryId: expenseCategoryId(categories),
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    merchant: `IPO: ${payload.name}`,
    notes: "IPO application amount blocked in bank",
    transactionAt: new Date(`${payload.appliedOn}T12:00:00`).toISOString(),
  });
}

async function releaseBankForIpo(
  bankAccountId: string,
  categories: { id: string; name: string; type: string }[],
  payload: {
    amountMinor: number;
    name: string;
    currency: string;
  },
) {
  await transactionService.create({
    type: "INCOME",
    accountId: bankAccountId,
    categoryId: incomeCategoryId(categories),
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    merchant: `IPO refund: ${payload.name}`,
    notes: "IPO not allotted — application amount credited back to bank",
    transactionAt: new Date().toISOString(),
  });
}

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function formatShort(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatShortDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

function statusClass(status: IpoStatus) {
  if (status === "Listed") return "listed";
  if (status === "Allotted") return "allotted";
  if (status === "Not Allotted") return "cancelled";
  return "applied";
}

function statusLabel(status: IpoStatus) {
  if (status === "Not Allotted") return "Cancelled";
  if (status === "In progress") return "Applied";
  return status;
}

function iconTone(name: string, index: number) {
  const tones = ["", "purple", "gold", "orange"] as const;
  const hash = name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return tones[(hash + index) % tones.length] ?? "";
}

function matchesStatusTab(item: IpoApplication, tab: StatusTab) {
  if (tab === "all") return true;
  if (tab === "upcoming") return false;
  if (tab === "applied") return item.status === "Applied" || item.status === "In progress";
  if (tab === "allotted") return item.status === "Allotted";
  if (tab === "listed") return item.status === "Listed";
  return item.status === "Not Allotted";
}

function avgListingGainPct(list: IpoApplication[]) {
  const listed = list.filter((item) => item.status === "Listed");
  if (!listed.length) return 0;
  const rows = listed.map((item) => ipoStats(item)).filter((row) => row.investedMinor > 0);
  if (!rows.length) return 0;
  const avg = rows.reduce((sum, row) => sum + row.plPct, 0) / rows.length;
  return Math.round(avg * 10) / 10;
}

function donutGradient(counts: {
  upcoming: number;
  applied: number;
  allotted: number;
  listed: number;
}) {
  const total = counts.upcoming + counts.applied + counts.allotted + counts.listed;
  if (!total) {
    return "conic-gradient(#1b2f27 0 100%)";
  }
  let cursor = 0;
  const stops: string[] = [];
  const parts: Array<[number, string]> = [
    [counts.upcoming, "#4bbdf1"],
    [counts.applied, "#e7bd53"],
    [counts.allotted, "#43df91"],
    [counts.listed, "#7c62e7"],
  ];
  for (const [value, color] of parts) {
    if (!value) continue;
    const start = (cursor / total) * 100;
    cursor += value;
    const end = (cursor / total) * 100;
    stops.push(`${color} ${start}% ${end}%`);
  }
  return `conic-gradient(${stops.join(",")})`;
}

export function IpoView() {
  const client = useQueryClient();
  const [period, setPeriod] = useState<IpoPeriod>("month");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<IpoApplication | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const ipos = useQuery({ queryKey: ["ipos"], queryFn: () => financeService.listIpos(), retry: false });
  const banks = useQuery({ queryKey: ["bank-accounts"], queryFn: () => accountService.listBanks() });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountService.list() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list() });

  const create = useMutation({
    mutationFn: async (payload: { body: unknown; bankAccountId?: string }) => {
      const body = payload.body as {
        amountMinor: number;
        name: string;
        appliedOn: string;
        currency: string;
        status: IpoStatus;
      };
      const needsHold =
        payload.bankAccountId && categories.data && shouldBlockBankHold(body.status);

      const ipo = await financeService.createIpo(payload.body);
      if (needsHold) {
        try {
          await blockBankForIpo(payload.bankAccountId!, categories.data!, body);
        } catch (error) {
          await financeService.deleteIpo(ipo.id);
          throw error;
        }
      }
      return ipo;
    },
    onSuccess: async () => {
      await refresh();
      setAddOpen(false);
      toast.success("IPO application saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      body,
      previous,
    }: {
      id: string;
      body: unknown;
      previous: IpoApplication;
    }) => {
      const patch = body as { status?: IpoStatus; amountMinor?: number };
      const nextStatus = patch.status ?? previous.status;
      const nextAmount = patch.amountMinor ?? previous.amountMinor;
      const result = await financeService.updateIpo(id, body);

      const bankId = previous.paymentSource;
      const bankList = banks.data ?? [];
      const isValidBank = bankId && bankList.some((item) => item.id === bankId);
      if (!isValidBank || !categories.data) return result;

      const wasBlocking = shouldBlockBankHold(previous.status);
      const nowBlocking = shouldBlockBankHold(nextStatus);
      const holdActive = wasBlocking && !Boolean(previous.holdReleased);

      if (holdActive && shouldReleaseBankHold(nextStatus)) {
        await releaseBankForIpo(bankId, categories.data, {
          amountMinor: previous.amountMinor,
          name: previous.name,
          currency: previous.currency,
        });
        await financeService.updateIpo(id, { holdReleased: true });
      } else if (previous.holdReleased && nowBlocking) {
        await blockBankForIpo(bankId, categories.data, {
          amountMinor: nextAmount,
          name: previous.name,
          appliedOn: previous.appliedOn,
          currency: previous.currency,
        });
        await financeService.updateIpo(id, { holdReleased: false });
      } else if (!previous.holdReleased && !wasBlocking && nowBlocking) {
        await blockBankForIpo(bankId, categories.data, {
          amountMinor: nextAmount,
          name: previous.name,
          appliedOn: previous.appliedOn,
          currency: previous.currency,
        });
      }
      return result;
    },
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      toast.success("IPO updated");
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => financeService.deleteIpo(id),
    onSuccess: async () => {
      await refresh();
      setMenuId(null);
      toast.success("IPO removed");
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  async function refresh() {
    await client.invalidateQueries({ queryKey: ["ipos"] });
    await client.invalidateQueries({ queryKey: ["dashboard"] });
    await client.invalidateQueries({ queryKey: ["accounts"] });
    await client.invalidateQueries({ queryKey: ["bank-accounts"] });
    await client.invalidateQueries({ queryKey: ["transactions"] });
  }

  const bankOptions = useMemo(
    () =>
      (banks.data ?? []).map((item) => ({
        id: item.id,
        label: bankLabel(item),
      })),
    [banks.data],
  );

  if (
    profile.isLoading ||
    ipos.isLoading ||
    banks.isLoading ||
    accounts.isLoading ||
    categories.isLoading
  ) {
    return <PageSkeleton />;
  }
  if (ipos.isError) return <ErrorState retry={() => void ipos.refetch()} />;

  const currency = profile.data?.defaultCurrency ?? "INR";
  const all = ipos.data ?? [];
  const periodFiltered = filterIposByPeriod(all, period);
  const query = (search || tableSearch).trim().toLowerCase();
  const list = periodFiltered.filter((item) => {
    if (!matchesStatusTab(item, statusTab)) return false;
    if (!query) return true;
    return item.name.toLowerCase().includes(query);
  });
  const metrics = ipoDashboardMetrics(periodFiltered);
  const listingGain = avgListingGainPct(periodFiltered);
  const appliedCount = periodFiltered.filter(
    (item) => item.status === "Applied" || item.status === "In progress",
  ).length;
  const allottedOnly = periodFiltered.filter((item) => item.status === "Allotted").length;
  const listedCount = periodFiltered.filter((item) => item.status === "Listed").length;
  const cancelledCount = periodFiltered.filter((item) => item.status === "Not Allotted").length;
  const upcomingCount = UPCOMING_IPO_FEED.length as number;
  const successRate =
    metrics.count > 0 ? Math.round((metrics.allottedCount / metrics.count) * 100) : 0;
  const statusCounts = {
    upcoming: upcomingCount,
    applied: appliedCount,
    allotted: allottedOnly,
    listed: listedCount,
  };

  const cyclePeriod = () => {
    const index = PERIOD_CYCLE.indexOf(period);
    setPeriod(PERIOD_CYCLE[(index + 1) % PERIOD_CYCLE.length] ?? "month");
  };

  return (
    <div className="ip36">
      <section className="ip36-head">
        <div className="ip36-head-left">
          <div className="ip36-page-icon">
            <Briefcase />
          </div>
          <div>
            <h1>IPO Tracker</h1>
            <p>Track IPO applications, allotment status, listing performance and returns.</p>
          </div>
        </div>
        <div className="ip36-head-actions">
          <label className="ip36-search">
            <Search />
            <input
              aria-label="Search IPOs"
              placeholder="Search IPOs, companies..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="ip36-btn" onClick={cyclePeriod}>
            <CalendarDays /> {monthLabel()}
          </button>
          <ImmersedNotifyButton className="ip36-btn" emptyText="No new IPO alerts." />
          <ImmersedThemeButton className="ip36-btn" />
          <button type="button" className="ip36-btn primary" onClick={() => setAddOpen(true)}>
            <Plus /> Add IPO
          </button>
        </div>
      </section>

      <section className="ip36-kpis">
        <article className="ip36-kpi green">
          <div>
            <span className="label">Total Invested</span>
            <strong>{money(metrics.totalInvestedMinor, currency)}</strong>
            <small>
              Across {metrics.count} IPO application{metrics.count === 1 ? "" : "s"}
            </small>
          </div>
          <div className="ip36-kpi-icon">
            <PieChart />
          </div>
        </article>
        <article className="ip36-kpi blue">
          <div>
            <span className="label">Current Value</span>
            <strong>{money(metrics.currentValueMinor, currency)}</strong>
            <small>
              Live market value{" "}
              <em>
                {metrics.returnPct >= 0 ? "↑" : "↓"} {Math.abs(metrics.returnPct)}%
              </em>
            </small>
          </div>
          <div className="ip36-kpi-icon">
            <Wallet />
          </div>
        </article>
        <article className="ip36-kpi gold">
          <div>
            <span className="label">Total Profit / Loss</span>
            <strong>{money(metrics.totalPlMinor, currency)}</strong>
            <small>
              Overall returns{" "}
              <em>
                {metrics.returnPct >= 0 ? "↑" : "↓"} {Math.abs(metrics.returnPct)}%
              </em>
            </small>
          </div>
          <div className="ip36-kpi-icon">
            <TrendingUp />
          </div>
        </article>
        <article className="ip36-kpi purple">
          <div>
            <span className="label">Allotted Shares</span>
            <strong>
              {metrics.allottedCount} of {metrics.count || 0}
            </strong>
            <small>{successRate}% success rate</small>
          </div>
          <div className="ip36-kpi-icon">
            <Briefcase />
          </div>
        </article>
      </section>

      <section className="ip36-top">
        <article className="ip36-panel ip36-hero">
          <div className="ip36-hero-copy">
            <div className="ip36-overline">IPO opportunities in one place</div>
            <h2>
              Stay ahead with <span>upcoming opportunities</span>
            </h2>
            <p>
              Track IPOs, apply with confidence and monitor your allotments and listing performance —
              all in one place.
            </p>
            <div className="ip36-hero-actions">
              <button type="button" className="ip36-btn primary" onClick={() => setAddOpen(true)}>
                <Plus /> Add IPO Application
              </button>
              <button
                type="button"
                className="ip36-btn"
                onClick={() => {
                  setStatusTab("upcoming");
                  document.getElementById("ipo-upcoming")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <CalendarDays /> View Upcoming IPOs
              </button>
            </div>
          </div>
          <div className="ip36-hero-art" aria-hidden>
            <div className="ip36-artbar b1" />
            <div className="ip36-artbar b2" />
            <div className="ip36-artbar b3" />
            <div className="ip36-artbar b4" />
            <div className="ip36-art-arrow" />
            <div className="ip36-bell">
              <Bell />
            </div>
            <div className="ip36-alertbubble">
              New opportunities
              <br />
              New beginnings
            </div>
            <div className="ip36-ipo-text">IPO</div>
          </div>
        </article>

        <aside className="ip36-panel" id="ipo-upcoming">
          <div className="ip36-panel-head">
            <div>
              <h3>Upcoming IPOs</h3>
            </div>
            <button type="button" className="ip36-btn" style={{ height: 30, fontSize: 8 }}>
              View all
            </button>
          </div>
          <div className="ip36-upcoming">
            {UPCOMING_IPO_FEED.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="ip36-upitem"
                style={{ width: "100%", textAlign: "left", color: "inherit", cursor: "pointer" }}
                onClick={() => {
                  setAddOpen(true);
                  toast.message(`Prefill from ${item.name}`, {
                    description: "Add your application details to start tracking.",
                  });
                }}
              >
                <div className={`ip36-upicon ${iconTone(item.name, index)}`.trim()}>
                  {ipoAbbrev(item.name)}
                </div>
                <div>
                  <b>{item.name}</b>
                  <small>
                    {item.priceBand}
                    <br />
                    Open {formatShortDay(item.openOn)} · Close {formatShortDay(item.closeOn)}
                  </small>
                </div>
                <span className="ip36-badge">UPCOMING</span>
                <ArrowRight />
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="ip36-tabsbar">
        <div className="ip36-tabs">
          {(
            [
              { id: "all", label: "All IPOs" },
              { id: "upcoming", label: `Upcoming (${upcomingCount})` },
              { id: "applied", label: `Applied (${appliedCount})` },
              { id: "allotted", label: `Allotted (${allottedOnly})` },
              { id: "listed", label: `Listed (${listedCount})` },
              { id: "cancelled", label: `Cancelled (${cancelledCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`ip36-tab${statusTab === tab.id ? " active" : ""}`}
              onClick={() => setStatusTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" className="ip36-btn" onClick={cyclePeriod}>
          <CalendarDays /> {periodRangeLabel(period)}
        </button>
      </section>

      <section className="ip36-summary">
        <article className="ip36-scard">
          <h4>Current P/L by IPO</h4>
          <strong>
            {money(metrics.totalPlMinor, currency)}{" "}
            <span style={{ fontSize: 11, color: metrics.returnPct >= 0 ? "#44df94" : "#ff6570" }}>
              {metrics.returnPct >= 0 ? "+" : ""}
              {metrics.returnPct}%
            </span>
          </strong>
          <small>Today&apos;s P/L for allotted and listed applications</small>
        </article>
        <article className="ip36-scard">
          <h4>IPO Status Overview</h4>
          <div className="ip36-statusrow">
            <div className="ip36-mini-donut" style={{ background: donutGradient(statusCounts) }} />
            <div className="ip36-statuslist">
              <span>
                <i style={{ background: "#4bbdf1" }} />
                Upcoming
              </span>
              <span>
                <i style={{ background: "#e7bd53" }} />
                Applied
              </span>
              <span>
                <i style={{ background: "#43df91" }} />
                Allotted
              </span>
              <span>
                <i style={{ background: "#7c62e7" }} />
                Listed
              </span>
            </div>
            <b style={{ fontSize: 10, lineHeight: 1.35 }}>
              {upcomingCount}
              <br />
              {appliedCount}
              <br />
              {allottedOnly}
              <br />
              {listedCount}
            </b>
          </div>
        </article>
        <article className="ip36-scard">
          <h4>Listing Performance</h4>
          <strong style={{ color: listingGain >= 0 ? "#44df94" : "#ff6570" }}>
            {listingGain >= 0 ? "+" : ""}
            {listingGain}%
          </strong>
          <small>Avg. listing gain (listed IPOs)</small>
        </article>
      </section>

      <section className="ip36-body">
        <article className="ip36-panel">
          <div className="ip36-panel-head">
            <div>
              <h3>Your IPO Applications</h3>
              <p>Track your applications, allotment status, listing price and live P/L.</p>
            </div>
            <div className="ip36-table-tools">
              <label className="ip36-tsearch">
                <Search />
                <input
                  aria-label="Search table"
                  placeholder="Search IPOs..."
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                />
              </label>
              <button type="button" className="ip36-iconbtn" aria-label="Filter" onClick={cyclePeriod}>
                <Filter />
              </button>
              <button
                type="button"
                className="ip36-iconbtn"
                aria-label="Download report"
                onClick={() => {
                  downloadIpoCsv(list, currency);
                  toast.success("IPO report downloaded");
                }}
              >
                <MoreVertical />
              </button>
            </div>
          </div>
          <div className="ip36-tablewrap">
            {list.length ? (
              <div className="ip36-table">
                <div className="ip36-row head">
                  <span>Company</span>
                  <span>Issue Price</span>
                  <span>Lot Size</span>
                  <span>Applied Amount</span>
                  <span>Status</span>
                  <span>Listing Price</span>
                  <span>Current P/L</span>
                  <span>Action</span>
                </div>
                {list.map((item, index) => {
                  const stats = ipoStats(item);
                  const tone = iconTone(item.name, index);
                  return (
                    <div key={item.id} className="ip36-row">
                      <div className="ip36-co">
                        <div className={`ip36-coicon ${tone}`.trim()}>{ipoAbbrev(item.name)}</div>
                        <div>
                          <b>{item.name}</b>
                          <small>
                            {item.status === "Listed" && item.allotmentOn
                              ? `Listed: ${formatShort(item.allotmentOn)}`
                              : `Open: ${formatShort(item.appliedOn)}`}
                          </small>
                        </div>
                      </div>
                      <div className="ip36-cell">
                        {item.lots
                          ? money(Math.round(item.amountMinor / item.lots), currency)
                          : "-"}
                      </div>
                      <div className="ip36-cell">{item.lots}</div>
                      <div className="ip36-cell">{money(stats.investedMinor, currency)}</div>
                      <div>
                        <span className={`ip36-status ${statusClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <div className="ip36-cell">
                        {stats.listingPriceMinor ? money(stats.listingPriceMinor, currency) : "-"}
                      </div>
                      <div
                        className={
                          stats.plMinor === 0 && !isAllottedStatus(item.status)
                            ? "ip36-cell"
                            : `ip36-pl${stats.plMinor < 0 ? " neg" : ""}`
                        }
                      >
                        {isAllottedStatus(item.status) ? (
                          <>
                            {stats.plMinor >= 0 ? "+" : "−"}
                            {money(Math.abs(stats.plMinor), currency)}
                            <br />
                            <span style={{ fontSize: 7.5 }}>
                              {stats.plPct > 0 ? "+" : ""}
                              {stats.plPct}%
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </div>
                      <div className="ip36-action-cell">
                        <button type="button" className="ip36-view" onClick={() => setEditing(item)}>
                          View
                        </button>
                        <button
                          type="button"
                          className="ip36-iconbtn"
                          style={{ width: 24, height: 24 }}
                          aria-label={`Options for ${item.name}`}
                          onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                        >
                          <MoreVertical />
                        </button>
                        {menuId === item.id ? (
                          <div className="ip36-menu-pop">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(item);
                                setMenuId(null);
                              }}
                            >
                              Edit
                            </button>
                            <button type="button" onClick={() => remove.mutate(item.id)}>
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ip36-empty">
                <h4>
                  {statusTab === "upcoming"
                    ? "Upcoming IPOs are listed above"
                    : "No IPO applications in this view"}
                </h4>
                <p>
                  {statusTab === "upcoming"
                    ? "Use Add IPO to track an application when you apply."
                    : "Add an IPO or widen the filters to see applications here."}
                </p>
                <button
                  type="button"
                  className="ip36-btn primary"
                  style={{ marginTop: 12 }}
                  onClick={() => setAddOpen(true)}
                >
                  <Plus /> Add IPO
                </button>
              </div>
            )}
            <div style={{ marginTop: 7, color: "#7f9589", fontSize: 8 }}>
              Showing {list.length} of {periodFiltered.length} application
              {periodFiltered.length === 1 ? "" : "s"}
            </div>
          </div>
        </article>

        <aside className="ip36-side">
          <article className="ip36-panel">
            <div className="ip36-panel-head">
              <div>
                <h3>IPO Insights</h3>
              </div>
            </div>
            <div className="ip36-insights">
              <div className="ip36-insight">
                <div className="ip36-insight-icon">
                  <Briefcase />
                </div>
                <div>
                  <b>
                    {upcomingCount} upcoming IPO{upcomingCount === 1 ? "" : "s"} this month
                  </b>
                  <small>More opportunities to invest.</small>
                </div>
                <ArrowRight />
              </div>
              <div className="ip36-insight">
                <div className="ip36-insight-icon">
                  <PieChart />
                </div>
                <div>
                  <b>{successRate}% allotment rate</b>
                  <small>
                    {metrics.allottedCount} of {metrics.count || 0} applications allotted.
                  </small>
                </div>
                <ArrowRight />
              </div>
              <div className="ip36-insight">
                <div className="ip36-insight-icon">
                  <TrendingUp />
                </div>
                <div>
                  <b>
                    {listingGain >= 0 ? "+" : ""}
                    {listingGain}% average listing gain
                  </b>
                  <small>
                    Based on {listedCount} listed IPO{listedCount === 1 ? "" : "s"}.
                  </small>
                </div>
                <ArrowRight />
              </div>
              <div className="ip36-insight gold">
                <div className="ip36-insight-icon">
                  <Wallet />
                </div>
                <div>
                  <b>{money(metrics.totalPlMinor, currency)} total profit</b>
                  <small>Across allotted and listed IPOs.</small>
                </div>
                <ArrowRight />
              </div>
            </div>
          </article>

          <article className="ip36-panel">
            <div className="ip36-panel-head">
              <div>
                <h3>Quick Actions</h3>
              </div>
            </div>
            <div className="ip36-actions">
              <button type="button" className="ip36-action" onClick={() => setAddOpen(true)}>
                <div className="ip36-action-icon">
                  <Plus />
                </div>
                <b>Add IPO</b>
                <small>Track a new application</small>
              </button>
              <button
                type="button"
                className="ip36-action"
                onClick={() => {
                  setStatusTab("upcoming");
                  document.getElementById("ipo-upcoming")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <div className="ip36-action-icon">
                  <CalendarDays />
                </div>
                <b>IPO Calendar</b>
                <small>View upcoming IPOs</small>
              </button>
              <button
                type="button"
                className="ip36-action"
                onClick={() => {
                  downloadIpoCsv(all, currency);
                  toast.success("IPO report downloaded");
                }}
              >
                <div className="ip36-action-icon">
                  <FileText />
                </div>
                <b>IPO Reports</b>
                <small>Download & analyse</small>
              </button>
              <button
                type="button"
                className="ip36-action"
                onClick={() => toast.success("Allotment alerts enabled for tracked IPOs")}
              >
                <div className="ip36-action-icon">
                  <Bell />
                </div>
                <b>Set Alerts</b>
                <small>Get notified early</small>
              </button>
            </div>
          </article>
        </aside>
      </section>

      <IpoFormModal
        key="add-ipo"
        open={addOpen}
        title="Add IPO application"
        currency={currency}
        bankOptions={bankOptions}
        pending={create.isPending}
        onClose={() => setAddOpen(false)}
        onSave={(body, bankAccountId) => create.mutate({ body, bankAccountId })}
      />
      <IpoFormModal
        key={editing ? editing.id : "edit-closed"}
        open={Boolean(editing)}
        title="Edit IPO application"
        currency={currency}
        bankOptions={bankOptions}
        initial={editing ?? undefined}
        pending={update.isPending}
        onClose={() => setEditing(null)}
        onSave={(body) => {
          if (editing) update.mutate({ id: editing.id, body, previous: editing });
        }}
      />
    </div>
  );
}

function IpoFormModal({
  open,
  title,
  currency,
  bankOptions,
  initial,
  pending,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  currency: string;
  bankOptions: Array<{ id: string; label: string }>;
  initial?: IpoApplication;
  pending: boolean;
  onClose: () => void;
  onSave: (body: unknown, bankAccountId?: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [lots, setLots] = useState(String(initial?.lots ?? 1));
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : "");
  const [allotted, setAllotted] = useState(
    initial?.allottedAmountMinor != null ? String(initial.allottedAmountMinor / 100) : "",
  );
  const [listing, setListing] = useState(
    initial?.listingPriceMinor != null ? String(initial.listingPriceMinor / 100) : "",
  );
  const [current, setCurrent] = useState(
    initial?.currentPriceMinor != null ? String(initial.currentPriceMinor / 100) : "",
  );
  const [marketCategory, setMarketCategory] = useState<IpoMarketCategory>(
    initial?.marketCategory ?? "Mainboard",
  );
  const [status, setStatus] = useState<IpoStatus>(initial?.status ?? "Applied");
  const [appliedOn, setAppliedOn] = useState(initial?.appliedOn ?? isoToday());
  const [bankAccountId, setBankAccountId] = useState(
    initial?.paymentSource && bankOptions.some((item) => item.id === initial.paymentSource)
      ? initial.paymentSource
      : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allottedView = isAllottedStatus(status);
  const selectedBankLabel = bankOptions.find((item) => item.id === bankAccountId)?.label;

  function parseOptionalMinor(raw: string) {
    const cleaned = raw.replace(/,/g, "").trim();
    if (!cleaned) return null;
    return majorToMinor(cleaned);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter IPO name.";
    if (!amount.trim()) next.amount = "Enter applied amount.";
    if (!initial && shouldBlockBankHold(status) && !bankAccountId) {
      next.bank = "Select a bank account to block the applied amount.";
    }
    if (allottedView && allotted.trim() && Number.isNaN(parseOptionalMinor(allotted))) {
      next.allotted = "Enter a valid allotted amount.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = {
      name: name.trim(),
      appliedOn,
      allotmentOn: initial?.allotmentOn ?? null,
      amountMinor: majorToMinor(amount.replace(/,/g, "")),
      lots: Number(lots) || 1,
      status,
      marketCategory,
      allottedAmountMinor: allottedView ? parseOptionalMinor(allotted) : null,
      listingPriceMinor: allottedView ? parseOptionalMinor(listing) : null,
      currentPriceMinor: allottedView ? parseOptionalMinor(current) : null,
      paymentSource: bankAccountId || initial?.paymentSource || null,
      currency,
    };
    onSave(
      body,
      !initial && bankAccountId && shouldBlockBankHold(status) ? bankAccountId : undefined,
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className="ipo-form" onSubmit={submit}>
        <div className="ipo-form-grid">
          <Field label="IPO Name" error={errors.name}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter IPO name"
            />
          </Field>
          <Field label="Category">
            <Select
              value={marketCategory}
              onChange={(event) => setMarketCategory(event.target.value as IpoMarketCategory)}
            >
              {IPO_MARKET_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lots">
            <Select value={lots} onChange={(event) => setLots(event.target.value)}>
              {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value as IpoStatus)}>
              {IPO_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          {!allottedView || !amount.trim() ? (
            <Field label={`Applied Amount (${currency})`} error={errors.amount}>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Enter total applied amount"
              />
            </Field>
          ) : null}
          {allottedView ? (
            <>
              <Field label={`Allotted Amount (${currency})`} error={errors.allotted}>
                <Input
                  inputMode="decimal"
                  value={allotted}
                  onChange={(event) => setAllotted(event.target.value)}
                  placeholder="Amount allotted"
                />
              </Field>
              <Field label="Listing Price (₹)">
                <Input
                  inputMode="decimal"
                  value={listing}
                  onChange={(event) => setListing(event.target.value)}
                  placeholder="Per share"
                />
              </Field>
              <Field label="Current Price (₹)">
                <Input
                  inputMode="decimal"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  placeholder="Live price"
                />
              </Field>
            </>
          ) : null}
        </div>
        <p className="ipo-form-section">Additional Details</p>
        <div className="ipo-form-grid">
          <Field label="Application Date">
            <div className="date-shell">
              <span className="calendar-icon" aria-hidden="true">
                <Calendar size={13} />
              </span>
              <Input
                type="date"
                value={appliedOn}
                onChange={(event) => setAppliedOn(event.target.value)}
              />
            </div>
          </Field>
          {initial ? (
            <Field label="Bank account">
              <Input value={selectedBankLabel ?? "—"} disabled />
            </Field>
          ) : (
            <Field
              label="Bank account"
              error={errors.bank}
              hint={
                shouldBlockBankHold(status)
                  ? "Applied amount will be deducted from this bank until allotment."
                  : "Select the savings bank account used for this IPO."
              }
            >
              <Select
                value={bankAccountId}
                onChange={(event) => setBankAccountId(event.target.value)}
              >
                <option value="">Select bank account</option>
                {bankOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {initial?.holdReleased ? (
          <p className="ipo-form-note">Application amount was credited back to your bank.</p>
        ) : null}
        <div className="ipo-security">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            <strong>We keep your data safe and secure.</strong> Your IPO details are encrypted and
            stored securely. If the IPO is not allotted, the blocked amount returns to your bank.
          </p>
        </div>
        <div className="ipo-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save IPO"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
