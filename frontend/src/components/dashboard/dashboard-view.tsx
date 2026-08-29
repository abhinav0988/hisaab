"use client";
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
  CardHead,
  Gauge,
  Insight,
  KpiCard,
  ProLabel,
  ProgressBar,
} from "@/components/layout/chrome";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { dateTime, greetingForHour, longDate, money, signedMoney } from "@/lib/format";
import { tidyAccountLabel } from "@/lib/accounts";
import { authService } from "@/services/auth.service";
import { dashboardService } from "@/services/dashboard.service";
import { recurringService } from "@/services/recurring.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [nowMs] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.summary(),
  });
  const bills = useQuery({
    queryKey: ["recurring"],
    queryFn: () => recurringService.list<Recurring>(),
  });
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
    .slice(0, 4);
  const upcomingTotal = upcoming.reduce((sum, item) => sum + item.amountMinor, 0);
  const chartData =
    range === "week"
      ? data.sevenDaySpending.map((item) => ({ label: item.date, amount: item.amount }))
      : data.monthlyComparison.map((item) => ({ label: item.month, amount: item.expense }));
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
              ▣ Scan receipt <ProLabel />
            </Button>
            <Button
              variant="secondary"
              className="border-white/12 bg-white/10 text-[#f3fff7] hover:bg-white/15"
              onClick={() => router.push("/transactions?action=add")}
            >
              ＋ Add transaction
            </Button>
            <Button
              variant="ghost"
              className="text-[#f3fff7] hover:bg-white/15"
              onClick={() => router.push("/reports")}
            >
              Go to analytics →
            </Button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="mb-3.5 flex items-center justify-between">
            <b className="text-[13px]">This month snapshot</b>
            <small className="text-[#d1e7d8]">Live from your accounts</small>
          </div>
          <div className="hero-mini-grid">
            <div className="hero-mini">
              <small>Monthly saving</small>
            <b className="break-words">{money(data.netSavings, currency)}</b>
              <span className="positive">{rate >= 20 ? "↑ Strong savings pace" : "Keep building this month"}</span>
            </div>
            <div className="hero-mini">
              <small>Budget left</small>
              <b>{money(data.budgetRemaining, currency)}</b>
              <span className="positive">
                {data.budgetTotal ? `${Math.round(data.budgetPercentage)}% used so far` : "Add a monthly budget"}
              </span>
            </div>
            <div className="hero-mini">
              <small>Income</small>
              <b>{money(data.incomeThisMonth, currency)}</b>
              <span className="positive">{data.incomeThisMonth ? "On track this month" : "Add income to start"}</span>
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
      <section className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Safe to spend"
          value={money(data.budgetRemaining, currency)}
          note="Money available after your current budget planning."
          foot={perDay ? "+ remaining days paced" : data.budgetTotal ? "Set a limit to pace spending" : "Add a monthly budget"}
          footNote={perDay ? `${money(perDay, currency)} per remaining day` : "After planned budgets"}
          tone="positive"
          icon="₹"
        />
        <KpiCard
          label="Spent this month"
          value={money(data.spentThisMonth, currency)}
          note="Your overall expense total for the current month."
          foot={
            spendDelta
              ? `${Math.abs(spendDelta)}% ${spendDelta > 0 ? "higher" : "lower"} than last month`
              : "This month so far"
          }
          footNote={topCategory ? `${topCategory.name} remains a top category` : "Add expenses to compare"}
          tone={spendDelta > 0 ? "warning" : "muted"}
          icon="↘"
        />
        <KpiCard
          label="Income"
          value={money(data.incomeThisMonth, currency)}
          note="All salary and other credits captured this month."
          foot={data.incomeThisMonth ? "On track this month" : "Add income to see the picture"}
          footNote="Credits captured in Hisaab"
          tone="positive"
          icon="↗"
        />
        <KpiCard
          label="Savings rate"
          value={`${rate}%`}
          note="Percentage of income currently staying saved."
          foot={rate >= 20 ? "Excellent progress" : rate > 0 ? "Keep going" : "Add income to measure"}
          footNote="Income minus spending"
          tone={rate >= 20 ? "positive" : "muted"}
          icon="◎"
        />
      </section>
      <section className="mt-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.48fr)_minmax(310px,.72fr)]">
        <div className="grid gap-[18px]">
          <Card className="p-[22px]">
            <CardHead
              title="Spending trend"
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
            <div className="h-[300px] min-w-0">
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
                    />
                    <Tooltip
                      formatter={(value) => money(Number(value), currency)}
                      contentStyle={{ borderRadius: 8, background: "var(--foreground)", color: "var(--surface)", border: 0 }}
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
          </Card>
          <Card className="p-[22px]">
            <CardHead
              title="Recent activity"
              description="Your latest transactions"
              action={
                <Link href="/transactions" className="text-[11px] font-bold text-[var(--muted-foreground)]">
                  View all →
                </Link>
              }
            />
            <div className="grid">
              {data.recentTransactions.length ? (
                data.recentTransactions.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-[var(--border)] py-3.5 last:border-0"
                  >
                    <span className="grid size-[38px] place-items-center rounded-xl bg-[var(--muted)] text-[var(--primary)]">
                      {item.categoryIcon ?? (item.type === "INCOME" ? "₹" : "↘")}
                    </span>
                    <div className="min-w-0">
                      <b className="block truncate text-xs">
                        {item.merchant || item.categoryName || "Transaction"}
                      </b>
                      <small className="mt-0.5 block truncate text-[var(--muted-foreground)]">
                        {item.categoryName} · {tidyAccountLabel(item.accountName)} · {dateTime(item.transactionAt)}
                      </small>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-extrabold ${item.type === "INCOME" ? "text-[var(--primary)]" : ""}`}
                    >
                      {signedMoney(item.amountMinor, item.currency, item.type)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                  Your transactions will appear here.
                </p>
              )}
            </div>
          </Card>
        </div>
        <div className="grid gap-[18px]">
          <Card className="p-[22px]">
            <CardHead
              title="Monthly budget"
              description={new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date())}
              action={
                <Link href="/budgets" className="text-[11px] font-bold text-[var(--muted-foreground)]">
                  Manage
                </Link>
              }
            />
            {data.budgetTotal ? (
              <>
                <Gauge value={data.budgetPercentage} />
                <ProgressBar value={data.budgetPercentage} />
                <div className="mt-1.5 flex justify-between gap-2 text-[11px]">
                  <b>{money(data.spentThisMonth, currency)} used</b>
                  <span className="text-[var(--muted-foreground)]">
                    {money(data.budgetRemaining, currency)} left
                  </span>
                </div>
              </>
            ) : (
              <p className="py-6 text-sm text-[var(--muted-foreground)]">
                No overall budget yet.{" "}
                <Link href="/budgets" className="font-semibold text-[var(--primary)]">
                  Create one
                </Link>
              </p>
            )}
          </Card>
          <Card className="p-[22px]">
            <CardHead
              title={
                <>
                  Smart insights <ProLabel />
                </>
              }
              description="Personal observations"
            />
            <div className="grid gap-2">
              <Insight
                icon="↘"
                title={topCategory ? `${topCategory.name} spend is high` : "Start tracking"}
                body={
                  topCategory
                    ? `You spent ${money(topCategory.value, currency)} on ${topCategory.name} this month.`
                    : "Add a few expenses to unlock useful observations."
                }
              />
              <Insight
                gold
                icon="✦"
                title={rate >= 20 ? "You’re on track" : "Room to save"}
                body={
                  rate >= 20
                    ? "At this pace, your savings can grow faster than last month."
                    : "A small weekly cut in your top category can lift your savings rate."
                }
              />
            </div>
          </Card>
          <Card className="p-[22px]">
            <CardHead
              title="Upcoming bills"
              description="Next 7 days"
              action={<ProLabel>AUTO</ProLabel>}
            />
            {upcoming.length ? (
              upcoming.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--border)] py-3 last:border-0"
                >
                  <span className="grid size-[38px] place-items-center rounded-xl bg-[var(--muted)] text-[var(--primary)]">
                    ⌁
                  </span>
                  <div>
                    <b className="block text-xs">{item.merchant || "Recurring payment"}</b>
                    <small className="mt-0.5 block text-[var(--muted-foreground)]">
                      {dateTime(item.nextRunAt)}
                    </small>
                  </div>
                  <span className="text-xs font-extrabold">{money(item.amountMinor, item.currency)}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-[var(--muted-foreground)]">
                No bills due in the next week.{" "}
                <Link href="/recurring" className="font-semibold text-[var(--primary)]">
                  Add recurring
                </Link>
              </p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function ChipBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
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
