"use client";
import type { Account } from "@hisaab/types";
import { Button, Card } from "@hisaab/ui";
import { savingsRate } from "@hisaab/validation";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarClock,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  Plus,
  ScanLine,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { CardHead, Insight, KpiCard, ProLabel, ProgressBar } from "@/components/layout/chrome";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import {
  compactTime,
  dateTime,
  dayGroupLabel,
  greetingForHour,
  longDate,
  money,
  signedMoney,
} from "@/lib/format";
import {
  accountDisplayName,
  tidyAccountLabel,
  uniqueCatalogAccounts,
} from "@/lib/accounts";
import {
  displayCreditCards,
  displayDate,
  ipoStatusClass,
  openLends,
  returnPct,
  sumMinor,
} from "@/lib/finance-modules";
import { useFinanceModules } from "@/hooks/use-finance-modules";
import { accountService } from "@/services/account.service";
import { authService } from "@/services/auth.service";
import { dashboardService } from "@/services/dashboard.service";
import { recurringService } from "@/services/recurring.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type Recurring = {
  id: string;
  merchant: string | null;
  amountMinor: number;
  currency: string;
  nextRunAt: string;
  isActive: boolean;
};

export function DashboardView() {
  const router = useRouter();
  const { data: session } = authService.useSession();
  const [range, setRange] = useState<"week" | "month">("week");
  const [lendTab, setLendTab] = useState<"all" | "lent" | "borrowed" | "settled">("all");
  const [nowMs] = useState(() => Date.now());
  const { state: modules } = useFinanceModules();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.summary(),
  });
  const bills = useQuery({
    queryKey: ["recurring"],
    queryFn: () => recurringService.list<Recurring>(),
  });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountService.list() });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <ErrorState retry={() => void query.refetch()} />;
  const data = query.data;
  const currency = data.currency ?? "INR";
  const firstName = session?.user.name?.trim().split(/\s+/)[0];
  const rate = savingsRate(data.incomeThisMonth, data.spentThisMonth);
  const perDay =
    data.daysRemaining > 0 && data.budgetRemaining > 0
      ? Math.round(data.budgetRemaining / data.daysRemaining)
      : 0;
  const lastMonth = data.monthlyComparison.at(-2);
  const spendDelta =
    lastMonth && lastMonth.expense > 0
      ? Math.round(((data.spentThisMonth - lastMonth.expense) / lastMonth.expense) * 100)
      : 0;
  const topCategory = data.categorySpending[0];
  const upcoming = (bills.data ?? [])
    .filter((item) => item.isActive)
    .filter((item) => {
      const due = new Date(item.nextRunAt).getTime() - nowMs;
      return due >= 0 && due <= 7 * 24 * 60 * 60 * 1000;
    })
    .slice(0, 5);
  const upcomingTotal = upcoming.reduce((sum, item) => sum + item.amountMinor, 0);
  const chartData =
    range === "week"
      ? data.sevenDaySpending.map((item) => ({ label: item.date, amount: item.amount }))
      : data.monthlyComparison.map((item) => ({ label: item.month, amount: item.expense }));
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date());
  const catalog = uniqueCatalogAccounts(accounts.data ?? []);
  const totalBalance = catalog.reduce((sum, item) => sum + item.currentBalanceMinor, 0);
  const lastNet = lastMonth ? lastMonth.income - lastMonth.expense : 0;
  const saveDelta =
    lastNet !== 0 ? Math.round(((data.netSavings - lastNet) / Math.abs(lastNet)) * 100) : 0;
  const amounts = chartData.map((item) => item.amount);
  const avgSpend = amounts.length
    ? Math.round(amounts.reduce((sum, value) => sum + value, 0) / amounts.length)
    : 0;
  const peak = chartData.reduce(
    (winner, item) => (item.amount > winner.amount ? item : winner),
    chartData[0] ?? { label: "—", amount: 0 },
  );
  const firstPoint = amounts[0] ?? 0;
  const lastPoint = amounts.at(-1) ?? 0;
  const trendLabel =
    amounts.length < 2
      ? "Not enough data"
      : lastPoint > firstPoint * 1.08
        ? lastPoint > firstPoint * 1.2
          ? "Rising"
          : "Moderate rise"
        : lastPoint < firstPoint * 0.92
          ? "Falling"
          : "Steady";
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedSpend = Math.round((data.spentThisMonth / Math.max(1, dayOfMonth)) * daysInMonth);
  const secondCategory = data.categorySpending[1];
  const liveCards = catalog.filter((item) => item.type === "CREDIT_CARD");
  const cards = displayCreditCards(
    liveCards.map((item) => ({
      id: item.id,
      name: accountDisplayName(item),
      currentBalanceMinor: item.currentBalanceMinor,
    })),
    modules.cards,
  );
  const investmentValue = sumMinor(modules.investments, (item) => item.currentMinor);
  const loanOutstanding = sumMinor(modules.loans, (item) => item.outstandingMinor);
  const monthlyEmi = sumMinor(modules.loans, (item) => item.emiMinor);
  const cardUsed = sumMinor(cards, (item) => item.usedMinor);
  const cardLimit = sumMinor(cards, (item) => item.limitMinor);
  const cardToday = sumMinor(cards, (item) => item.todaySpendMinor);
  const cardOverdue = sumMinor(cards, (item) => item.overdueMinor);
  const upiUsed = sumMinor(modules.upi, (item) => item.usedMinor);
  const upiLimit = sumMinor(modules.upi, (item) => item.limitMinor);
  const upiToday = sumMinor(modules.upi, (item) => item.todaySpendMinor);
  const netWorth = totalBalance + investmentValue - loanOutstanding - cardUsed;
  const utilization = cardLimit ? Math.round((cardUsed / cardLimit) * 100) : 0;
  const health = healthScore({
    savingsRate: rate,
    budgetUsed: data.budgetTotal ? data.budgetPercentage : 68,
    utilization,
    emiBurden: data.incomeThisMonth ? Math.round((monthlyEmi / data.incomeThisMonth) * 100) : 33,
    overdueBills: cardOverdue > 0 ? 1 : 0,
  });
  const todayKey = now.toDateString();
  const todayIncome = data.recentTransactions
    .filter((item) => item.type === "INCOME" && new Date(item.transactionAt).toDateString() === todayKey)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const groupedTxns = groupTransactions(data.recentTransactions);
  const lendRows = modules.lends.filter((item) => {
    if (lendTab === "all") return true;
    if (lendTab === "settled") return item.status === "settled";
    if (lendTab === "lent") return item.kind === "lent" && item.status !== "settled";
    return item.kind === "borrowed" && item.status !== "settled";
  });
  const lentOpen = sumMinor(
    openLends(modules.lends).filter((item) => item.kind === "lent"),
    (item) => item.amountMinor,
  );
  const spendSlices = foldCategories(data.categorySpending);
  return (
    <div>
      <section className="overview-hero">
        <div>
          <div className="eyebrow">{longDate()}</div>
          <h1>
            {greetingForHour()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p>
            Your Hisaab overview is cleaner, smarter, and easier to scan. Track spending, savings,
            budgets, and key trends from one premium dashboard.
          </p>
          <div className="hero-actions">
            <Button
              variant="secondary"
              className="border-white/12 bg-white/10 text-[#f3fff7] hover:bg-white/15"
              onClick={() => toast.info("Receipt scan is a Premium feature.")}
            >
              <ScanLine size={16} aria-hidden="true" /> Scan receipt <ProLabel />
            </Button>
            <Button
              variant="secondary"
              className="border-white/12 bg-white/10 text-[#f3fff7] hover:bg-white/15"
              onClick={() => router.push("/transactions?action=add")}
            >
              <Plus size={16} aria-hidden="true" /> Add transaction
            </Button>
            <Button
              variant="ghost"
              className="text-[#f3fff7] hover:bg-white/15"
              onClick={() => router.push("/reports")}
            >
              Go to analytics <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="mb-3.5 flex items-center justify-between">
            <b className="text-[13px]">{monthLabel} snapshot</b>
            <small className="text-[#d1e7d8]">Live from your accounts</small>
          </div>
          <div className="hero-mini-grid">
            <div className="hero-mini">
              <small>Total balance</small>
              <b className="break-words">{money(totalBalance, currency)}</b>
              <span className="positive">
                {accounts.data?.length
                  ? totalBalance >= 0
                    ? "Across your accounts"
                    : "Includes credit balances"
                  : "Accounts will appear here"}
              </span>
            </div>
            <div className="hero-mini">
              <small>Monthly saving</small>
              <b className="break-words">{money(data.netSavings, currency)}</b>
              <span className="positive">
                {saveDelta
                  ? `${saveDelta > 0 ? "Up" : "Down"} ${Math.abs(saveDelta)}% vs last month`
                  : rate >= 20
                    ? "Strong savings pace"
                    : "Keep building this month"}
              </span>
            </div>
            <div className="hero-mini">
              <small>Budget left</small>
              <b>{money(data.budgetRemaining, currency)}</b>
              <span className="positive">
                {data.budgetTotal ? `${Math.round(data.budgetPercentage)}% used so far` : "Add a monthly budget"}
              </span>
            </div>
            <div className="hero-mini">
              <small>Upcoming bills</small>
              <b>{money(upcomingTotal, currency)}</b>
              <span className="positive">
                {upcoming.length ? `${upcoming.length} due in next 7 days` : "No bills in the next week"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="overview-command">
        <section className="oc-kpis">
          <KpiCard
            label="Total Balance"
            value={money(totalBalance, currency)}
            note="Across your catalog accounts."
            foot={catalog.length ? `${catalog.length} accounts` : "Add activity to see balances"}
            footNote="Live catalog"
            tone="positive"
            icon={<Wallet size={18} aria-hidden="true" />}
          />
          <KpiCard
            label="Income"
            value={money(data.incomeThisMonth, currency)}
            note="Salary and other credits this month."
            foot={data.incomeThisMonth ? "On track this month" : "Add income to see the picture"}
            footNote="Credits captured in Hisaab"
            tone="positive"
            icon={<Banknote size={18} aria-hidden="true" />}
          />
          <KpiCard
            label="Expenses"
            value={money(data.spentThisMonth, currency)}
            note="Overall spend for the current month."
            foot={
              spendDelta
                ? `${Math.abs(spendDelta)}% ${spendDelta > 0 ? "higher" : "lower"} than last month`
                : "This month so far"
            }
            footNote={topCategory ? `${topCategory.name} is a top category` : "Add expenses to compare"}
            tone={spendDelta > 0 ? "warning" : "muted"}
            icon={<ArrowDownRight size={18} aria-hidden="true" />}
          />
          <KpiCard
            label="Savings"
            value={money(data.netSavings, currency)}
            note="Income minus spending this month."
            foot={rate ? `${rate}% savings rate` : "Add income to measure"}
            footNote={saveDelta ? `${saveDelta > 0 ? "Up" : "Down"} vs last month` : "Keep building"}
            tone={rate >= 20 ? "positive" : "muted"}
            icon={<PiggyBank size={18} aria-hidden="true" />}
          />
          <KpiCard
            label="Net Worth"
            value={money(netWorth, currency)}
            note="Accounts and investments minus demo liabilities."
            foot="Includes loans and cards"
            footNote="Demo liabilities where live data is not available"
            tone={netWorth >= 0 ? "positive" : "warning"}
            icon={<TrendingUp size={18} aria-hidden="true" />}
          />
        </section>

        <section className="oc-row1">
          <Card className="oc-card">
            <CardHead
              title="Cash Flow Overview"
              description={range === "week" ? "Last 7 days" : "Recent months"}
              action={
                <div className="flex gap-1.5">
                  <ChipBtn active={range === "week"} onClick={() => setRange("week")}>
                    Week
                  </ChipBtn>
                  <ChipBtn active={range === "month"} onClick={() => setRange("month")}>
                    Month
                  </ChipBtn>
                </div>
              }
            />
            <div className="trend-stats">
              <div className="trend-stat">
                <small>Average</small>
                <b>
                  {chartData.length
                    ? `${money(avgSpend, currency)} / ${range === "week" ? "day" : "month"}`
                    : "—"}
                </b>
              </div>
              <div className="trend-stat">
                <small>Highest point</small>
                <b>
                  {chartData.length
                    ? `${trendLabelFor(peak.label, range)} · ${money(peak.amount, currency)}`
                    : "—"}
                </b>
              </div>
              <div className="trend-stat">
                <small>Trend</small>
                <b>{trendLabel}</b>
              </div>
            </div>
            <div className="h-[220px] min-w-0">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2d8455" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#2d8455" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      interval="preserveStartEnd"
                      minTickGap={16}
                      tickFormatter={(value) => trendLabelFor(String(value), range)}
                    />
                    <Tooltip
                      formatter={(value) => money(Number(value), currency)}
                      contentStyle={{
                        borderRadius: 8,
                        background: "var(--foreground)",
                        color: "var(--surface)",
                        border: 0,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="var(--primary)"
                      strokeWidth={3.3}
                      fill="url(#areaGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="grid h-full place-items-center text-sm text-[var(--muted-foreground)]">
                  Add expenses to see your trend.
                </p>
              )}
            </div>
            <div className="chart-legend-row">
              <div className="chart-legend-note">
                <span className="legend-dot" />
                <span>Hover points to see exact values and context.</span>
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)]">
                Projected month-end spend: {money(projectedSpend, currency)}
              </div>
            </div>
          </Card>

          <Card className="oc-card">
            <CardHead
              title="Spending Breakdown"
              description="Where your money went"
              action={
                <Link href="/reports" className="oc-link">
                  View full report →
                </Link>
              }
            />
            {spendSlices.length ? (
              <SpendDonut items={spendSlices} total={data.spentThisMonth} currency={currency} />
            ) : (
              <p className="py-6 text-sm text-[var(--muted-foreground)]">
                Add expenses to see where your money went.
              </p>
            )}
          </Card>

          <div className="oc-right">
            <Card className="oc-card">
              <CardHead
                title="Upcoming Reminders"
                description="Next 7 days"
                action={
                  <Link href="/recurring" className="oc-link">
                    View all
                  </Link>
                }
              />
              {upcoming.length ? (
                <div className="oc-reminders">
                  {upcoming.map((item) => (
                    <div key={item.id} className="oc-remrow">
                      <span className="oc-remicon">
                        <CalendarClock size={14} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <b>{item.merchant || "Recurring payment"}</b>
                        <small>{reminderType(item.merchant)} · {dateTime(item.nextRunAt)}</small>
                      </div>
                      <strong>{money(item.amountMinor, item.currency)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-sm text-[var(--muted-foreground)]">
                  No bills due in the next week.{" "}
                  <Link href="/recurring" className="font-semibold text-[var(--primary)]">
                    Add recurring
                  </Link>
                </p>
              )}
            </Card>
            <Card className="oc-card">
              <CardHead
                title="Financial Health Score"
                description="One snapshot across savings, spend, credit and bills"
                action={
                  <span className={`oc-status ${health.score >= 80 ? "allotted" : health.score >= 60 ? "pending" : "notallotted"}`}>
                    {health.label}
                  </span>
                }
              />
              <div className="oc-health">
                <div
                  className="oc-gauge"
                  style={{ background: `conic-gradient(var(--primary) 0 ${health.score}%, var(--muted) ${health.score}%)` }}
                >
                  <b>
                    {health.score}
                    <small>/100</small>
                  </b>
                </div>
                <div className="oc-healthlist">
                  {health.rows.map((row) => (
                    <div key={row.name} className="oc-healthrow">
                      <span>{row.name}</span>
                      <span>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="oc-features">
          <ModuleCard
            icon={<Landmark size={16} />}
            title="Accounts Overview"
            value={money(totalBalance, currency)}
            href="/accounts"
          >
            {catalog.length ? (
              catalog.slice(0, 4).map((item) => (
                <div key={item.id} className="oc-lrow">
                  <span>
                    {accountDisplayName(item)}
                    <small>{accountMeta(item)}</small>
                  </span>
                  <b>{money(item.currentBalanceMinor, item.currency)}</b>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[var(--muted-foreground)]">Your catalog accounts will appear here.</p>
            )}
          </ModuleCard>
          <ModuleCard
            icon={<LineChart size={16} />}
            title="Investments"
            value={money(investmentValue, currency)}
            href="/investments"
          >
            {modules.investments.length ? (
              modules.investments.slice(0, 4).map((item) => {
                const pct = returnPct(item.investedMinor, item.currentMinor);
                return (
                  <div key={item.id} className="oc-lrow">
                    <span>
                      {item.name}
                      <small>{item.detail || item.type}</small>
                    </span>
                    <span>
                      <b>{money(item.currentMinor, currency)}</b>{" "}
                      <span className={pct >= 0 ? "oc-pos" : "oc-neg"}>
                        {pct >= 0 ? "+" : ""}
                        {pct}%
                      </span>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-[12px] text-[var(--muted-foreground)]">Add holdings to track your portfolio.</p>
            )}
          </ModuleCard>
          <ModuleCard
            icon={<Bell size={16} />}
            title="IPO Applications"
            value={`${modules.ipos.length} tracked`}
            href="/ipo"
          >
            {modules.ipos.length ? (
              modules.ipos.slice(0, 4).map((item) => (
                <div key={item.id} className="oc-lrow">
                  <span>
                    {item.name}
                    <small>
                      {item.lots} lot{item.lots === 1 ? "" : "s"} · {displayDate(item.allotmentOn)}
                    </small>
                  </span>
                  <span>
                    <b>{money(item.amountMinor, currency)}</b>
                    <span className={`oc-status ${ipoStatusClass(item.status)}`}>{item.status}</span>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[var(--muted-foreground)]">Track IPO applications here.</p>
            )}
          </ModuleCard>
          <ModuleCard
            icon={<CalendarClock size={16} />}
            title="EMI & Loans"
            value={`${money(monthlyEmi, currency)} / mo`}
            href="/loans"
          >
            {modules.loans.length ? (
              modules.loans.map((item) => (
                <div key={item.id} className="oc-lrow">
                  <span>
                    {item.name}
                    <small>
                      {item.lender} · {item.rate} · {item.remainingEmis} left
                    </small>
                  </span>
                  <span>
                    <b>{money(item.emiMinor, currency)}</b>
                    <small>Due {displayDate(item.dueOn)}</small>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[var(--muted-foreground)]">Add a loan to track EMI here.</p>
            )}
          </ModuleCard>
        </section>

        <section className="oc-cards">
          <Card className="oc-card">
            <CardHead
              title="Credit Cards"
              description={`Total limit ${money(cardLimit, currency)}`}
              action={
                <Link href="/cards" className="oc-link">
                  View details →
                </Link>
              }
            />
            {cards.length ? (
              cards.slice(0, 1).map((card) => {
                const usedPct = card.limitMinor ? Math.round((card.usedMinor / card.limitMinor) * 100) : 0;
                return (
                  <div key={card.id} className="oc-credit">
                    <div className="oc-credit-row">
                      <span>
                        {card.name}
                        {card.mask ? ` · ${card.mask}` : ""}
                      </span>
                      <b>Limit {money(card.limitMinor, currency)}</b>
                    </div>
                    <div className="oc-credit-row">
                      <span>Used</span>
                      <b>
                        {money(card.usedMinor, currency)} ({usedPct}%)
                      </b>
                    </div>
                    <ProgressBar value={usedPct} tone={usedPct > 50 ? "warn" : "ok"} />
                    <div className="oc-credit-row">
                      <span>Daily spend today</span>
                      <b>{money(card.todaySpendMinor, currency)}</b>
                    </div>
                    {card.overdueMinor > 0 ? (
                      <div className="oc-credit-row oc-overdue">
                        <span>Overdue</span>
                        <b>{money(card.overdueMinor, currency)}</b>
                      </div>
                    ) : null}
                    <div className="oc-credit-row">
                      <span>Available · Due {displayDate(card.dueOn)}</span>
                      <b>{money(Math.max(0, card.limitMinor - card.usedMinor), currency)}</b>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[12px] text-[var(--muted-foreground)]">Add a card to track limit and due date.</p>
            )}
          </Card>
          <Card className="oc-card">
            <CardHead
              title="UPI Credit"
              description={`Total limit ${money(upiLimit, currency)}`}
              action={
                <Link href="/upi-credit" className="oc-link">
                  View details →
                </Link>
              }
            />
            <div className="oc-credit">
              {modules.upi.length ? (
                modules.upi.map((line) => {
                  const usedPct = line.limitMinor ? Math.round((line.usedMinor / line.limitMinor) * 100) : 0;
                  return (
                    <div key={line.id}>
                      <div className="oc-credit-row">
                        <span>
                          {line.name}
                          {line.mask ? ` · ${line.mask}` : ""}
                        </span>
                        <b>{money(line.usedMinor, currency)} used</b>
                      </div>
                      <ProgressBar value={usedPct} />
                    </div>
                  );
                })
              ) : (
                <p className="text-[12px] text-[var(--muted-foreground)]">Add a UPI credit line to track usage.</p>
              )}
              <div className="oc-credit-row">
                <span>Today spend</span>
                <b>{money(upiToday, currency)}</b>
              </div>
              <div className="oc-credit-row">
                <span>Available</span>
                <b>{money(Math.max(0, upiLimit - upiUsed), currency)}</b>
              </div>
            </div>
          </Card>
        </section>

        <section className="oc-bottom">
          <Card className="oc-card oc-txcard">
            <CardHead
              title="Daily Financial Pulse"
              description="Today across spend, credit and investments"
              action={
                <Link href="/transactions" className="oc-link">
                  View all
                </Link>
              }
            />
            <div className="oc-pulse">
              <PulseChip label="Today spend" value={money(data.todaySpending, currency)} tone="neg" />
              <PulseChip label="Today income" value={money(todayIncome, currency)} tone="pos" />
              <PulseChip label="Card spend" value={money(cardToday, currency)} />
              <PulseChip label="UPI credit" value={money(upiToday, currency)} />
              <PulseChip label="Investment" value={money(0, currency)} />
              <PulseChip label="Lend / borrow" value={money(0, currency)} />
              <PulseChip
                label="Safe to spend"
                value={money(perDay || data.budgetRemaining, currency)}
                tone="pos"
              />
            </div>
            <div className="oc-txhead">
              <h3>Daily Transactions</h3>
              <div className="oc-txsummary">
                <span>
                  Spent <b>{money(data.spentThisMonth, currency)}</b>
                </span>
                <span>
                  Received <b>{money(data.incomeThisMonth, currency)}</b>
                </span>
                <span>
                  Net <b>{money(data.netSavings, currency)}</b>
                </span>
              </div>
            </div>
            {groupedTxns.length ? (
              groupedTxns.map((group) => (
                <div key={group.label} className="oc-dateblock">
                  <div className="oc-datetitle">
                    {group.label} ({group.items.length})
                  </div>
                  {group.items.map((item) => (
                    <div key={item.id} className="oc-txrow">
                      <span>{compactTime(item.transactionAt)}</span>
                      <b>{item.merchant || item.categoryName || "Transaction"}</b>
                      <span>{item.categoryName || "—"}</span>
                      <span>{tidyAccountLabel(item.accountName)}</span>
                      <b className={item.type === "INCOME" ? "oc-pos oc-align-r" : "oc-neg oc-align-r"}>
                        {signedMoney(item.amountMinor, item.currency, item.type)}
                      </b>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="py-6 text-sm text-[var(--muted-foreground)]">Your transactions will appear here.</p>
            )}
          </Card>

          <Card className="oc-card">
            <CardHead
              title="Borrow / Lend"
              action={
                <Link href="/lend" className="oc-link">
                  View all
                </Link>
              }
            />
            <div className="oc-borrowtabs">
              {(["all", "lent", "borrowed", "settled"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={lendTab === tab ? "active" : undefined}
                  onClick={() => setLendTab(tab)}
                >
                  {tab[0]!.toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {lendRows.length ? (
              lendRows.slice(0, 4).map((item) => (
                <div key={item.id} className="oc-person">
                  <span className="oc-pav">{item.person.slice(0, 1)}</span>
                  <div className="min-w-0">
                    <b>{item.person}</b>
                    <small>
                      {item.kind === "lent" ? "Lent" : "Borrowed"} {displayDate(item.givenOn)} · Due{" "}
                      {displayDate(item.dueOn)}
                    </small>
                  </div>
                  <b className={item.kind === "lent" ? "oc-pos" : "oc-neg"}>
                    {item.status === "settled" ? money(0, currency) : money(item.amountMinor, currency)}
                  </b>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-[var(--muted-foreground)]">No records in this tab.</p>
            )}
          </Card>

          <Card className="oc-card">
            <CardHead title="Top Insights for You" />
            <div className="oc-insights">
              <Insight
                icon={<ArrowUpRight size={16} />}
                title={topCategory ? `${topCategory.name} spend is high` : "Start tracking"}
                body={
                  topCategory
                    ? `You spent ${money(topCategory.value, currency)} on ${topCategory.name} this month.`
                    : "Add a few expenses to unlock useful observations."
                }
              />
              <Insight
                gold
                icon={<PiggyBank size={16} />}
                title={rate >= 20 ? "You’re on track" : "Room to save"}
                body={
                  rate >= 20
                    ? "At this pace, your savings can grow faster than last month."
                    : "A small weekly cut in your top category can lift your savings rate."
                }
              />
              <Insight
                icon={<CreditCard size={16} />}
                title={utilization ? `Cards at ${utilization}% utilization` : "Credit is quiet"}
                body={
                  cardOverdue
                    ? `${money(cardOverdue, currency)} is overdue on your cards. Pay that first.`
                    : `${money(cardUsed, currency)} used of ${money(cardLimit, currency)} limit.`
                }
              />
              <Insight
                icon={<Bell size={16} />}
                title={upcoming.length ? "Bills coming up" : secondCategory ? `${secondCategory.name} is stable` : "Keep logging"}
                body={
                  upcoming.length
                    ? `${upcoming.length} recurring payment${upcoming.length === 1 ? "" : "s"} due in the next 7 days. EMI due ${money(monthlyEmi, currency)} this cycle. Lent outstanding ${money(lentOpen, currency)}.`
                    : secondCategory
                      ? `${secondCategory.name} is ${money(secondCategory.value, currency)} this month.`
                      : "Add more transactions this week to sharpen your insights."
                }
              />
            </div>
            <div className="mt-3 text-center">
              <Link href="/coach" className="oc-link">
                Chat with AI Coach →
              </Link>
            </div>
          </Card>

          <Card className="oc-card">
            <CardHead title="Quick Actions" />
            <div className="oc-actions">
              <Link href="/transactions?action=add" className="oc-action">
                <Plus size={16} /> Add Transaction
              </Link>
              <Link href="/investments" className="oc-action">
                <TrendingUp size={16} /> Add Investment
              </Link>
              <Link href="/recurring" className="oc-action">
                <Bell size={16} /> Add Bill Reminder
              </Link>
              <Link href="/budgets" className="oc-action">
                <Wallet size={16} /> Set Budget
              </Link>
              <Link href="/reports" className="oc-action">
                <LineChart size={16} /> View Reports
              </Link>
              <Link href="/settings" className="oc-action">
                <Smartphone size={16} /> Settings
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  value,
  href,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Card className="oc-card oc-feature">
      <div className="oc-featuretop">
        <span className="oc-iconbox">{icon}</span>
        <div className="min-w-0">
          <h3>{title}</h3>
          <div className="oc-featurebig">{value}</div>
        </div>
      </div>
      <div className="oc-list">{children}</div>
      <div className="oc-feature-links">
        <Link href={href} className="oc-link">
          View all →
        </Link>
      </div>
    </Card>
  );
}

function PulseChip({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="oc-pulseitem">
      <small>{label}</small>
      <b className={tone === "pos" ? "oc-pos" : tone === "neg" ? "oc-neg" : undefined}>{value}</b>
    </div>
  );
}

function donutGradient(
  items: Array<{ name: string; value: number; colour: string }>,
  total: number,
) {
  const palette = ["#22a95f", "#62a46e", "#ffad5e", "#ff663f", "#888888", "#c5cdc8"];
  const stops: string[] = [];
  let start = 0;
  for (const [index, item] of items.entries()) {
    const pct = total ? (item.value / total) * 100 : 0;
    const end = start + pct;
    stops.push(`${item.colour || palette[index] || "#c5cdc8"} ${start}% ${end}%`);
    start = end;
  }
  if (start < 99.5) stops.push(`var(--muted) ${start}% 100%`);
  return stops.join(",");
}

function SpendDonut({
  items,
  total,
  currency,
}: {
  items: Array<{ name: string; value: number; colour: string }>;
  total: number;
  currency: string;
}) {
  const palette = ["#22a95f", "#62a46e", "#ffad5e", "#ff663f", "#888888", "#c5cdc8"];
  return (
    <div className="oc-spendwrap">
      <div className="oc-donut" style={{ background: `conic-gradient(${donutGradient(items, total)})` }}>
        <div className="oc-donut-center">
          Total
          <b>{money(total, currency)}</b>
        </div>
      </div>
      <div className="oc-spendlist">
        {items.map((item, index) => {
          const pct = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.name} className="oc-spendrow">
              <span>
                <i className="oc-dot" style={{ background: item.colour || palette[index] }} />
                {item.name}
              </span>
              <b>{pct}%</b>
              <b>{money(item.value, currency)}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function foldCategories(items: Array<{ name: string; value: number; colour: string }>) {
  const top = items.slice(0, 5);
  const rest = items.slice(5);
  const others = rest.reduce((sum, item) => sum + item.value, 0);
  return others ? [...top, { name: "Others", value: others, colour: "#c5cdc8" }] : top;
}

function groupTransactions(items: Array<{
  id: string;
  type: "INCOME" | "EXPENSE";
  amountMinor: number;
  currency: string;
  merchant: string | null;
  categoryName?: string;
  accountName?: string;
  transactionAt: string;
}>) {
  const groups: Array<{ label: string; items: typeof items }> = [];
  for (const item of items.slice(0, 10)) {
    const label = dayGroupLabel(item.transactionAt);
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function reminderType(merchant: string | null) {
  const text = (merchant ?? "").toLowerCase();
  if (text.includes("emi") || text.includes("loan")) return "EMI";
  if (text.includes("rent")) return "Rent";
  if (text.includes("netflix") || text.includes("spotify") || text.includes("prime") || text.includes("subscription")) {
    return "Subscription";
  }
  if (text.includes("card") || text.includes("credit")) return "Credit";
  return "Bill";
}

function accountMeta(account: Account) {
  const type = account.type.replaceAll("_", " ").toLowerCase();
  return `${type[0]!.toUpperCase()}${type.slice(1)}`;
}

function healthScore({
  savingsRate: rate,
  budgetUsed,
  utilization,
  emiBurden,
  overdueBills,
}: {
  savingsRate: number;
  budgetUsed: number;
  utilization: number;
  emiBurden: number;
  overdueBills: number;
}) {
  const savings = rate >= 20 ? 90 : rate >= 10 ? 70 : 45;
  const expense = budgetUsed <= 80 ? 90 : budgetUsed <= 100 ? 70 : 40;
  const credit = utilization <= 30 ? 95 : utilization <= 50 ? 70 : 45;
  const debt = emiBurden <= 30 ? 90 : emiBurden <= 45 ? 70 : 45;
  const emergency = rate >= 20 ? 80 : 60;
  const invest = 78;
  const bills = overdueBills ? 55 : 92;
  const score = Math.round((savings + expense + credit + debt + emergency + invest + bills) / 7);
  return {
    score,
    label: score >= 80 ? "Excellent" : score >= 65 ? "Good" : "Needs work",
    rows: [
      { name: "Savings rate", value: `${rate}% · ${rate >= 20 ? "Good" : "Watch"}` },
      { name: "Expense control", value: `${Math.round(budgetUsed)}% · ${budgetUsed <= 80 ? "Excellent" : "Watch"}` },
      { name: "Credit utilization", value: `${utilization}% · ${utilization <= 30 ? "Good" : "Watch"}` },
      { name: "Debt management", value: `${emiBurden}% · ${emiBurden <= 30 ? "Good" : "Watch"}` },
      { name: "Emergency fund", value: rate >= 20 ? "On track" : "Build more" },
      { name: "Investment consistency", value: "SIP on track" },
      { name: "Bill payment discipline", value: overdueBills ? `${overdueBills} overdue` : "On time" },
    ],
  };
}

function trendLabelFor(value: string, range: "week" | "month") {
  const date = new Date(range === "week" ? value : `${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return range === "week"
    ? new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date)
    : new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date);
}

function ChipBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full border px-[13px] py-2 text-[11px] font-bold ${
        active
          ? "border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] bg-[var(--mint)] text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--muted-foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
