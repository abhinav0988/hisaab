"use client";

import type { Account, Transaction } from "@hisaab/types";
import { Button, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  Banknote,
  Bell,
  Building2,
  ChartNoAxesCombined,
  ChartSpline,
  ChevronRight,
  CircleArrowDown,
  CircleArrowUp,
  Download,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  Moon,
  MoreVertical,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Wallet,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import {
  BANK_ACCOUNT_TYPES,
  avgMonthlyBalance,
  bankAbbrev,
  bankBrandTone,
  bankLabel,
  bankLast4,
  bankMaskDisplay,
  bankNickname,
  bankSubtype,
  bankTransactionHref,
  deltaPct,
  downloadBankCsv,
  formatBankAccountName,
  INDIAN_BANKS,
} from "@/lib/bank";
import { displayDateLong } from "@/lib/finance-modules";
import { localDateKey, money, signedMoney } from "@/lib/format";
import { accountService } from "@/services/account.service";
import { dashboardService } from "@/services/dashboard.service";
import { profileService } from "@/services/profile.service";
import { reportService } from "@/services/report.service";
import { transactionService } from "@/services/transaction.service";
import "../../app/bank23.css";

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function BankThemeButton() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && theme === "dark";
  return (
    <button
      type="button"
      className="bank23-icon-btn"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

function BankNotifyButton({ notices }: { notices: Array<{ title: string; body: string }> }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="bank23-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="bank23-icon-btn bank23-notify"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
        {notices.length ? <span className="bank23-notify-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="bank23-notify-panel" role="dialog" aria-label="Bank notifications">
          <header>
            <div>
              <h2>Notifications</h2>
              <p>{notices.length ? `${notices.length} alert${notices.length === 1 ? "" : "s"}` : "You're all caught up"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              Mark read
            </button>
          </header>
          {notices.length ? (
            <ul className="m-0 grid list-none gap-1 p-0">
              {notices.map((item) => (
                <li
                  key={`${item.title}-${item.body}`}
                  className="rounded-xl px-2 py-2.5 hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]"
                >
                  <strong className="block text-xs">{item.title}</strong>
                  <small className="mt-1 block text-[10.5px] text-[var(--muted-foreground)]">{item.body}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bank23-notify-empty">No bank alerts yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

const BALANCE_RANGES = ["1M", "3M", "6M", "1Y", "All"] as const;
type BalanceRange = (typeof BALANCE_RANGES)[number];

function accountMonthFlow(accountId: string, transactions: Transaction[]) {
  let inflow = 0;
  let outflow = 0;
  for (const item of transactions) {
    if (item.accountId !== accountId) continue;
    if (item.type === "INCOME") inflow += item.amountMinor;
    else outflow += item.amountMinor;
  }
  return { inflow, outflow };
}

function formatAccountUpdated(stamp: string | null | undefined) {
  if (!stamp) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(stamp));
}

function buildMonthlyBalanceTrend(
  totalMinor: number,
  monthly: Array<{ month: string; income: number; expense: number }>,
  count: number | "all",
) {
  const slice = count === "all" ? monthly : monthly.slice(-count);
  if (!slice.length) return [{ label: "Now", balance: totalMinor }];
  const points: Array<{ label: string; balance: number }> = [];
  let running = totalMinor;
  for (let index = slice.length - 1; index >= 0; index -= 1) {
    const item = slice[index];
    if (!item) continue;
    points.unshift({ label: item.month, balance: running });
    running -= item.income - item.expense;
  }
  return points;
}

function balanceTrendPct(points: Array<{ balance: number }>) {
  if (points.length < 2) return 0;
  const first = points[0]?.balance ?? 0;
  const last = points[points.length - 1]?.balance ?? 0;
  return deltaPct(last, first);
}

function buildBalanceTrend(totalMinor: number, transactions: Transaction[], bankIds: Set<string>) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthNet = transactions
    .filter((item) => bankIds.has(item.accountId))
    .reduce(
      (sum, item) => sum + (item.type === "INCOME" ? item.amountMinor : -item.amountMinor),
      0,
    );
  let running = totalMinor - monthNet;
  const byDay = new Map<number, number>();
  for (let day = 1; day <= daysInMonth; day += 1) byDay.set(day, running);
  const sorted = [...transactions]
    .filter((item) => bankIds.has(item.accountId))
    .sort((left, right) => left.transactionAt.localeCompare(right.transactionAt));
  for (const item of sorted) {
    const date = new Date(item.transactionAt);
    if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) continue;
    const delta = item.type === "INCOME" ? item.amountMinor : -item.amountMinor;
    for (let day = date.getDate(); day <= daysInMonth; day += 1) {
      byDay.set(day, (byDay.get(day) ?? running) + delta);
    }
    running += delta;
  }
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const label = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
      new Date(now.getFullYear(), now.getMonth(), day),
    );
    return { label, balance: byDay.get(day) ?? totalMinor };
  });
}

function isoToday() {
  return localDateKey(new Date());
}

function lastUpdatedLabel(accounts: Account[]) {
  const stamp = accounts
    .map((item) => item.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!stamp) return "Just now";
  const date = new Date(stamp);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return `Today, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date)}`;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function accountLabelForTxn(txn: Transaction, accounts: Account[]) {
  const match = accounts.find((item) => item.id === txn.accountId);
  if (match) {
    const label = bankLabel(match);
    const last4 = bankLast4(match.name);
    return `${label} ${bankMaskDisplay(last4)}`;
  }
  return txn.accountName ?? "Bank account";
}

function balanceTrendForRange(
  range: BalanceRange,
  totalMinor: number,
  monthly: Array<{ month: string; income: number; expense: number }>,
  transactions: Transaction[],
  bankIds: Set<string>,
) {
  if (range === "1M") return buildBalanceTrend(totalMinor, transactions, bankIds);
  if (range === "3M") return buildMonthlyBalanceTrend(totalMinor, monthly, 3);
  if (range === "6M") return buildMonthlyBalanceTrend(totalMinor, monthly, 6);
  if (range === "1Y") return buildMonthlyBalanceTrend(totalMinor, monthly, 12);
  return buildMonthlyBalanceTrend(totalMinor, monthly, "all");
}

function bankLogoClass(label: string) {
  const tone = bankBrandTone(label);
  if (tone === "kotak" || tone === "hdfc" || tone === "axis") return "red";
  if (tone === "sbi") return "green";
  if (tone === "icici") return "";
  return "green";
}

function activityTone(index: number) {
  return (["", "gold", "purple"] as const)[index % 3] ?? "";
}

function activityIcon(name: string, index: number): ReactNode {
  const key = name.toLowerCase();
  if (key.includes("home") || key.includes("rent") || key.includes("housing")) {
    return <Building2 aria-hidden />;
  }
  if (key.includes("shop") || key.includes("amazon") || key.includes("basket")) {
    return <ShoppingBag aria-hidden />;
  }
  if (index % 3 === 1) return <Building2 aria-hidden />;
  if (index % 3 === 2) return <ShoppingBag aria-hidden />;
  return <Banknote aria-hidden />;
}

function DeltaText({ value, invert }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const arrow = positive ? "↑" : negative ? "↓" : "→";
  return (
    <>
      {arrow} {Math.abs(value)}% vs last month
    </>
  );
}

export function BankView() {
  const router = useRouter();
  const client = useQueryClient();
  const [hideBalance, setHideBalance] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addFormKey, setAddFormKey] = useState(0);
  const [editing, setEditing] = useState<Account | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [balanceRange, setBalanceRange] = useState<BalanceRange>("1M");

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const banks = useQuery({ queryKey: ["bank-accounts"], queryFn: () => accountService.listBanks() });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.summary() });
  const bankIdsKey = (banks.data ?? [])
    .map((item) => item.id)
    .sort()
    .join(",");
  const bankMonthly = useQuery({
    queryKey: ["bank-monthly", bankIdsKey],
    enabled: Boolean(bankIdsKey),
    queryFn: () => reportService.monthly(`accountIds=${bankIdsKey}`),
  });
  const transactions = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: async () => {
      const from = monthStartIso();
      const result = await transactionService.list(
        new URLSearchParams({
          from,
          limit: "100",
          sort: "newest",
        }).toString(),
      );
      return result.data;
    },
  });

  if (
    profile.isLoading ||
    banks.isLoading ||
    dashboard.isLoading ||
    (Boolean(bankIdsKey) && bankMonthly.isLoading)
  )
    return <PageSkeleton />;
  if (!profile.data || !banks.data || !dashboard.data)
    return <ErrorState retry={() => void banks.refetch()} />;

  const currency = profile.data.defaultCurrency;
  const accounts = banks.data;
  const bankIds = new Set(accounts.map((item) => item.id));
  const totalMinor = accounts.reduce((sum, item) => sum + item.currentBalanceMinor, 0);
  const data = dashboard.data;
  const monthly = bankMonthly.data?.length ? bankMonthly.data : data.monthlyComparison;
  const lastMonth = monthly.at(-2);
  const incomeDelta = lastMonth ? deltaPct(data.incomeThisMonth, lastMonth.income) : 0;
  const expenseDelta = lastMonth ? deltaPct(data.spentThisMonth, lastMonth.expense) : 0;
  const lastNet = lastMonth ? lastMonth.income - lastMonth.expense : 0;
  const savingsDelta = lastNet ? deltaPct(data.netSavings, lastNet) : 0;
  const avgBalance = avgMonthlyBalance(totalMinor, monthly);
  const prevAvg = lastMonth
    ? avgMonthlyBalance(totalMinor - (data.incomeThisMonth - data.spentThisMonth), monthly.slice(0, -1))
    : avgBalance;
  const avgDelta = prevAvg ? deltaPct(avgBalance, prevAvg) : 0;
  const txns = transactions.data ?? [];
  const bankTxns = txns.filter((item) => bankIds.has(item.accountId));
  const recent = bankTxns.slice(0, 5);
  const cashFlowChart = monthly.map((item) => ({
    label: item.month,
    income: item.income,
    expense: item.expense,
    savings: item.income - item.expense,
  }));
  const hasCashFlow = cashFlowChart.some((item) => item.income > 0 || item.expense > 0);
  const balanceTrend = balanceTrendForRange(
    balanceRange,
    totalMinor,
    monthly,
    bankTxns,
    bankIds,
  );
  const balanceDelta = balanceTrendPct(balanceTrend);
  const primaryId =
    accounts.find((item) => (item as Account & { catalogId?: string | null }).catalogId)?.id ??
    accounts[0]?.id;

  function openAddForm() {
    setAddFormKey((value) => value + 1);
    setAddOpen(true);
  }

  function refresh() {
    void client.invalidateQueries({ queryKey: ["bank-accounts"] });
    void client.invalidateQueries({ queryKey: ["accounts"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
    void client.invalidateQueries({ queryKey: ["bank-transactions"] });
  }

  function handleDownload() {
    downloadBankCsv(accounts, currency, totalMinor);
    toast.success("Bank summary downloaded");
  }

  return (
    <div className="bank23">
      <header className="bank23-top">
        <div className="bank23-title-ico" aria-hidden>
          <Landmark />
        </div>
        <div className="bank23-title">
          <h1>Bank</h1>
          <p>Your complete view of balances, cash flow, and activity across linked bank accounts.</p>
        </div>
        <div className="bank23-head-right">
          <div className="bank23-head-actions">
            <button
              type="button"
              className="bank23-add"
              onClick={() => router.push("/transactions?action=expense")}
            >
              <Plus size={15} aria-hidden="true" />
              Add transaction
            </button>
            <BankNotifyButton
              notices={
                data.netSavings < 0
                  ? [
                      {
                        title: "Net savings negative this month",
                        body: `${money(data.netSavings, currency)} · expenses outpaced income`,
                      },
                    ]
                  : []
              }
            />
            <BankThemeButton />
            <button
              type="button"
              className="bank23-icon-btn"
              aria-label="More actions"
              onClick={() => toast.info("Use Quick Actions below for common bank tasks.")}
            >
              <MoreVertical size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="bank23-subactions">
            <button type="button" className="bank23-addbank" onClick={openAddForm}>
              <Plus />
              <span>Add Bank Account</span>
            </button>
          </div>
        </div>
      </header>

      <section className="bank23-kpis">
        <article className="bank23-kpi green">
          <i className="bank23-kpi-ico" aria-hidden>
            <WalletCards />
          </i>
          <label>Total Bank Balance</label>
          <strong>{hideBalance ? "₹ ••••••" : money(totalMinor, currency)}</strong>
          <small>
            Across {accounts.length} linked account{accounts.length === 1 ? "" : "s"}
            <br />
            Updated {lastUpdatedLabel(accounts)}
          </small>
          <button
            type="button"
            className="bank23-eye"
            aria-label={hideBalance ? "Show balance" : "Hide balance"}
            onClick={() => setHideBalance((value) => !value)}
          >
            {hideBalance ? <EyeOff /> : <Eye />}
          </button>
        </article>
        <article className="bank23-kpi">
          <i className="bank23-kpi-ico" aria-hidden>
            <CircleArrowDown />
          </i>
          <label>Income This Month</label>
          <strong>{money(data.incomeThisMonth, currency)}</strong>
          <small>
            <DeltaText value={incomeDelta} />
          </small>
        </article>
        <article className="bank23-kpi gold">
          <i className="bank23-kpi-ico" aria-hidden>
            <CircleArrowUp />
          </i>
          <label>Expenses This Month</label>
          <strong>{money(data.spentThisMonth, currency)}</strong>
          <small>
            <DeltaText value={expenseDelta} invert />
          </small>
        </article>
        <article className={`bank23-kpi${data.netSavings < 0 ? " red" : ""}`}>
          <i className="bank23-kpi-ico" aria-hidden>
            <ChartNoAxesCombined />
          </i>
          <label>Net Savings</label>
          <strong>{money(data.netSavings, currency)}</strong>
          <small>
            <DeltaText value={savingsDelta} />
          </small>
        </article>
        <article className="bank23-kpi blue">
          <i className="bank23-kpi-ico" aria-hidden>
            <ChartSpline />
          </i>
          <label>Avg. Monthly Balance</label>
          <strong>{money(avgBalance, currency)}</strong>
          <small>
            <DeltaText value={avgDelta} />
          </small>
        </article>
      </section>

      <section className="bank23-grid">
        <main className="bank23-main">
          <article className="bank23-card bank23-pad" id="bank-accounts">
            <div className="bank23-cardhead">
              <div>
                <h3>Your Bank Accounts</h3>
                <p>Balances, inflow and outflow for the current month.</p>
              </div>
            </div>
            {accounts.length ? (
              <>
                <div className="bank23-tablehdr" aria-hidden>
                  <span>Account</span>
                  <span>Current Balance</span>
                  <span>Monthly Inflow</span>
                  <span>Monthly Outflow</span>
                  <span>Last Updated</span>
                  <span />
                </div>
                {accounts.map((account) => {
                  const label = bankLabel(account);
                  const last4 = bankLast4(account.name);
                  const flow = accountMonthFlow(account.id, bankTxns);
                  const negative = account.currentBalanceMinor < 0;
                  return (
                    <div key={account.id} className="bank23-row">
                      <div className="bank23-bank">
                        <i className={`bank23-banklogo ${bankLogoClass(label)}`.trim()}>
                          {bankAbbrev(label)}
                        </i>
                        <div>
                          <b>
                            {label}
                            {account.id === primaryId ? (
                              <span className="bank23-primary">Primary</span>
                            ) : null}
                          </b>
                          <small>
                            {bankSubtype(account)}
                            {last4 ? ` •••• ${last4}` : ""}
                          </small>
                        </div>
                      </div>
                      <div className={`bank23-cell${negative ? " neg" : ""}`}>
                        <b>{money(account.currentBalanceMinor, currency)}</b>
                      </div>
                      <div className="bank23-cell">
                        <b>{money(flow.inflow, currency)}</b>
                      </div>
                      <div className="bank23-cell">
                        <b>{money(flow.outflow, currency)}</b>
                      </div>
                      <div className="bank23-cell">
                        <b>{formatAccountUpdated(account.updatedAt)}</b>
                      </div>
                      <button
                        type="button"
                        className="bank23-more"
                        aria-label="Account options"
                        onClick={() => setMenuId(menuId === account.id ? null : account.id)}
                      >
                        <MoreVertical />
                      </button>
                      {menuId === account.id ? (
                        <div className="bank23-menu-pop">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId(null);
                              router.push(bankTransactionHref(account.id, "INCOME"));
                            }}
                          >
                            Add money
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId(null);
                              router.push(bankTransactionHref(account.id, "EXPENSE"));
                            }}
                          >
                            Record expense
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId(null);
                              setEditing(account);
                            }}
                          >
                            Edit account
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            ) : (
              <EmptyState
                title="No bank accounts yet"
                description="Add your first bank account to track balances and transactions here."
                action={
                  <Button onClick={openAddForm}>
                    <Plus size={14} />
                    Add bank account
                  </Button>
                }
              />
            )}
            <button type="button" className="bank23-addrow" onClick={openAddForm}>
              <Plus />
              <span>Add New Bank Account</span>
            </button>
          </article>

          <article className="bank23-card bank23-cash">
            <div className="bank23-cardhead">
              <div>
                <h3>Monthly Cash Flow</h3>
                <p>Income, expense and net savings by month.</p>
              </div>
            </div>
            <div className="bank23-cashbody">
              <div className="bank23-art">
                <div className="bank23-wallet" aria-hidden />
              </div>
              {hasCashFlow ? (
                <div className="bank23-cash-chart">
                  <ResponsiveContainer width="100%" height={110}>
                    <ComposedChart data={cashFlowChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(value, name) => [
                          money(Number(value ?? 0), currency),
                          name === "income"
                            ? "Income"
                            : name === "expense"
                              ? "Expense"
                              : "Net savings",
                        ]}
                      />
                      <Bar dataKey="income" fill="#2d8455" radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="expense" fill="#e5484d" radius={[4, 4, 0, 0]} barSize={12} />
                      <Line type="monotone" dataKey="savings" stroke="#36a8ff" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="bank23-empty">
                  <b>No cash flow data yet</b>
                  <p>Your income and expenses will appear here once you start adding transactions.</p>
                </div>
              )}
              <div className="bank23-cashstats">
                <div className="bank23-cstat">
                  <i aria-hidden>
                    <Wallet />
                  </i>
                  <label>Total Income</label>
                  <b>{money(data.incomeThisMonth, currency)}</b>
                </div>
                <div className="bank23-cstat red">
                  <i aria-hidden>
                    <ArrowDownToLine />
                  </i>
                  <label>Total Expenses</label>
                  <b>{money(data.spentThisMonth, currency)}</b>
                </div>
                <div className={`bank23-cstat net${data.netSavings < 0 ? " is-negative" : ""}`}>
                  <i aria-hidden>
                    <ArrowDownToLine />
                  </i>
                  <label>Net Savings</label>
                  <b>{money(data.netSavings, currency)}</b>
                </div>
              </div>
            </div>
          </article>

          <article className="bank23-card bank23-actions">
            <h3>Quick Actions</h3>
            <div className="bank23-actiongrid">
              <button
                type="button"
                className="bank23-action"
                onClick={() =>
                  accounts[0]
                    ? router.push(bankTransactionHref(accounts[0].id, "INCOME"))
                    : openAddForm()
                }
              >
                <i aria-hidden>
                  <Wallet />
                </i>
                <span>
                  <b>Add money</b>
                  <small>Credit income to a bank account</small>
                </span>
                <span className="chev" aria-hidden>
                  <ChevronRight />
                </span>
              </button>
              <button
                type="button"
                className="bank23-action"
                onClick={() => router.push("/transactions?action=add")}
              >
                <i aria-hidden>
                  <ArrowLeftRight />
                </i>
                <span>
                  <b>Transfer entry</b>
                  <small>Record a bank transfer</small>
                </span>
                <span className="chev" aria-hidden>
                  <ChevronRight />
                </span>
              </button>
              <button type="button" className="bank23-action" onClick={openAddForm}>
                <i aria-hidden>
                  <Landmark />
                </i>
                <span>
                  <b>Add bank account</b>
                  <small>Link a new bank account</small>
                </span>
                <span className="chev" aria-hidden>
                  <ChevronRight />
                </span>
              </button>
              <button type="button" className="bank23-action" onClick={handleDownload}>
                <i aria-hidden>
                  <Download />
                </i>
                <span>
                  <b>Download statement</b>
                  <small>Get account statement</small>
                </span>
                <span className="chev" aria-hidden>
                  <ChevronRight />
                </span>
              </button>
              <button type="button" className="bank23-action" onClick={handleDownload}>
                <i aria-hidden>
                  <FileText />
                </i>
                <span>
                  <b>Account summary</b>
                  <small>Detailed account report</small>
                </span>
                <span className="chev" aria-hidden>
                  <ChevronRight />
                </span>
              </button>
            </div>
          </article>
        </main>

        <aside className="bank23-side">
          <article className="bank23-card bank23-trend">
            <div className="bank23-cardhead">
              <div>
                <h3>Balance trend</h3>
                <p>{balanceRange === "1M" ? "This month" : balanceRange}</p>
              </div>
              <div className="bank23-trendval">
                <b>{hideBalance ? "••••" : money(totalMinor, currency)}</b>
                <em className={balanceDelta >= 0 ? "up" : undefined}>
                  {balanceDelta < 0 ? "↓" : balanceDelta > 0 ? "↑" : "—"} {Math.abs(balanceDelta)}%
                </em>
              </div>
            </div>
            <div className="bank23-tabs">
              {BALANCE_RANGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={balanceRange === item ? "active" : undefined}
                  onClick={() => setBalanceRange(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="bank23-chart">
              <div className="bank23-chart-shell">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={balanceTrend} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bank23Area" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={balanceDelta < 0 ? "var(--b-red)" : "#2ce67f"}
                          stopOpacity={0.38}
                        />
                        <stop
                          offset="100%"
                          stopColor={balanceDelta < 0 ? "var(--b-red)" : "#2ce67f"}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={22}
                    />
                    <YAxis
                      width={38}
                      tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => {
                        const major = Number(value) / 100;
                        return major >= 1000 ? `₹${Math.round(major / 1000)}K` : money(Number(value), currency);
                      }}
                    />
                    <Tooltip formatter={(value) => money(Number(value ?? 0), currency)} />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={balanceDelta < 0 ? "var(--b-red)" : "#2be27f"}
                      fill="url(#bank23Area)"
                      strokeWidth={2}
                      dot={{
                        r: 3,
                        fill: balanceDelta < 0 ? "var(--b-red)" : "#65f3a4",
                        stroke: balanceDelta < 0 ? "#7e2632" : "#0d5734",
                        strokeWidth: 1.5,
                      }}
                      activeDot={{ r: 4.5, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </article>

          <article className="bank23-card bank23-activity">
            <div className="bank23-cardhead">
              <div>
                <h3>Recent bank activity</h3>
                <p>Latest transactions on linked accounts.</p>
              </div>
            </div>
            {recent.length ? (
              <div className="bank23-actlist">
                {recent.map((item, index) => {
                  const title = item.merchant || item.categoryName || "Transaction";
                  return (
                    <Link key={item.id} href="/transactions" className="bank23-actrow">
                      <i className={`bank23-actico ${activityTone(index)}`.trim()} aria-hidden>
                        {activityIcon(title, index)}
                      </i>
                      <div>
                        <b>{title}</b>
                        <small>
                          {accountLabelForTxn(item, accounts)}
                          <br />
                          {displayDateLong(localDateKey(item.transactionAt))}
                        </small>
                      </div>
                      <strong className={item.type === "INCOME" ? "in" : undefined}>
                        {signedMoney(item.amountMinor, currency, item.type)}
                      </strong>
                      <span className="chev" aria-hidden>
                        <ChevronRight />
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="bank23-empty-note">
                Add a transaction on a bank account to see activity here.
              </p>
            )}
            <Link href="/transactions" className="bank23-view">
              View all transactions
              <ChevronRight />
            </Link>
          </article>
        </aside>
      </section>

      <AddBankAccountModal
        key={addFormKey}
        open={addOpen}
        currency={currency}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          refresh();
          toast.success("Bank account added");
        }}
      />
      <EditBankAccountModal
        key={editing?.id ?? "edit-closed"}
        open={Boolean(editing)}
        account={editing}
        currency={currency}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
          toast.success("Bank account updated");
        }}
      />
    </div>
  );
}

function AddBankAccountModal({
  open,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bank, setBank] = useState("");
  const [holder, setHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [showNumber, setShowNumber] = useState(false);
  const [ifsc, setIfsc] = useState("");
  const [accountType, setAccountType] = useState<string>(BANK_ACCOUNT_TYPES[0] ?? "Savings");
  const [nickname, setNickname] = useState("");
  const [branch, setBranch] = useState("");
  const [linkingDate, setLinkingDate] = useState(isoToday());
  const [trackingDate, setTrackingDate] = useState(isoToday());
  const [opening, setOpening] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const last4 = accountNumber.replace(/\D/g, "").slice(-4);
      if (!last4 || last4.length < 4) throw new Error("Enter a valid account number.");
      const openingMinor = opening.trim() ? majorToMinor(opening.replace(/,/g, "")) : 0;
      return accountService.createBank({
        name: formatBankAccountName(accountType, last4, nickname || holder),
        type: "BANK",
        institutionName: branch.trim() ? `${bank} · ${branch.trim()}` : bank,
        openingBalanceMinor: openingMinor,
        currency,
        isActive: true,
      });
    },
    onSuccess: onSaved,
    onError: (error) => toast.error(failMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!bank.trim()) next.bank = "Select a bank.";
    if (!holder.trim()) next.holder = "Enter account holder name.";
    const digits = accountNumber.replace(/\D/g, "");
    if (digits.length < 4) next.accountNumber = "Enter a valid account number.";
    if (ifsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc.trim())) {
      next.ifsc = "Enter a valid IFSC code.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Bank Account" size="lg">
      <p className="bank-modal-lead">
        Link a bank account to track balances, cash flow and transactions.
      </p>
      <form className="bank-form" onSubmit={submit}>
        <Field label="Select bank" error={errors.bank}>
          <Select value={bank} onChange={(event) => setBank(event.target.value)}>
            <option value="" disabled>
              Choose a bank
            </option>
            {INDIAN_BANKS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Account holder name" error={errors.holder}>
          <Input value={holder} onChange={(event) => setHolder(event.target.value)} placeholder="Full name" />
        </Field>
        <div className="bank-form-split">
          <Field label="Account type">
            <Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              {BANK_ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account number" error={errors.accountNumber}>
            <div className="bank-number-shell">
              <Input
                type={showNumber ? "text" : "password"}
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                placeholder="Enter account number"
                inputMode="numeric"
              />
              <button
                type="button"
                className="bank-number-toggle"
                aria-label={showNumber ? "Hide account number" : "Show account number"}
                onClick={() => setShowNumber((value) => !value)}
              >
                {showNumber ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        </div>
        <div className="bank-form-split">
          <Field label="IFSC code" error={errors.ifsc}>
            <Input
              value={ifsc}
              onChange={(event) => setIfsc(event.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
            />
          </Field>
          <Field label="Branch name">
            <Input
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="e.g. Koramangala"
            />
          </Field>
        </div>
        <Field label="Nickname (optional)">
          <Input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="e.g. Salary account"
          />
        </Field>
        <div className="bank-form-split">
          <Field label="Opening balance (₹)">
            <Input
              inputMode="decimal"
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Linking date">
            <Input
              type="date"
              value={linkingDate}
              onChange={(event) => setLinkingDate(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Start tracking date">
          <Input
            type="date"
            value={trackingDate}
            onChange={(event) => setTrackingDate(event.target.value)}
          />
        </Field>
        <div className="bank-security">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            <strong>Your security is our priority.</strong> Bank details are encrypted and stored
            securely. We never share your data with third parties.
          </p>
        </div>
        <div className="bank-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Adding…" : "Add Account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditBankAccountModal({
  open,
  account,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: Account | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bank, setBank] = useState("");
  const [accountType, setAccountType] = useState<string>(BANK_ACCOUNT_TYPES[0]);
  const [nickname, setNickname] = useState("");
  const [branch, setBranch] = useState("");
  const [opening, setOpening] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accountKey = account?.id ?? "";
  const [loadedKey, setLoadedKey] = useState(accountKey);
  if (account && accountKey !== loadedKey) {
    const institution = account.institutionName?.trim() ?? "";
    const [bankPart, ...branchParts] = institution.split(" · ");
    const matchedBank =
      INDIAN_BANKS.find((item) => item.toLowerCase() === (bankPart ?? "").toLowerCase()) ??
      bankPart?.trim() ??
      "HDFC Bank";
    setLoadedKey(accountKey);
    setBank(matchedBank);
    setBranch(branchParts.join(" · ").trim());
    setAccountType(bankSubtype(account));
    setNickname(bankNickname(account));
    setOpening(String((account.openingBalanceMinor ?? 0) / 100));
    setActive(account.isActive === true || Number(account.isActive) === 1);
    setErrors({});
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!account) throw new Error("Account missing.");
      const last4 = bankLast4(account.name) ?? "0000";
      const openingMinor = opening.trim()
        ? majorToMinor(opening.replace(/,/g, ""))
        : account.openingBalanceMinor;
      return accountService.update(account.id, {
        name: formatBankAccountName(accountType, last4, nickname || accountType),
        institutionName: branch.trim() ? `${bank} · ${branch.trim()}` : bank,
        openingBalanceMinor: openingMinor,
        currency: account.currency || currency,
        isActive: active,
      });
    },
    onSuccess: onSaved,
    onError: (error) => toast.error(failMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!bank.trim()) next.bank = "Select a bank.";
    if (!opening.trim() || Number.isNaN(Number(opening.replace(/,/g, "")))) {
      next.opening = "Enter a valid opening balance.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  }

  if (!account) return null;
  const last4 = bankLast4(account.name);

  return (
    <Modal open={open} onClose={onClose} title="Edit bank account">
      <form className="bank-form" onSubmit={submit}>
        <Field label="Bank" error={errors.bank}>
          <Select value={bank} onChange={(event) => setBank(event.target.value)}>
            {!INDIAN_BANKS.includes(bank as (typeof INDIAN_BANKS)[number]) ? (
              <option value={bank}>{bank}</option>
            ) : null}
            {INDIAN_BANKS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <div className="bank-form-split">
          <Field label="Account type">
            <Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              {BANK_ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account ending">
            <Input value={last4 ? `•••• ${last4}` : "•••• ••••"} disabled />
          </Field>
        </div>
        <Field label="Nickname">
          <Input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="e.g. Salary account"
          />
        </Field>
        <Field label="Branch (optional)">
          <Input
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            placeholder="e.g. Koramangala"
          />
        </Field>
        <Field label={`Opening balance (${currency})`} error={errors.opening}>
          <Input
            inputMode="decimal"
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="accent-[var(--primary)]"
          />
          Account is active
        </label>
        <div className="bank-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
