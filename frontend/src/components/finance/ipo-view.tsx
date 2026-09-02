"use client";

import type { IpoApplication, IpoMarketCategory, IpoStatus } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Calendar,
  CalendarDays,
  Download,
  Filter,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { accountDisplayName, uniqueCatalogAccounts } from "@/lib/accounts";
import { bankLabel } from "@/lib/bank";
import { displayDate, isoToday } from "@/lib/finance-modules";
import { money } from "@/lib/format";
import {
  downloadIpoCsv,
  filterIposByPeriod,
  IPO_BROKERS,
  IPO_MARKET_CATEGORIES,
  IPO_STATUSES,
  ipoAbbrev,
  ipoDashboardMetrics,
  ipoPerformanceTrend,
  ipoPlSummary,
  ipoReturnsTrend,
  ipoStats,
  ipoStatusBreakdown,
  ipoStatusTone,
  periodRangeLabel,
  UPCOMING_IPO_FEED,
  type IpoPeriod,
} from "@/lib/ipo";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";

const PERIOD_TABS: Array<{ id: IpoPeriod; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
  { id: "year", label: "This Year" },
  { id: "all", label: "All Time" },
];

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

export function IpoView() {
  const router = useRouter();
  const client = useQueryClient();
  const [period, setPeriod] = useState<IpoPeriod>("month");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<IpoApplication | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [tableView, setTableView] = useState<"table" | "grid">("table");

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
      };
      const ipo = await financeService.createIpo(payload.body);
      if (payload.bankAccountId && categories.data) {
        const category =
          categories.data.find((item) => item.name === "Other" && item.type === "EXPENSE") ??
          categories.data.find((item) => item.type === "EXPENSE");
        if (category) {
          await transactionService.create({
            type: "EXPENSE",
            accountId: payload.bankAccountId,
            categoryId: category.id,
            amountMinor: body.amountMinor,
            currency: body.currency,
            merchant: `IPO: ${body.name}`,
            notes: "IPO application amount blocked",
            transactionAt: new Date(`${body.appliedOn}T12:00:00`).toISOString(),
          });
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
    mutationFn: ({ id, body }: { id: string; body: unknown }) => financeService.updateIpo(id, body),
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

  const paymentLookup = useMemo(() => {
    const bankList = banks.data ?? [];
    const catalog = uniqueCatalogAccounts(accounts.data ?? []);
    const upi = catalog.find((item) => item.type === "UPI");
    return [
      ...bankList.map((item) => ({
        id: item.id,
        label: bankLabel(item),
        group: "bank" as const,
      })),
      ...(upi ? [{ id: upi.id, label: accountDisplayName(upi), group: "upi" as const }] : []),
      ...IPO_BROKERS.map((broker) => ({
        id: `broker:${broker}`,
        label: broker,
        group: "broker" as const,
      })),
    ];
  }, [banks.data, accounts.data]);

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
  const filtered = filterIposByPeriod(all, period);
  const list = filtered.filter((item) =>
    !search.trim() ? true : item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const metrics = ipoDashboardMetrics(filtered);
  const plSummary = ipoPlSummary(filtered);
  const statusBreakdown = ipoStatusBreakdown(filtered);
  const performanceTrend = ipoPerformanceTrend(filtered);
  const returnsTrend = ipoReturnsTrend(filtered);

  return (
    <div>
      <PageHeader
        title="IPO Tracker"
        description="Track IPO applications, allotment status, listing performance and returns."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus size={14} />
              Add IPO
            </Button>
            <Button onClick={() => router.push("/transactions?action=add")}>
              <Plus size={14} />
              Add transaction
            </Button>
          </>
        }
      />

      <div className="ipo-dash">
        <div className="ipo-dash-main">
          <Card className="ipo-summary-row">
            <div className="ipo-summary-cards">
              {(
                [
                  {
                    label: "Total Invested",
                    value: money(metrics.totalInvestedMinor, currency),
                    note: `Across ${metrics.count} IPO application${metrics.count === 1 ? "" : "s"}`,
                  },
                  {
                    label: "Current Value",
                    value: money(metrics.currentValueMinor, currency),
                    note: (
                      <span className="ipo-gain">
                        <ArrowUpRight size={12} />
                        {metrics.returnPct}% ({money(metrics.totalPlMinor, currency)})
                      </span>
                    ),
                  },
                  {
                    label: "Total Profit / Loss",
                    value: money(metrics.totalPlMinor, currency),
                    note: (
                      <span className={metrics.totalPlMinor >= 0 ? "ipo-gain" : "ipo-loss"}>
                        <ArrowUpRight size={12} />
                        {metrics.returnPct}%
                      </span>
                    ),
                    loss: metrics.totalPlMinor < 0,
                  },
                  {
                    label: "Allotted Amount",
                    value: money(metrics.allottedMinor, currency),
                    note: `Allotted in ${metrics.allottedCount} IPO${metrics.allottedCount === 1 ? "" : "s"}`,
                  },
                ] as const
              ).map((item) => (
                <article key={item.label} className="ipo-summary-card">
                  <small>{item.label}</small>
                  <strong className={"loss" in item && item.loss ? "is-loss" : undefined}>
                    {item.value}
                  </strong>
                  <span>{item.note}</span>
                </article>
              ))}
            </div>
            <div className="ipo-summary-art" aria-hidden="true">
              <TrendingUp size={56} strokeWidth={1.2} />
            </div>
          </Card>

          <Card className="ipo-filter-bar">
            <div className="ipo-period-tabs">
              {PERIOD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={period === tab.id ? "is-active" : undefined}
                  onClick={() => setPeriod(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="ipo-filter-meta">
              <span className="ipo-range">{periodRangeLabel(period)}</span>
              <Button type="button" variant="secondary" className="ipo-filter-btn">
                <Filter size={14} />
                Filter
              </Button>
            </div>
          </Card>

          <div className="ipo-charts-row">
            <Card className="ipo-chart-card">
              <header>
                <h3>Performance Overview</h3>
                <small>{metrics.returnPct}% overall returns</small>
              </header>
              <strong className="ipo-chart-kpi">{money(metrics.totalPlMinor, currency)}</strong>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={performanceTrend}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="ipo-chart-card">
              <header>
                <h3>IPO Status Overview</h3>
                <small>{filtered.length} total IPOs</small>
              </header>
              <div className="ipo-donut-wrap">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      innerRadius={42}
                      outerRadius={58}
                      paddingAngle={3}
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.colour} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="ipo-donut-center">
                  <strong>{filtered.length}</strong>
                  <small>Total IPOs</small>
                </div>
              </div>
              <ul className="ipo-donut-legend">
                {statusBreakdown.map((item) => (
                  <li key={item.name}>
                    <i style={{ background: item.colour }} />
                    {item.name} ({item.value})
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="ipo-chart-card">
              <header>
                <h3>Profit / Loss Summary</h3>
                <small>This period</small>
              </header>
              <ul className="ipo-pl-summary">
                <li>
                  <span>Positive ({plSummary.positive.count})</span>
                  <b className="ipo-gain">{money(plSummary.positive.minor, currency)}</b>
                </li>
                <li>
                  <span>Negative ({plSummary.negative.count})</span>
                  <b className="ipo-loss">{money(plSummary.negative.minor, currency)}</b>
                </li>
                <li>
                  <span>Break Even ({plSummary.breakEven.count})</span>
                  <b>{money(0, currency)}</b>
                </li>
              </ul>
            </Card>
          </div>

          <Card className="ipo-table-card">
            <header>
              <div>
                <h2>Your IPO Applications</h2>
                <small>Applied amount, allotment, listing price and live P/L.</small>
              </div>
              <div className="ipo-table-tools">
                <div className="ipo-search">
                  <Search size={14} />
                  <input
                    type="search"
                    placeholder="Search IPO"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="ipo-icon-btn"
                  onClick={() => {
                    downloadIpoCsv(list, currency);
                    toast.success("IPO report downloaded");
                  }}
                  aria-label="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  className={`ipo-icon-btn${tableView === "grid" ? " is-active" : ""}`}
                  onClick={() => setTableView("grid")}
                  aria-label="Grid view"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  className={`ipo-icon-btn${tableView === "table" ? " is-active" : ""}`}
                  onClick={() => setTableView("table")}
                  aria-label="List view"
                >
                  <List size={16} />
                </button>
              </div>
            </header>
            {list.length ? (
              tableView === "table" ? (
                <div className="ipo-table-scroll">
                  <table className="ipo-table">
                    <thead>
                      <tr>
                        <th>IPO Name</th>
                        <th>Category</th>
                        <th>Applied On</th>
                        <th>Applied Amount</th>
                        <th>Allotted</th>
                        <th>Listing Price</th>
                        <th>Current Price</th>
                        <th>P/L (₹)</th>
                        <th>P/L (%)</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item) => {
                        const stats = ipoStats(item);
                        const market = item.marketCategory ?? "Mainboard";
                        return (
                          <tr key={item.id}>
                            <td>
                              <span className="ipo-name-cell">
                                <span className="ipo-logo">{ipoAbbrev(item.name)}</span>
                                {item.name}
                              </span>
                            </td>
                            <td>{market}</td>
                            <td>{displayDate(item.appliedOn)}</td>
                            <td>{money(stats.investedMinor, currency)}</td>
                            <td>{money(stats.allottedMinor, currency)}</td>
                            <td>
                              {stats.listingPriceMinor
                                ? money(stats.listingPriceMinor, currency)
                                : "—"}
                            </td>
                            <td>
                              {stats.currentPriceMinor
                                ? money(stats.currentPriceMinor, currency)
                                : "—"}
                            </td>
                            <td className={stats.plMinor >= 0 ? "ipo-gain" : "ipo-loss"}>
                              {stats.plMinor >= 0 ? "+" : "−"}
                              {money(Math.abs(stats.plMinor), currency)}
                            </td>
                            <td className={stats.plPct >= 0 ? "ipo-gain" : "ipo-loss"}>
                              {stats.plPct > 0 ? "+" : ""}
                              {stats.plPct}%
                            </td>
                            <td>
                              <span className={`ipo-pill is-${ipoStatusTone(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                aria-label="Options"
                                onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                              >
                                <MoreVertical size={16} />
                              </button>
                              {menuId === item.id ? (
                                <div className="ipo-menu-pop">
                                  <button type="button" onClick={() => setEditing(item)}>
                                    Edit
                                  </button>
                                  <button type="button" onClick={() => remove.mutate(item.id)}>
                                    Remove
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ipo-grid">
                  {list.map((item) => {
                    const stats = ipoStats(item);
                    return (
                      <article key={item.id} className="ipo-grid-card">
                        <span className="ipo-logo">{ipoAbbrev(item.name)}</span>
                        <strong>{item.name}</strong>
                        <small>{item.marketCategory ?? "Mainboard"}</small>
                        <b className={stats.plMinor >= 0 ? "ipo-gain" : "ipo-loss"}>
                          {stats.plPct > 0 ? "+" : ""}
                          {stats.plPct}%
                        </b>
                        <span className={`ipo-pill is-${ipoStatusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </article>
                    );
                  })}
                </div>
              )
            ) : (
              <EmptyState
                title="No IPO applications in this period"
                description="Add an IPO or widen the date filter to see applications here."
                action={
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus size={14} />
                    Add IPO
                  </Button>
                }
              />
            )}
            <footer className="ipo-table-foot">
              Showing 1 to {list.length} of {list.length} application{list.length === 1 ? "" : "s"}
            </footer>
          </Card>
        </div>

        <aside className="ipo-dash-side">
          <Card className="ipo-side-card">
            <header>
              <h3>Upcoming IPOs</h3>
            </header>
            <ul className="ipo-upcoming">
              {UPCOMING_IPO_FEED.map((item) => (
                <li key={item.id}>
                  <span className={`ipo-logo is-${item.tone}`}>{ipoAbbrev(item.name)}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>Price band {item.priceBand}</small>
                    <small>
                      Open {displayDate(item.openOn)} · Close {displayDate(item.closeOn)}
                    </small>
                  </div>
                  <span className="ipo-upcoming-badge">Upcoming</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="ipo-side-card">
            <header>
              <h3>Returns Over Time</h3>
              <strong className="ipo-gain">{money(metrics.totalPlMinor, currency)}</strong>
            </header>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={returnsTrend}>
                <defs>
                  <linearGradient id="ipoReturnFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis hide />
                <Tooltip formatter={(value) => money(Number(value ?? 0), currency)} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="ipo-side-card">
            <h3>Quick Actions</h3>
            <div className="ipo-quick-grid">
              <button type="button" className="ipo-quick" onClick={() => setAddOpen(true)}>
                <Plus size={18} />
                <small>Add IPO</small>
              </button>
              <button type="button" className="ipo-quick" onClick={() => setPeriod("month")}>
                <CalendarDays size={18} />
                <small>IPO Calendar</small>
              </button>
              <button
                type="button"
                className="ipo-quick"
                onClick={() => {
                  downloadIpoCsv(all, currency);
                  toast.success("IPO report downloaded");
                }}
              >
                <TrendingUp size={18} />
                <small>IPO Reports</small>
              </button>
              <button
                type="button"
                className="ipo-quick"
                onClick={() => {
                  downloadIpoCsv(all, currency);
                  toast.success("Report downloaded");
                }}
              >
                <Download size={18} />
                <small>Download Report</small>
              </button>
            </div>
          </Card>
        </aside>
      </div>

      <IpoFormModal
        key="add-ipo"
        open={addOpen}
        title="Add IPO application"
        currency={currency}
        paymentOptions={paymentLookup}
        pending={create.isPending}
        onClose={() => setAddOpen(false)}
        onSave={(body, bankAccountId) => create.mutate({ body, bankAccountId })}
      />
      <IpoFormModal
        key={editing ? editing.id : "edit-closed"}
        open={Boolean(editing)}
        title="Edit IPO application"
        currency={currency}
        paymentOptions={paymentLookup}
        initial={editing ?? undefined}
        pending={update.isPending}
        onClose={() => setEditing(null)}
        onSave={(body) => {
          if (editing) update.mutate({ id: editing.id, body });
        }}
      />
    </div>
  );
}

function IpoFormModal({
  open,
  title,
  currency,
  paymentOptions,
  initial,
  pending,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  currency: string;
  paymentOptions: Array<{ id: string; label: string; group: "bank" | "upi" | "broker" }>;
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
  const [paymentSource, setPaymentSource] = useState(initial?.paymentSource ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const bankIds = useMemo(
    () => paymentOptions.filter((item) => item.group === "bank").map((item) => item.id),
    [paymentOptions],
  );
  const deductBankId = bankIds.includes(paymentSource) ? paymentSource : undefined;

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
      allottedAmountMinor: parseOptionalMinor(allotted),
      listingPriceMinor: parseOptionalMinor(listing),
      currentPriceMinor: parseOptionalMinor(current),
      paymentSource: paymentSource || null,
      currency,
    };
    onSave(body, initial ? undefined : deductBankId);
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
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Lots">
            <Select value={lots} onChange={(event) => setLots(event.target.value)}>
              {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Applied Amount (${currency})`} error={errors.amount}>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter total applied amount"
            />
          </Field>
          <Field label={`Allotted Amount (${currency})`}>
            <Input
              inputMode="decimal"
              value={allotted}
              onChange={(event) => setAllotted(event.target.value)}
              placeholder="If allotted"
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as IpoStatus)}
            >
              {IPO_STATUSES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
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
        </div>
        <p className="ipo-form-section">Additional Details (Optional)</p>
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
          <Field
            label="Bank / UPI / Broker"
            hint="Choosing a bank deducts applied amount on first save."
          >
            <Select
              value={paymentSource}
              onChange={(event) => setPaymentSource(event.target.value)}
              disabled={Boolean(initial)}
            >
              <option value="">Select bank or broker</option>
              {paymentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.group === "broker"
                    ? item.label
                    : item.group === "upi"
                      ? `UPI · ${item.label}`
                      : `Bank · ${item.label}`}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="ipo-security">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            <strong>We keep your data safe and secure.</strong> Your IPO details are encrypted and
            stored securely.
          </p>
        </div>
        <div className="ipo-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save IPO"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
