"use client";
import { Button, Card, Select } from "@hisaab/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  CalendarSync,
  ChartNoAxesCombined,
  Lightbulb,
  PiggyBank,
  TrendingUp,
  Utensils,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CardHead, Insight, KpiCard, ProLabel, ProgressBar } from "@/components/layout/chrome";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { money } from "@/lib/format";
import { profileService } from "@/services/profile.service";
import { reportService } from "@/services/report.service";
import { recurringService } from "@/services/recurring.service";

type Recurring = { amountMinor: number; isActive: boolean; type: string };

export function ReportsView() {
  const [period, setPeriod] = useState("6");
  const range = useMemo(() => {
    const now = new Date();
    const months = Number(period);
    const from =
      period === "year"
        ? new Date(now.getFullYear(), 0, 1)
        : new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).toISOString())}`;
  }, [period]);
  const report = useQuery({
    queryKey: ["report", range],
    queryFn: () => reportService.daily(range),
  });
  const monthly = useQuery({
    queryKey: ["report-monthly", range],
    queryFn: () => reportService.monthly(range),
  });
  const categories = useQuery({
    queryKey: ["report-categories", range],
    queryFn: () => reportService.categories(range),
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.get(),
  });
  const recurring = useQuery({
    queryKey: ["recurring"],
    queryFn: () => recurringService.list<Recurring>(),
  });
  if (report.isLoading || monthly.isLoading || categories.isLoading || profile.isLoading)
    return <PageSkeleton />;
  if (!report.data || !monthly.data || !categories.data || !profile.data)
    return <ErrorState retry={() => void report.refetch()} />;
  const currency = profile.data.defaultCurrency;
  const months = monthly.data;
  const chartLabel =
    period === "year" ? "This year comparison" : period === "12" ? "Twelve-month comparison" : "Six-month comparison";
  const top = categories.data[0];
  const best = months.reduce(
    (winner, item) => {
      const saved = item.income - item.expense;
      return saved > winner.saved ? { month: item.month, saved } : winner;
    },
    { month: "—", saved: Number.NEGATIVE_INFINITY },
  );
  const bills = (recurring.data ?? [])
    .filter((item) => item.isActive && item.type === "EXPENSE")
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const billShare =
    report.data.totalIncome > 0 ? Math.round((bills / report.data.totalIncome) * 1000) / 10 : 0;
  const projected = Math.max(0, report.data.totalIncome - report.data.totalExpenses - bills);
  return (
    <div>
      <PageHeader
        eyebrow="Premium intelligence"
        title="Analytics"
        description="Clear insights without complicated finance language."
        actions={
          <>
            <Select className="w-full sm:w-44" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="year">This year</option>
            </Select>
            <Button
              variant="secondary"
              onClick={() => window.open(reportService.exportUrl(range), "_blank")}
            >
              <ArrowDownToLine size={16} aria-hidden="true" /> Export report
            </Button>
          </>
        }
      />
      <section className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Average monthly spend"
          value={money(report.data.averageDailySpending * 30, currency)}
          note={`${report.data.savingsRate >= 0 ? "↓" : "↑"} savings rate ${report.data.savingsRate}%`}
          tone="positive"
          icon={<ChartNoAxesCombined size={19} aria-hidden="true" />}
        />
        <KpiCard
          label="Highest category"
          value={top?.name ?? "—"}
          note={top ? `${money(top.value, currency)} this period` : "No expenses yet"}
          icon={<Utensils size={19} aria-hidden="true" />}
        />
        <KpiCard
          label="Best saving month"
          value={best.month}
          note={best.saved > 0 ? `${money(best.saved, currency)} saved` : "Add more history"}
          tone="positive"
          icon={<PiggyBank size={19} aria-hidden="true" />}
        />
        <KpiCard
          label="Recurring bills"
          value={money(bills, currency)}
          note={bills ? `${billShare}% of income` : "No active recurring bills"}
          icon={<CalendarSync size={19} aria-hidden="true" />}
        />
      </section>
      <section className="analytics-grid mt-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
        <Card className="p-[22px]">
          <CardHead
            title="Income vs expenses"
            description={chartLabel}
            action={<ProLabel />}
          />
          <div className="premium-chart h-[300px] min-w-0" role="img" aria-label="Income and expenses by month">
            {months.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 12, right: 4, left: 0, bottom: 0 }} barGap={5}>
                  <defs>
                    <linearGradient id="reportIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary-hover)" />
                      <stop offset="100%" stopColor="var(--primary)" />
                    </linearGradient>
                    <linearGradient id="reportExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e4ae6d" />
                      <stop offset="100%" stopColor="#c7792b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 5" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 700 }}
                    tickFormatter={shortMonth}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={54}
                    tick={{ fill: "var(--subtle)", fontSize: 10 }}
                    tickFormatter={compactAmount}
                  />
                  <Tooltip content={<ReportTooltip currency={currency} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                  <Bar dataKey="income" name="Income" fill="url(#reportIncome)" radius={[8, 8, 3, 3]} maxBarSize={34} />
                  <Bar dataKey="expense" name="Expenses" fill="url(#reportExpense)" radius={[8, 8, 3, 3]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="grid h-full place-items-center text-sm text-[var(--muted-foreground)]">
                Not enough history yet.
              </p>
            )}
          </div>
        </Card>
        <Card className="p-[22px]">
          <CardHead title="Top categories" description="Share of total spending" />
          <div className="grid gap-3">
            {categories.data.slice(0, 5).map((item) => {
              const max = categories.data[0]?.value || 1;
              return (
                <div key={item.id}>
                  <div className="flex flex-wrap justify-between gap-2 text-[11px]">
                    <b>{item.name}</b>
                    <span>{money(item.value, currency)}</span>
                  </div>
                  <ProgressBar className="mt-1.5 h-1.5" value={(item.value / max) * 100} />
                </div>
              );
            })}
            {!categories.data.length ? (
              <p className="text-sm text-[var(--muted-foreground)]">No expenses in this period.</p>
            ) : null}
          </div>
        </Card>
      </section>
      <section className="mt-[18px] grid gap-[18px] md:grid-cols-2">
        <Card className="p-[22px]">
          <CardHead
            title="Smart insights"
            description="Personal observations based on your patterns"
            action={<ProLabel />}
          />
          <div className="grid gap-2">
            <Insight
              icon={<TrendingUp size={17} aria-hidden="true" />}
              title={top ? `${top.name} leads spending` : "Start tracking"}
              body={
                top
                  ? `${top.name} is your largest category this period. A small weekly cut can add up over a year.`
                  : "Add expenses to unlock useful observations."
              }
            />
            <Insight
              gold
              icon={<Lightbulb size={17} aria-hidden="true" />}
              title="One easy saving opportunity"
              body="Reducing your top category by a little each week can lift next month’s savings without changing your lifestyle."
            />
          </div>
        </Card>
        <Card className="p-[22px]">
          <CardHead title="Cash-flow forecast" description="Next 30 days" action={<ProLabel />} />
          <div className="text-2xl font-black tracking-tight">{money(projected, currency)}</div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Projected end-of-month balance after recurring bills and your usual spending.
          </p>
          <ProgressBar
            className="mt-4"
            value={
              report.data.totalIncome
                ? Math.min(100, Math.round((projected / report.data.totalIncome) * 100))
                : 0
            }
          />
          <Button className="mt-4" variant="secondary" onClick={() => toast.info("Full forecasts unlock with Premium.")}>
            View forecast details
          </Button>
        </Card>
      </section>
    </div>
  );
}

function compactAmount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value / 100);
}

function ReportTooltip({ active, payload, label, currency }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <b>{label ? shortMonth(label) : "Month"}</b>
      {payload.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color }} />
          {item.name}<strong>{money(item.value, currency)}</strong>
        </span>
      ))}
    </div>
  );
}

function shortMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date);
}
