"use client";

import type { Account, Transaction } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Download,
  Eye,
  EyeOff,
  FileText,
  MoreVertical,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { PageHeader } from "@/components/layout/page-header";
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
import { money, signedMoney } from "@/lib/format";
import { accountService } from "@/services/account.service";
import { dashboardService } from "@/services/dashboard.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
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

function DeltaNote({ value, invert }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : ArrowLeftRight;
  return (
    <span
      className={
        positive
          ? "text-[var(--primary)]"
          : negative
            ? "text-[var(--warning)]"
            : "text-[var(--muted-foreground)]"
      }
    >
      <Icon size={12} className="inline me-0.5" aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
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

type BankInsight = {
  id: string;
  tone: "danger" | "warning" | "violet" | "info";
  title: string;
  body: string;
  icon: typeof AlertTriangle;
};

function buildBankInsights(
  data: {
    incomeThisMonth: number;
    spentThisMonth: number;
    netSavings: number;
  },
  expenseDelta: number,
  bankTxns: Transaction[],
  currency: string,
): BankInsight[] {
  const insights: BankInsight[] = [];
  if (expenseDelta >= 50 && data.spentThisMonth > 0) {
    insights.push({
      id: "spending",
      tone: "danger",
      title: "High spending alert",
      body: `Expenses are ${expenseDelta}% higher than last month. Review recent outflows to stay on track.`,
      icon: AlertTriangle,
    });
  }
  if (data.incomeThisMonth === 0) {
    insights.push({
      id: "salary",
      tone: "warning",
      title: "Salary not credited",
      body: "No salary or income was detected on linked bank accounts this month.",
      icon: Banknote,
    });
  }
  const largest = bankTxns
    .filter((item) => item.type === "EXPENSE")
    .sort((left, right) => right.amountMinor - left.amountMinor)[0];
  if (largest) {
    insights.push({
      id: "largest",
      tone: "violet",
      title: "Largest expense",
      body: `${largest.merchant || largest.categoryName || "Expense"} of ${money(largest.amountMinor, currency)} was your biggest outflow.`,
      icon: TrendingDown,
    });
  }
  insights.push({
    id: "projected",
    tone: "info",
    title: "Projected balance",
    body:
      data.netSavings >= 0
        ? `You are on track to save ${money(data.netSavings, currency)} this month if spending stays steady.`
        : `You may close the month with net savings of ${money(data.netSavings, currency)} at the current pace.`,
    icon: Sparkles,
  });
  return insights;
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

export function BankView() {
  const router = useRouter();
  const client = useQueryClient();
  const [hideBalance, setHideBalance] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addFormKey, setAddFormKey] = useState(0);
  const [editing, setEditing] = useState<Account | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [balanceRange, setBalanceRange] = useState<BalanceRange>("1M");
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const banks = useQuery({ queryKey: ["bank-accounts"], queryFn: () => accountService.listBanks() });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.summary() });
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

  if (profile.isLoading || banks.isLoading || dashboard.isLoading) return <PageSkeleton />;
  if (!profile.data || !banks.data || !dashboard.data)
    return <ErrorState retry={() => void banks.refetch()} />;

  const currency = profile.data.defaultCurrency;
  const accounts = banks.data;
  const bankIds = new Set(accounts.map((item) => item.id));
  const totalMinor = accounts.reduce((sum, item) => sum + item.currentBalanceMinor, 0);
  const data = dashboard.data;
  const monthly = data.monthlyComparison;
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
  const balanceTrend = balanceTrendForRange(
    balanceRange,
    totalMinor,
    monthly,
    bankTxns,
    bankIds,
  );
  const balanceDelta = balanceTrendPct(balanceTrend);
  const isOverdrawn = totalMinor < 0;
  const insights = buildBankInsights(data, expenseDelta, bankTxns, currency);
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
    <div>
      <PageHeader
        title="Bank"
        description="Your complete view of balances, cash flow, and activity across linked bank accounts."
        actions={
          <Button variant="secondary" onClick={openAddForm}>
            <Plus size={14} />
            Add Bank Account
          </Button>
        }
      />

      <div className="bank-kpi-row">
        <Card className={`bank-kpi-total${isOverdrawn ? " is-overdrawn" : ""}`}>
          <small>Total bank balance</small>
          <div className="bank-kpi-total-row">
            <strong className={isOverdrawn ? "is-negative" : undefined}>
              {hideBalance ? "₹ ••••••" : money(totalMinor, currency)}
            </strong>
            <button
              type="button"
              className="bank-hero-eye"
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
              onClick={() => setHideBalance((value) => !value)}
            >
              {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {isOverdrawn ? (
            <div className="bank-overdrawn">
              <AlertTriangle size={14} aria-hidden="true" />
              <div>
                <strong>Overdrawn</strong>
                <p>
                  Your account balance is below zero.{" "}
                  <button
                    type="button"
                    className="bank-overdrawn-link"
                    onClick={() =>
                      document.getElementById("bank-accounts")?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    View details
                    <ArrowRight size={12} aria-hidden="true" />
                  </button>
                </p>
              </div>
            </div>
          ) : null}
          <span className="bank-kpi-meta">
            Across {accounts.length} linked account{accounts.length === 1 ? "" : "s"} · Last updated{" "}
            {lastUpdatedLabel(accounts)}
          </span>
        </Card>
        <Card className="bank-kpi">
          <small>Income this month</small>
          <strong>{money(data.incomeThisMonth, currency)}</strong>
          <span><DeltaNote value={incomeDelta} /> vs last month</span>
        </Card>
        <Card className="bank-kpi is-expense">
          <small>Expenses this month</small>
          <strong>{money(data.spentThisMonth, currency)}</strong>
          <span><DeltaNote value={expenseDelta} invert /> vs last month</span>
        </Card>
        <Card className="bank-kpi">
          <small>Net savings</small>
          <strong className={data.netSavings < 0 ? "is-negative" : undefined}>
            {money(data.netSavings, currency)}
          </strong>
          <span><DeltaNote value={savingsDelta} /> vs last month</span>
        </Card>
        <Card className="bank-kpi">
          <small>Avg. monthly balance</small>
          <strong>{money(avgBalance, currency)}</strong>
          <span><DeltaNote value={avgDelta} /> vs last month</span>
        </Card>
      </div>

      <div className="bank-board">
        <div className="bank-board-main">
          <Card className="bank-accounts" id="bank-accounts">
            <header>
              <div>
                <h2>Your Bank Accounts</h2>
                <small>Balances, inflow and outflow for the current month.</small>
              </div>
            </header>
            {accounts.length ? (
              <>
                <div className="bank-account-table-head" aria-hidden="true">
                  <span>Account</span>
                  <span>Current balance</span>
                  <span>Monthly inflow</span>
                  <span>Monthly outflow</span>
                  <span>Last updated</span>
                  <span />
                </div>
                <ul>
                  {accounts.map((account) => (
                    <BankAccountRow
                      key={account.id}
                      account={account}
                      currency={currency}
                      primary={account.id === primaryId}
                      flow={accountMonthFlow(account.id, bankTxns)}
                      menuOpen={menuId === account.id}
                      onMenu={() => setMenuId(menuId === account.id ? null : account.id)}
                      onEdit={() => {
                        setMenuId(null);
                        setEditing(account);
                      }}
                      onAddMoney={() => {
                        setMenuId(null);
                        router.push(bankTransactionHref(account.id, "INCOME"));
                      }}
                      onRecordExpense={() => {
                        setMenuId(null);
                        router.push(bankTransactionHref(account.id, "EXPENSE"));
                      }}
                    />
                  ))}
                </ul>
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
            <button type="button" className="bank-add-link" onClick={openAddForm}>
              <Plus size={14} />
              Add New Bank Account
            </button>
          </Card>

          <Card className="bank-chart">
            <header>
              <div>
                <h2>Monthly Cash Flow</h2>
                <small>Income, expense and net savings by month.</small>
              </div>
            </header>
            <div className="bank-chart-body">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={cashFlowChart}
                    margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={16}
                    />
                    <YAxis
                      width={56}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) =>
                        new Intl.NumberFormat("en", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(Number(value) / 100)
                      }
                    />
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
                    <Bar dataKey="income" fill="#2d8455" radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="expense" fill="#e5484d" radius={[4, 4, 0, 0]} barSize={18} />
                    <Line
                      type="monotone"
                      dataKey="savings"
                      stroke="#f0f4f8"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="bank-chart-shell" aria-hidden="true" />
              )}
            </div>
            <footer className="bank-chart-foot">
              <span>
                <small>Total income</small>
                <strong>{money(data.incomeThisMonth, currency)}</strong>
              </span>
              <span>
                <small>Total expenses</small>
                <strong>{money(data.spentThisMonth, currency)}</strong>
              </span>
              <span>
                <small>Net savings</small>
                <strong className={data.netSavings < 0 ? "is-negative" : undefined}>
                  {money(data.netSavings, currency)}
                </strong>
              </span>
            </footer>
          </Card>

          <Card className="bank-actions">
            <h2>Quick Actions</h2>
            <div className="bank-actions-grid">
              <QuickAction
                icon={Banknote}
                label="Add money"
                description="Credit income to a bank account"
                onClick={() =>
                  accounts[0]
                    ? router.push(bankTransactionHref(accounts[0].id, "INCOME"))
                    : openAddForm()
                }
              />
              <QuickAction
                icon={ArrowLeftRight}
                label="Transfer entry"
                description="Record a bank transfer"
                onClick={() => router.push("/transactions?action=add")}
              />
              <QuickAction
                icon={Plus}
                label="Add bank account"
                description="Link a new bank account"
                onClick={openAddForm}
              />
              <QuickAction
                icon={Download}
                label="Download statement"
                description="Get account statement"
                onClick={handleDownload}
              />
              <QuickAction
                icon={FileText}
                label="Account summary"
                description="Detailed account report"
                onClick={handleDownload}
              />
            </div>
          </Card>
        </div>

        <div className="bank-board-side">
          <Card className="bank-side-chart">
            <header>
              <div>
                <h2>Balance trend</h2>
                <small>{balanceRange === "1M" ? "This month" : balanceRange}</small>
              </div>
              <div className="bank-trend-meta">
                <strong className={totalMinor < 0 ? "is-negative" : undefined}>
                  {hideBalance ? "••••" : money(totalMinor, currency)}
                </strong>
                <span className={balanceDelta < 0 ? "is-negative" : balanceDelta > 0 ? "is-positive" : undefined}>
                  {balanceDelta < 0 ? "↓" : balanceDelta > 0 ? "↑" : "—"} {balanceDelta}%
                </span>
              </div>
            </header>
            <div className="bank-range-tabs">
              {BALANCE_RANGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={balanceRange === item ? "is-active" : undefined}
                  onClick={() => setBalanceRange(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="bank-trend-shell">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={balanceTrend} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="bankBalanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={balanceDelta < 0 ? "var(--danger)" : "var(--primary)"}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={balanceDelta < 0 ? "var(--danger)" : "var(--primary)"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey={balanceRange === "1M" ? "label" : "label"}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip formatter={(value) => money(Number(value ?? 0), currency)} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={balanceDelta < 0 ? "var(--danger)" : "var(--primary)"}
                  fill="url(#bankBalanceFill)"
                  strokeWidth={2}
                />
                </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </Card>

          <Card className="bank-recent">
            <header>
              <div>
                <h2>Recent bank activity</h2>
                <small>Latest transactions on linked accounts.</small>
              </div>
            </header>
            {recent.length ? (
              <ul>
                {recent.map((item) => (
                  <li key={item.id}>
                    <span className="bank-txn-icon" data-tone={item.type === "INCOME" ? "in" : "out"}>
                      {item.categoryIcon ?? (item.type === "INCOME" ? "+" : "−")}
                    </span>
                    <div>
                      <strong>{item.merchant || item.categoryName || "Transaction"}</strong>
                      <small>
                        {accountLabelForTxn(item, accounts)} ·{" "}
                        {displayDateLong(item.transactionAt.slice(0, 10))}
                      </small>
                    </div>
                    <b className={item.type === "INCOME" ? "is-in" : "is-out"}>
                      {signedMoney(item.amountMinor, currency, item.type)}
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bank-empty-note">Add a transaction on a bank account to see activity here.</p>
            )}
            <Link href="/transactions" className="bank-recent-foot">
              View all transactions
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </Card>

          <Card className="bank-insights">
            <header>
              <div>
                <h2>Smart insights</h2>
                <small>Alerts and highlights for your bank accounts.</small>
              </div>
            </header>
            <ul className="bank-insight-list">
              {insights.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} className={`bank-insight-item is-${item.tone}`}>
                    <span className="bank-insight-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

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

function BankAccountRow({
  account,
  currency,
  primary,
  flow,
  menuOpen,
  onMenu,
  onEdit,
  onAddMoney,
  onRecordExpense,
}: {
  account: Account;
  currency: string;
  primary: boolean;
  flow: { inflow: number; outflow: number };
  menuOpen: boolean;
  onMenu: () => void;
  onEdit: () => void;
  onAddMoney: () => void;
  onRecordExpense: () => void;
}) {
  const label = bankLabel(account);
  const tone = bankBrandTone(label);
  const last4 = bankLast4(account.name);
  const negative = account.currentBalanceMinor < 0;

  return (
    <li className="bank-account-row">
      <div className="bank-account-ident">
        <span className={`bank-badge is-${tone}`}>{bankAbbrev(label)}</span>
        <div className="bank-account-copy">
          <strong>
            {label}
            {primary ? <span className="bank-pill">Primary</span> : null}
          </strong>
          <small>
            {bankSubtype(account)}
            {last4 ? ` · ${bankMaskDisplay(last4)}` : ""}
          </small>
        </div>
      </div>
      <div className="bank-account-stat">
        <small>Current balance</small>
        <strong className={negative ? "is-negative" : undefined}>
          {money(account.currentBalanceMinor, currency)}
        </strong>
      </div>
      <div className="bank-account-stat">
        <small>Monthly inflow</small>
        <strong>{money(flow.inflow, currency)}</strong>
      </div>
      <div className="bank-account-stat">
        <small>Monthly outflow</small>
        <strong>{money(flow.outflow, currency)}</strong>
      </div>
      <div className="bank-account-stat">
        <small>Last updated</small>
        <strong>{formatAccountUpdated(account.updatedAt)}</strong>
      </div>
      <div className="bank-account-menu">
        <button type="button" aria-label="Account options" onClick={onMenu}>
          <MoreVertical size={16} />
        </button>
        {menuOpen ? (
          <div className="bank-menu-pop">
            <button type="button" onClick={onAddMoney}>Add money</button>
            <button type="button" onClick={onRecordExpense}>Record expense</button>
            <button type="button" onClick={onEdit}>Edit account</button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="bank-quick" onClick={onClick}>
      <span><Icon size={18} /></span>
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
    </button>
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
  const [bank, setBank] = useState<string>(INDIAN_BANKS[0] ?? "HDFC Bank");
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
          <div className="bank-picker">
            {INDIAN_BANKS.map((item) => {
              const tone = bankBrandTone(item);
              const selected = bank === item;
              return (
                <button
                  key={item}
                  type="button"
                  className={`bank-picker-item${selected ? " is-selected" : ""}`}
                  onClick={() => setBank(item)}
                >
                  <span className={`bank-badge is-${tone}`}>{bankAbbrev(item)}</span>
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Account holder name" error={errors.holder}>
          <Input value={holder} onChange={(event) => setHolder(event.target.value)} placeholder="Full name" />
        </Field>
        <div className="bank-form-split">
          <Field label="Account type">
            <Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              {BANK_ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
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
            <Input value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" />
          </Field>
          <Field label="Branch name">
            <Input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="e.g. Koramangala" />
          </Field>
        </div>
        <Field label="Nickname (optional)">
          <Input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="e.g. Salary account" />
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
            <Input type="date" value={linkingDate} onChange={(event) => setLinkingDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Start tracking date">
          <Input type="date" value={trackingDate} onChange={(event) => setTrackingDate(event.target.value)} />
        </Field>
        <div className="bank-security">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            <strong>Your security is our priority.</strong> Bank details are encrypted and stored securely. We never share your data with third parties.
          </p>
        </div>
        <div className="bank-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
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

  useEffect(() => {
    if (!account) return;
    const institution = account.institutionName?.trim() ?? "";
    const [bankPart, ...branchParts] = institution.split(" · ");
    const matchedBank =
      INDIAN_BANKS.find((item) => item.toLowerCase() === (bankPart ?? "").toLowerCase()) ??
      bankPart?.trim() ??
      "HDFC Bank";
    setBank(matchedBank);
    setBranch(branchParts.join(" · ").trim());
    setAccountType(bankSubtype(account));
    setNickname(bankNickname(account));
    setOpening(String((account.openingBalanceMinor ?? 0) / 100));
    setActive(account.isActive === true || Number(account.isActive) === 1);
    setErrors({});
  }, [account]);

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
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <div className="bank-form-split">
          <Field label="Account type">
            <Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              {BANK_ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
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
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
