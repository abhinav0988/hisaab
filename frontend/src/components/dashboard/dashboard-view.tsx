"use client";
import type { Transaction } from "@hisaab/types";
import { creditSummary, savingsRate } from "@hisaab/validation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  Plus,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import {
  compactTime,
  greetingForHour,
  localDateKey,
  money,
  signedMoney,
} from "@/lib/format";
import { uniqueCatalogAccounts } from "@/lib/accounts";
import {
  bankAbbrev,
  bankLabel,
  bankLast4,
  bankMaskDisplay,
  bankSubtype,
} from "@/lib/bank";
import {
  displayCreditCards,
  displayDate,
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
import { useState } from "react";

type Recurring = {
  id: string;
  merchant: string | null;
  amountMinor: number;
  currency: string;
  nextRunAt: string;
  isActive: boolean;
};

type ActivityFilter = "all" | "income" | "expense" | "card";

export function DashboardView() {
  const { data: session } = authService.useSession();
  const [lendTab, setLendTab] = useState<"all" | "lent" | "borrowed" | "settled">("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [dashSearch, setDashSearch] = useState("");
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
  const banks = useQuery({ queryKey: ["bank-accounts"], queryFn: () => accountService.listBanks() });
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
  const thisMonthCmp = data.monthlyComparison.at(-1);
  const spendDelta = pctChange(data.spentThisMonth, lastMonth?.expense ?? 0);
  const incomeDelta = pctChange(data.incomeThisMonth, lastMonth?.income ?? 0);
  const lastNet = lastMonth ? lastMonth.income - lastMonth.expense : 0;
  const saveDelta = pctChange(data.netSavings, lastNet);
  const topCategory = data.categorySpending[0];
  const upcoming = (bills.data ?? [])
    .filter((item) => item.isActive)
    .filter((item) => {
      const due = new Date(item.nextRunAt).getTime() - nowMs;
      return due >= 0 && due <= 7 * 24 * 60 * 60 * 1000;
    })
    .slice(0, 5);
  const upcomingTotal = upcoming.reduce((sum, item) => sum + item.amountMinor, 0);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date());
  const catalog = uniqueCatalogAccounts(accounts.data ?? []);
  const totalBalance = catalog.reduce((sum, item) => sum + item.currentBalanceMinor, 0);
  const bankRows = banks.data?.length
    ? banks.data
    : catalog.filter((item) => item.type === "BANK");
  const cashBalance = catalog
    .filter((item) => item.type === "CASH")
    .reduce((sum, item) => sum + item.currentBalanceMinor, 0);
  const liveCards = catalog.filter((item) => item.type === "CREDIT_CARD");
  const cards = displayCreditCards(
    liveCards.map((item) => ({
      id: item.id,
      name: item.name,
      currentBalanceMinor: item.currentBalanceMinor,
    })),
    modules.cards,
  );
  const investmentValue = sumMinor(modules.investments, (item) => item.currentMinor);
  const investedCost = sumMinor(modules.investments, (item) => item.investedMinor);
  const investmentGain = investmentValue - investedCost;
  const monthlySip = sumMinor(modules.investments, (item) => item.sipMinor ?? 0);
  const loanOutstanding = sumMinor(modules.loans, (item) => item.outstandingMinor);
  const monthlyEmi = sumMinor(modules.loans, (item) => item.emiMinor);
  const cardUsed = sumMinor(cards, (item) => item.usedMinor);
  const cardLimit = sumMinor(cards, (item) => item.limitMinor);
  const cardToday = sumMinor(cards, (item) => item.todaySpendMinor);
  const cardOverdue = sumMinor(cards, (item) => item.overdueMinor);
  const upiUsed = sumMinor(modules.upi, (item) => item.usedMinor);
  const upiLimit = sumMinor(modules.upi, (item) => item.limitMinor);
  const netWorth = totalBalance + investmentValue - loanOutstanding - cardUsed;
  const utilization = cardLimit ? Math.round((cardUsed / cardLimit) * 100) : 0;
  const emiBurden = data.incomeThisMonth
    ? Math.round((monthlyEmi / data.incomeThisMonth) * 100)
    : 0;
  const health = healthScore({
    savingsRate: rate,
    budgetUsed: data.budgetTotal ? data.budgetPercentage : 68,
    utilization,
    emiBurden: data.incomeThisMonth ? emiBurden : 33,
    overdueBills: cardOverdue > 0 ? 1 : 0,
  });
  const week = buildWeekSeries(data.sevenDaySpending);
  const received7 = week.reduce((sum, day) => sum + day.received, 0);
  const spent7 = week.reduce((sum, day) => sum + day.spent, 0);
  const net7 = received7 - spent7;
  const avgDailySpend = Math.round(spent7 / Math.max(week.length, 1));
  const weekRangeLabel = formatWeekRange(week);
  const peakReceived = week.reduce(
    (winner, day) => (day.received > winner.received ? day : winner),
    week[0] ?? { date: "", label: "—", received: 0, spent: 0 },
  );
  const bestFlow = week.reduce(
    (winner, day) => (day.received - day.spent > winner.received - winner.spent ? day : winner),
    week[0] ?? { date: "", label: "—", received: 0, spent: 0 },
  );
  const now = new Date();
  const todayKey = localDateKey(now);
  const todayIncome = data.recentTransactions
    .filter((item) => item.type === "INCOME" && localDateKey(item.transactionAt) === todayKey)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const todayTxns = data.recentTransactions.filter(
    (item) => localDateKey(item.transactionAt) === todayKey,
  );
  const search = dashSearch.trim().toLowerCase();
  const activityRows = data.recentTransactions.filter((item) => {
    if (activityFilter === "income" && item.type !== "INCOME") return false;
    if (activityFilter === "expense" && item.type !== "EXPENSE") return false;
    if (activityFilter === "card" && !isCardTxn(item)) return false;
    if (!search) return true;
    const hay = `${item.merchant ?? ""} ${item.categoryName ?? ""} ${item.accountName ?? ""}`.toLowerCase();
    return hay.includes(search);
  });
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
  const borrowedOpen = sumMinor(
    openLends(modules.lends).filter((item) => item.kind === "borrowed"),
    (item) => item.amountMinor,
  );
  const spendSlices = foldCategories(data.categorySpending);
  const ipoAmount = sumMinor(modules.ipos, (item) => item.amountMinor);
  const allottedCount = modules.ipos.filter((item) => item.status === "Allotted").length;
  const appliedCount = modules.ipos.filter((item) => item.status === "Applied" || item.status === "In progress").length;
  const nextLoanDue = modules.loans
    .map((item) => item.dueOn)
    .filter(Boolean)
    .sort()[0];
  const incomeSpark = data.monthlyComparison.map((item) => item.income);
  const expenseSpark = data.monthlyComparison.map((item) => item.expense);
  const netSpark = data.monthlyComparison.map((item) => item.income - item.expense);
  const balanceSpark = week.map((day) => Math.max(0, day.received - day.spent + 1));
  const featuredCard = cards[0];
  const featuredUsedPct = featuredCard?.limitMinor
    ? Math.round((featuredCard.usedMinor / featuredCard.limitMinor) * 100)
    : utilization;

  return (
    <div className="premium-dash">
      <section className="pd-greeting">
        <div>
          <h2>
            {greetingForHour()}
            {firstName ? `, ${firstName}` : ""} 👋
          </h2>
          <p>Your money command center — balances, spending, bills, credit and wealth in one view.</p>
        </div>
        <div className="pd-greeting-actions">
          <div className="pd-status-pill">
            <i />
            {catalog.length ? `${catalog.length} accounts live` : "Add accounts to sync"}
          </div>
          <label className="pd-search">
            <Search size={14} aria-hidden="true" />
            <input
              value={dashSearch}
              onChange={(event) => setDashSearch(event.target.value)}
              placeholder="Search anything…"
              aria-label="Search recent activity"
            />
            <span className="key">Ctrl /</span>
          </label>
        </div>
      </section>

      <section className="pd-kpis">
        <article className="pd-kpi featured">
          <span className="pd-kpi-sub">{catalog.length ? `${catalog.length} accounts` : "Catalog"}</span>
          <div className="pd-kpi-top">
            <span className="pd-kpi-ico">
              <Landmark size={17} />
            </span>
            Total Balance
          </div>
          <div className="pd-kpi-value">{money(totalBalance, currency)}</div>
          <div className="pd-kpi-foot">
            {trendSpan(saveDelta)} across your accounts
          </div>
          <PdSpark values={balanceSpark.length ? balanceSpark : [1, 1]} color="#24d27b" />
        </article>
        <article className="pd-kpi">
          <span className="pd-kpi-sub">{monthLabel}</span>
          <div className="pd-kpi-top">
            <span className="pd-kpi-ico">
              <TrendingUp size={17} />
            </span>
            Total Income
          </div>
          <div className="pd-kpi-value">{money(data.incomeThisMonth, currency)}</div>
          <div className="pd-kpi-foot">{trendSpan(incomeDelta)} from last month</div>
          <PdSpark values={incomeSpark.length ? incomeSpark : [0]} color="#22c96e" />
        </article>
        <article className="pd-kpi red">
          <span className="pd-kpi-sub">{monthLabel}</span>
          <div className="pd-kpi-top">
            <span className="pd-kpi-ico">
              <ArrowDownRight size={17} />
            </span>
            Total Expenses
          </div>
          <div className="pd-kpi-value">{money(data.spentThisMonth, currency)}</div>
          <div className="pd-kpi-foot">{trendSpan(spendDelta, true)} from last month</div>
          <PdSpark values={expenseSpark.length ? expenseSpark : [0]} color="#ff5d5d" />
        </article>
        <article className="pd-kpi blue">
          <span className="pd-kpi-sub">Assets − debt</span>
          <div className="pd-kpi-top">
            <span className="pd-kpi-ico">
              <LineChart size={17} />
            </span>
            Net Worth
          </div>
          <div className="pd-kpi-value">{money(netWorth, currency)}</div>
          <div className="pd-kpi-foot">{trendSpan(saveDelta)} vs last month net</div>
          <PdSpark values={netSpark.length ? netSpark : [0]} color="#3a83ff" />
        </article>
      </section>

      <section className="pd-week">
        <div className="pd-section-title">
          <div>
            <h3>Last 7 Days Summary</h3>
            <p>{weekRangeLabel} · compared with this month’s pace</p>
          </div>
          <span className="badge ok">Live cash flow</span>
        </div>
        <div className="pd-week-grid">
          <div className="pd-week-stat in">
            <div className="lbl">Total Received</div>
            <div className="num">{money(received7, currency)}</div>
            <div className="meta">Income recorded in the last 7 days</div>
            <MiniTrend values={week.map((day) => day.received)} tone="in" />
          </div>
          <div className="pd-week-stat out">
            <div className="lbl">Total Spent</div>
            <div className="num">{money(spent7, currency)}</div>
            <div className="meta">Expenses recorded in the last 7 days</div>
            <MiniTrend values={week.map((day) => day.spent)} tone="out" />
          </div>
          <div className="pd-week-stat net">
            <div className="lbl">Net Cash Flow</div>
            <div className="num">{money(net7, currency)}</div>
            <div className="meta">{net7 >= 0 ? "Positive week so far" : "Spending ahead of inflows"}</div>
            <MiniTrend values={week.map((day) => Math.max(0, day.received - day.spent))} tone="in" />
          </div>
          <div className="pd-week-stat">
            <div className="lbl">Average Daily Spend</div>
            <div className="num">{money(avgDailySpend, currency)}</div>
            <div className="meta">
              {thisMonthCmp
                ? `Month spend ${money(data.spentThisMonth, currency)}`
                : "Add expenses to compare"}
            </div>
            <MiniTrend values={week.map((day) => day.spent)} tone="out" />
          </div>
        </div>
      </section>

      <section className="pd-main-grid">
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Cash Flow — Received vs Spent</h3>
              <p>Daily inflow and outflow with exact hover values</p>
            </div>
            <span className="pd-select">Last 7 Days</span>
          </div>
          <PdFlowChart days={week} currency={currency} />
          <div className="pd-legend">
            <span>
              <i className="g" /> Received
            </span>
            <span>
              <i className="r" /> Spent
            </span>
          </div>
          <div className="pd-flow-bottom">
            <div className="pd-flow-note">
              <span className="bubble">
                <TrendingUp size={16} />
              </span>
              <div>
                <span>Highest received</span>
                <b>
                  {peakReceived.received
                    ? `${money(peakReceived.received, currency)} on ${formatShortDay(peakReceived.date)}`
                    : "No inflows this week"}
                </b>
              </div>
            </div>
            <div className="pd-flow-note">
              <span className="bubble">
                <PiggyBank size={16} />
              </span>
              <div>
                <span>Best cash-flow day</span>
                <b>
                  {week.some((day) => day.received || day.spent)
                    ? `${money(bestFlow.received - bestFlow.spent, currency)} on ${formatShortDay(bestFlow.date)}`
                    : "Add activity to compare days"}
                </b>
              </div>
            </div>
          </div>
        </div>
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Spending Breakdown</h3>
              <p>Where your money went this month</p>
            </div>
            <span className="pd-select">This Month</span>
          </div>
          {spendSlices.length ? (
            <div className="pd-donut-wrap">
              <div
                className="pd-donut"
                style={{ background: `conic-gradient(${donutGradient(spendSlices, data.spentThisMonth)})` }}
              >
                <div className="pd-donut-center">
                  <div>
                    <b>{money(data.spentThisMonth, currency)}</b>
                    Total Spent
                  </div>
                </div>
              </div>
              <div className="pd-break-list">
                {spendSlices.map((item, index) => {
                  const pct = data.spentThisMonth
                    ? Math.round((item.value / data.spentThisMonth) * 100)
                    : 0;
                  return (
                    <div key={item.name} className="pd-break-row">
                      <span>
                        <i
                          className="pd-dot"
                          style={{ background: item.colour || DONUT_PALETTE[index] }}
                        />
                        {item.name}
                      </span>
                      <em>{pct}%</em>
                      <b>{money(item.value, currency)}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="pd-empty">Add expenses to see where your money went.</p>
          )}
          <Link href="/reports" className="pd-full-btn">
            View detailed spending report →
          </Link>
        </div>
      </section>

      <section className="pd-lower-grid">
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Bank Accounts</h3>
              <p>Balances and account-level movement</p>
            </div>
            <Link href="/bank" className="pd-link">
              View All
            </Link>
          </div>
          <div className="pd-banks">
            {bankRows.length ? (
              bankRows.slice(0, 4).map((account) => {
                const label = bankLabel(account);
                const flow = bankFlow(account.id, data.recentTransactions);
                return (
                  <div key={account.id} className="pd-bank-row">
                    <div className={`pd-bank-logo ${bankLogoClass(label)}`}>{bankAbbrev(label).slice(0, 1)}</div>
                    <div>
                      <b>{label}</b>
                      <small>
                        {bankSubtype(account)} · {bankMaskDisplay(bankLast4(account.name))}
                      </small>
                      <div className="pd-bank-flow">
                        <span className="in">+{money(flow.in, currency)} in</span>
                        <span className="out">−{money(flow.out, currency)} out</span>
                      </div>
                    </div>
                    <div className="pd-bank-bal">
                      <b>{money(account.currentBalanceMinor, account.currency)}</b>
                      <small>Available</small>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="pd-empty">
                Add a bank account to see balances here.{" "}
                <Link href="/bank">Open Bank</Link>
              </p>
            )}
          </div>
        </div>

        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest money movement across accounts</p>
            </div>
            <Link href="/transactions" className="pd-link">
              View All
            </Link>
          </div>
          <div className="pd-activity-filter">
            {(["all", "income", "expense", "card"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={activityFilter === filter ? "active" : undefined}
                onClick={() => setActivityFilter(filter)}
              >
                {filter[0]!.toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          <div className="pd-activity">
            {activityRows.length ? (
              activityRows.slice(0, 6).map((item) => (
                <div key={item.id} className="pd-activity-row">
                  <div className={`pd-act-ico ${activityTone(item)}`}>{activityIcon(item)}</div>
                  <div>
                    <b>{item.merchant || item.categoryName || "Transaction"}</b>
                    <small>
                      {[item.categoryName, item.accountName, compactTime(item.transactionAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                  <div className={`pd-activity-amt ${item.type === "INCOME" ? "in" : "out"}`}>
                    {signedMoney(item.amountMinor, item.currency, item.type)}
                  </div>
                </div>
              ))
            ) : (
              <p className="pd-empty">No matching activity yet.</p>
            )}
          </div>
        </div>

        <div className="pd-right-stack">
          <div className="pd-card">
            <div className="pd-head">
              <div>
                <h3>Upcoming Bills</h3>
                <p>
                  Next 7 days · {upcoming.length ? money(upcomingTotal, currency) : "nothing"} due
                </p>
              </div>
              <Link href="/recurring" className="pd-link">
                View All
              </Link>
            </div>
            <div className="pd-bills">
              {upcoming.length ? (
                upcoming.map((item) => {
                  const days = daysUntil(item.nextRunAt, nowMs);
                  return (
                    <div key={item.id} className="pd-bill-row">
                      <div className={`pd-bill-ico ${billTone(item.merchant)}`}>
                        <CalendarClock size={16} />
                      </div>
                      <div>
                        <b>{item.merchant || "Recurring payment"}</b>
                        <small>{reminderType(item.merchant)}</small>
                      </div>
                      <div className={`pd-due-badge ${days <= 2 ? "soon" : ""}`}>
                        {days} day{days === 1 ? "" : "s"}
                      </div>
                      <div className="pd-bill-amt">{money(item.amountMinor, item.currency)}</div>
                    </div>
                  );
                })
              ) : (
                <p className="pd-empty">
                  No bills due in the next week. <Link href="/recurring">Add recurring</Link>
                </p>
              )}
            </div>
          </div>
          <div className="pd-card">
            <div className="pd-head">
              <div>
                <h3>Financial Health Score</h3>
                <p>One score across savings, spending, debt and bills</p>
              </div>
              <span className={`badge ${health.score >= 65 ? "ok" : "warn"}`}>{health.label}</span>
            </div>
            <div className="pd-health">
              <div
                className="pd-health-ring"
                style={{
                  background: `conic-gradient(var(--success) 0 ${health.score}%, var(--muted) ${health.score}%)`,
                }}
              >
                <b>
                  {health.score}
                  <small>/100</small>
                </b>
              </div>
              <div className="pd-health-copy">
                {rate >= 20
                  ? "Strong overall. Keep this savings pace and watch the top spend category."
                  : "Biggest opportunity is lifting your savings rate and trimming the top category."}
              </div>
              <div className="pd-health-list">
                <div>
                  <span>Spending</span>
                  <b className={data.budgetPercentage <= 80 ? "good" : "watch"}>
                    {data.budgetPercentage <= 80 ? "Good" : "Watch"}
                  </b>
                </div>
                <div>
                  <span>Savings</span>
                  <b className={rate >= 20 ? "good" : "watch"}>{rate >= 20 ? "Excellent" : "Watch"}</b>
                </div>
                <div>
                  <span>Credit</span>
                  <b className={utilization <= 30 ? "good" : "watch"}>
                    {utilization <= 30 ? "Healthy" : "Watch"}
                  </b>
                </div>
                <div>
                  <span>Debt</span>
                  <b className={emiBurden <= 30 ? "good" : "watch"}>{emiBurden <= 30 ? "Good" : "Watch"}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="pd-section-band">
        <div>
          <h3>Wealth & Commitments</h3>
          <p>Portfolio, debt, credit and account health at a glance</p>
        </div>
        <Link href="/accounts" className="pd-link">
          Explore all finance tools →
        </Link>
      </div>
      <section className="pd-modules">
        <div className="pd-module">
          <div className="mh">
            <span className="icon g">
              <Landmark size={18} />
            </span>
            <div>
              <h4>Accounts Overview</h4>
              <small>Cash, bank, UPI & wallet</small>
            </div>
          </div>
          <div className="big">{money(totalBalance, currency)}</div>
          <div className="pd-mini-list">
            <div className="rowx">
              <span>Bank</span>
              <b>{money(sumMinor(bankRows, (item) => item.currentBalanceMinor), currency)}</b>
            </div>
            <div className="rowx">
              <span>Cash</span>
              <b>{money(cashBalance, currency)}</b>
            </div>
          </div>
          <div className="pd-module-action">
            <span>{catalog.length ? `${catalog.length} active accounts` : "No accounts yet"}</span>
            <Link href="/accounts">
              <b>View →</b>
            </Link>
          </div>
        </div>
        <div className="pd-module">
          <div className="mh">
            <span className="icon g">
              <TrendingUp size={18} />
            </span>
            <div>
              <h4>Investments</h4>
              <small>Portfolio & SIPs</small>
            </div>
          </div>
          <div className="big">{money(investmentValue, currency)}</div>
          <div className="pd-mini-list">
            <div className="rowx">
              <span>Total gain</span>
              <b className={investmentGain >= 0 ? "up" : "down"}>
                {investmentGain >= 0 ? "+" : ""}
                {money(investmentGain, currency)}
              </b>
            </div>
            <div className="rowx">
              <span>Monthly SIP</span>
              <b>{money(monthlySip, currency)}</b>
            </div>
          </div>
          <div className="pd-module-action">
            <span>
              {investedCost
                ? `${returnPct(investedCost, investmentValue)}% total gain`
                : "Add holdings"}
            </span>
            <Link href="/investments">
              <b>View →</b>
            </Link>
          </div>
        </div>
        <div className="pd-module">
          <div className="mh">
            <span className="icon o">
              <Bell size={18} />
            </span>
            <div>
              <h4>IPO Applications</h4>
              <small>{modules.ipos.length} applications tracked</small>
            </div>
          </div>
          <div className="big">{money(ipoAmount, currency)}</div>
          <div className="pd-mini-list">
            <div className="rowx">
              <span>Allotted</span>
              <b className="up">{allottedCount}</b>
            </div>
            <div className="rowx">
              <span>Applied</span>
              <b>{appliedCount || modules.ipos.length}</b>
            </div>
          </div>
          <div className="pd-module-action">
            <span>
              {modules.ipos.filter((item) => item.status === "Not Allotted").length} not allotted
            </span>
            <Link href="/ipo">
              <b>Track →</b>
            </Link>
          </div>
        </div>
        <div className="pd-module">
          <div className="mh">
            <span className="icon r">
              <CalendarClock size={18} />
            </span>
            <div>
              <h4>EMI & Loans</h4>
              <small>Monthly commitment</small>
            </div>
          </div>
          <div className="big">{money(monthlyEmi, currency)} / mo</div>
          <div className="pd-mini-list">
            {modules.loans.length ? (
              modules.loans.slice(0, 2).map((item) => (
                <div key={item.id} className="rowx">
                  <span>{item.name}</span>
                  <b>{money(item.emiMinor, currency)}</b>
                </div>
              ))
            ) : (
              <div className="rowx">
                <span>Outstanding</span>
                <b>{money(loanOutstanding, currency)}</b>
              </div>
            )}
          </div>
          <div className="pd-module-action">
            <span>{nextLoanDue ? `Next due ${displayDate(nextLoanDue)}` : "Add a loan"}</span>
            <Link href="/loans">
              <b>Manage →</b>
            </Link>
          </div>
        </div>
      </section>

      <section className="pd-wide-mods">
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Credit Cards</h3>
              <p>Utilisation, available credit and next due</p>
            </div>
            <Link href="/cards" className="pd-link">
              View details →
            </Link>
          </div>
          {featuredCard ? (
            <>
              <div className="pd-credit-visual">
                <div className="rowx">
                  <span>
                    {featuredCard.name}
                    {featuredCard.mask ? ` · ${featuredCard.mask}` : ""}
                  </span>
                  <b>{money(featuredCard.limitMinor, currency)} limit</b>
                </div>
                <div className="mutedx">
                  {featuredUsedPct}% utilisation · {featuredUsedPct <= 30 ? "healthy range" : "watch usage"}
                </div>
                <div className="pd-creditbar">
                  <span style={{ width: `${Math.min(featuredUsedPct, 100)}%` }} />
                </div>
              </div>
              <div className="pd-mini-list">
                <div className="rowx">
                  <span>Used</span>
                  <b>{money(featuredCard.usedMinor, currency)}</b>
                </div>
                <div className="rowx">
                  <span>Available</span>
                  <b className="up">{money(creditSummary(featuredCard).availableMinor, currency)}</b>
                </div>
                <div className="rowx">
                  <span>Payment due</span>
                  <b>{displayDate(featuredCard.dueOn)}</b>
                </div>
              </div>
            </>
          ) : (
            <p className="pd-empty">Add a card to track limit and due date.</p>
          )}
        </div>
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>UPI Credit</h3>
              <p>Pay-later usage and available limit</p>
            </div>
            <Link href="/upi-credit" className="pd-link">
              View details →
            </Link>
          </div>
          <div className="pd-mini-list">
            <div className="rowx">
              <span>Total limit</span>
              <b>{money(upiLimit, currency)}</b>
            </div>
            <div className="rowx">
              <span>Used</span>
              <b>{money(upiUsed, currency)}</b>
            </div>
            <div className="rowx">
              <span>Available</span>
              <b className="up">{money(Math.max(0, upiLimit - upiUsed), currency)}</b>
            </div>
            <div className="rowx">
              <span>Utilisation</span>
              <b>{upiLimit ? Math.round((upiUsed / upiLimit) * 100) : 0}%</b>
            </div>
          </div>
          <div className="pd-creditbar" style={{ marginTop: 10 }}>
            <span style={{ width: `${upiLimit ? Math.min(Math.round((upiUsed / upiLimit) * 100), 100) : 0}%` }} />
          </div>
          {!modules.upi.length ? <p className="pd-empty">Add a UPI credit line to track usage.</p> : null}
        </div>
      </section>

      <div className="pd-section-band">
        <div>
          <h3>Today & Smart Actions</h3>
          <p>Daily pulse, people money, personalized insights and shortcuts</p>
        </div>
      </div>
      <section className="pd-bottom">
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Daily Financial Pulse</h3>
              <p>Today across spend, credit and investments</p>
            </div>
            <Link href="/transactions" className="pd-link">
              View all
            </Link>
          </div>
          <div className="pd-pulse-grid">
            <div className="pd-pulse">
              <span>Today spend</span>
              <b className="down">{money(data.todaySpending, currency)}</b>
            </div>
            <div className="pd-pulse">
              <span>Today income</span>
              <b className="up">{money(todayIncome, currency)}</b>
            </div>
            <div className="pd-pulse">
              <span>Card spend</span>
              <b>{money(cardToday, currency)}</b>
            </div>
            <div className="pd-pulse">
              <span>Safe to spend</span>
              <b className="up">{money(perDay || Math.max(0, data.budgetRemaining), currency)}</b>
            </div>
          </div>
          <div className="pd-mini-list">
            {todayTxns.length ? (
              todayTxns.slice(0, 3).map((item) => (
                <div key={item.id} className="rowx">
                  <span>
                    {compactTime(item.transactionAt)} · {item.merchant || item.categoryName} ·{" "}
                    {item.accountName}
                  </span>
                  <b className={item.type === "INCOME" ? "up" : "down"}>
                    {signedMoney(item.amountMinor, item.currency, item.type)}
                  </b>
                </div>
              ))
            ) : (
              <div className="rowx">
                <span>No transactions logged today</span>
                <b>—</b>
              </div>
            )}
          </div>
        </div>
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Borrow / Lend</h3>
              <p>Money with friends & family</p>
            </div>
            <Link href="/lend" className="pd-link">
              View all
            </Link>
          </div>
          <div className="pd-borrowtabs">
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
          <div className="pd-mini-list">
            <div className="rowx">
              <span>Money lent</span>
              <b>{money(lentOpen, currency)}</b>
            </div>
            <div className="rowx">
              <span>Borrowed</span>
              <b>{money(borrowedOpen, currency)}</b>
            </div>
            <div className="rowx">
              <span>Due to receive</span>
              <b className="up">{money(lentOpen, currency)}</b>
            </div>
          </div>
          {lendRows.slice(0, 2).map((item) => (
            <div key={item.id} className="pd-person">
              <span>{item.person}</span>
              <b className={item.kind === "lent" ? "up" : "down"}>
                {item.status === "settled" ? money(0, currency) : money(item.amountMinor, currency)}
              </b>
            </div>
          ))}
        </div>
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Top Insights for You</h3>
              <p>Personalized from your money activity</p>
            </div>
          </div>
          <div className="pd-insights">
            <div className="pd-insight">
              <i>
                <ArrowUpRight size={16} />
              </i>
              <div>
                <b>{topCategory ? `${topCategory.name} spend is high` : "Start tracking"}</b>
                <small>
                  {topCategory
                    ? `${money(topCategory.value, currency)} this month. Review this category.`
                    : "Add a few expenses to unlock useful observations."}
                </small>
              </div>
            </div>
            <div className="pd-insight">
              <i>
                <PiggyBank size={16} />
              </i>
              <div>
                <b>{net7 >= 0 ? "Positive 7-day cash flow" : "Week is running negative"}</b>
                <small>
                  {net7 >= 0
                    ? `Net ${money(net7, currency)} this week can accelerate goals.`
                    : `Net ${money(net7, currency)} this week. Trim the top spend category.`}
                </small>
              </div>
            </div>
            <div className="pd-insight">
              <i>
                <CreditCard size={16} />
              </i>
              <div>
                <b>{utilization ? `Credit is ${utilization <= 30 ? "healthy" : "elevated"}` : "Credit is quiet"}</b>
                <small>
                  {cardOverdue
                    ? `${money(cardOverdue, currency)} overdue. Pay that first.`
                    : `${utilization}% utilisation of ${money(cardLimit, currency)} limit.`}
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="pd-card">
          <div className="pd-head">
            <div>
              <h3>Quick Actions</h3>
              <p>Most-used money tasks</p>
            </div>
          </div>
          <div className="pd-actions">
            <Link href="/transactions?action=add">
              <span className="qa-ico">
                <Plus size={16} />
              </span>
              Add Transaction
            </Link>
            <Link href="/investments">
              <span className="qa-ico">
                <TrendingUp size={16} />
              </span>
              Add Investment
            </Link>
            <Link href="/recurring">
              <span className="qa-ico">
                <Bell size={16} />
              </span>
              Add Bill Reminder
            </Link>
            <Link href="/budgets">
              <span className="qa-ico">
                <Wallet size={16} />
              </span>
              Set Budget
            </Link>
            <Link href="/reports">
              <span className="qa-ico">
                <LineChart size={16} />
              </span>
              View Reports
            </Link>
            <Link href="/settings">
              <span className="qa-ico">
                <Settings size={16} />
              </span>
              Settings
            </Link>
          </div>
        </div>
      </section>

      <div className="pd-ai-banner">
        <div className="pd-ai-icon">
          <Sparkles size={20} />
        </div>
        <div>
          <h4>Smart money insight</h4>
          <p>
            Your 7-day cash flow is {net7 >= 0 ? "positive" : "negative"} by {money(Math.abs(net7), currency)}.
            {net7 >= 0
              ? " If you keep the same pace, you can move extra into savings this month."
              : " A small cut in your top category can turn the week around."}
          </p>
        </div>
        <Link href="/coach" className="pd-full-btn">
          Ask Hisaab AI →
        </Link>
      </div>
    </div>
  );
}

const DONUT_PALETTE = ["#18ba67", "#ffad24", "#8053f7", "#ff4f5e", "#2787ff", "#6f8378"];

function PdSpark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const width = 94;
  const height = 35;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / (max - min || 1)) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="pd-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function MiniTrend({ values, tone }: { values: number[]; tone: "in" | "out" }) {
  const max = Math.max(...values, 1);
  return (
    <div className="pd-mini-trend">
      {values.map((value, index) => (
        <i key={`${tone}-${index}`} style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function PdFlowChart({
  days,
  currency,
}: {
  days: Array<{ date: string; label: string; received: number; spent: number }>;
  currency: string;
}) {
  const max = Math.max(...days.flatMap((day) => [day.received, day.spent]), 1);
  const ticks = [max, Math.round(max * 0.66), Math.round(max * 0.33), 0];
  return (
    <div className="pd-cashflow">
      <div className="pd-yaxis">
        {ticks.map((tick, index) => (
          <span key={`${tick}-${index}`}>{compactAxis(tick, currency)}</span>
        ))}
      </div>
      <div className="pd-cashflow-grid">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="pd-bars">
        {days.map((day) => (
          <div
            key={day.date}
            className="pd-day"
            title={`${day.label}: received ${money(day.received, currency)}, spent ${money(day.spent, currency)}`}
          >
            <div className="pd-bar in" style={{ height: `${Math.max(3, (day.received / max) * 100)}%` }} />
            <div className="pd-bar out" style={{ height: `${Math.max(3, (day.spent / max) * 100)}%` }} />
            <span className="pd-day-label">{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildWeekSeries(rows: Array<{ date: string; amount: number; income?: number }>) {
  const spentMap = new Map(rows.map((row) => [row.date, row.amount]));
  const incomeMap = new Map(rows.map((row) => [row.date, row.income ?? 0]));
  const days: Array<{ date: string; label: string; received: number; spent: number }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = localDateKey(date);
    days.push({
      date: key,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
      received: incomeMap.get(key) ?? 0,
      spent: spentMap.get(key) ?? 0,
    });
  }
  return days;
}

function formatWeekRange(week: Array<{ date: string }>) {
  if (!week.length) return "Last 7 days";
  const start = formatShortDay(week[0]!.date);
  const end = formatShortDay(week.at(-1)!.date);
  return `${start} – ${end}`;
}

function formatShortDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

function compactAxis(minor: number, currency: string) {
  if (!minor) return "0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(minor / 100);
}

function pctChange(current: number, previous: number) {
  if (!previous) return 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function trendSpan(delta: number, invertBad = false) {
  if (!delta) return <span className="pd-trend">— same</span>;
  const worse = invertBad ? delta > 0 : delta < 0;
  return (
    <span className={`pd-trend ${worse ? "bad" : ""}`}>
      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}%
    </span>
  );
}

function bankFlow(accountId: string, txns: Transaction[]) {
  return txns.reduce(
    (acc, item) => {
      if (item.accountId !== accountId) return acc;
      if (item.type === "INCOME") acc.in += item.amountMinor;
      else acc.out += item.amountMinor;
      return acc;
    },
    { in: 0, out: 0 },
  );
}

function bankLogoClass(label: string) {
  const key = label.toLowerCase();
  if (key.includes("icici")) return "ic";
  if (key.includes("sbi") || key.includes("state bank")) return "sb";
  if (key.includes("axis")) return "ax";
  return "";
}

function isCardTxn(item: Transaction) {
  const hay = `${item.accountName ?? ""} ${item.categoryName ?? ""}`.toLowerCase();
  return hay.includes("card") || hay.includes("credit");
}

function activityTone(item: Transaction) {
  if (item.type === "INCOME") return "salary";
  const name = `${item.categoryName ?? ""} ${item.merchant ?? ""}`.toLowerCase();
  if (name.includes("food") || name.includes("swiggy") || name.includes("dining")) return "food";
  if (name.includes("uber") || name.includes("transport") || name.includes("fuel")) return "car";
  return "shop";
}

function activityIcon(item: Transaction) {
  if (item.type === "INCOME") return <TrendingUp size={16} />;
  const tone = activityTone(item);
  if (tone === "food") return <Wallet size={16} />;
  if (tone === "car") return <ArrowDownRight size={16} />;
  return <CreditCard size={16} />;
}

function daysUntil(iso: string, nowMs: number) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - nowMs) / 86400000));
}

function billTone(merchant: string | null) {
  const text = (merchant ?? "").toLowerCase();
  if (text.includes("airtel") || text.includes("jio") || text.includes("phone")) return "red";
  if (text.includes("electric") || text.includes("utility")) return "orange";
  return "blue";
}

function donutGradient(items: Array<{ name: string; value: number; colour: string }>, total: number) {
  const stops: string[] = [];
  let start = 0;
  for (const [index, item] of items.entries()) {
    const pct = total ? (item.value / total) * 100 : 0;
    const end = start + pct;
    stops.push(`${item.colour || DONUT_PALETTE[index] || "#c5cdc8"} ${start}% ${end}%`);
    start = end;
  }
  if (start < 99.5) stops.push(`var(--muted) ${start}% 100%`);
  return stops.join(",");
}

function foldCategories(items: Array<{ name: string; value: number; colour: string }>) {
  const top = items.slice(0, 5);
  const rest = items.slice(5);
  const others = rest.reduce((sum, item) => sum + item.value, 0);
  return others ? [...top, { name: "Others", value: others, colour: "#6f8378" }] : top;
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
  };
}
