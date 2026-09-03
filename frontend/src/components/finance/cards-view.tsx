"use client";

import type {
  CreditFacility,
  CreditRecentTransaction,
  CreditSpendingSlice,
  CreditUtilisationMonth,
} from "@hisaab/types";
import { Badge, Button, Card, Field, Input } from "@hisaab/ui";
import {
  cardDueAmount,
  cardPaidThisCycle,
  cardPendingMinor,
  creditOverview,
  creditSummary,
  daysUntil,
  majorToMinor,
} from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CreditCard,
  Download,
  FileText,
  Gift,
  IndianRupee,
  Lightbulb,
  Lock,
  MoreVertical,
  Plus,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ProgressBar } from "@/components/layout/chrome";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { displayDateLong, isoPlusDays, isoToday, sumMinor } from "@/lib/finance-modules";
import { localDateKey, money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";

type Draft = {
  name: string;
  last4: string;
  limit: string;
  used: string;
  hold: string;
  overdue: string;
  minDue: string;
  cycleSpend: string;
  cycleStartOn: string;
  dueOn: string;
};

type FieldErrors = Partial<Record<keyof Draft, string>>;

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function emptyDraft(): Draft {
  return {
    name: "",
    last4: "",
    limit: "",
    used: "",
    hold: "",
    overdue: "",
    minDue: "",
    cycleSpend: "",
    cycleStartOn: isoToday(),
    dueOn: isoPlusDays(14),
  };
}

function last4FromMask(mask: string | null) {
  const digits = (mask ?? "").replace(/\D/g, "");
  return digits.slice(-4);
}

function draftFromCard(card: CreditFacility): Draft {
  return {
    name: card.name,
    last4: last4FromMask(card.mask),
    limit: card.limitMinor ? String(card.limitMinor / 100) : "",
    used: card.usedMinor ? String(card.usedMinor / 100) : "",
    hold: card.holdMinor ? String(card.holdMinor / 100) : "",
    overdue: card.overdueMinor ? String(card.overdueMinor / 100) : "",
    minDue: card.minDueMinor ? String(card.minDueMinor / 100) : "",
    cycleSpend: card.todaySpendMinor ? String(card.todaySpendMinor / 100) : "",
    cycleStartOn: card.cycleStartOn || isoToday(),
    dueOn: card.dueOn || isoPlusDays(14),
  };
}

function parseAmountMinor(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  try {
    return majorToMinor(cleaned);
  } catch {
    return Number.NaN;
  }
}

function formatPct(value: number) {
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function deltaPct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function isCardOverdue(card: CreditFacility) {
  if (card.overdueMinor > 0) return true;
  return Boolean(card.dueOn && daysUntil(card.dueOn) < 0);
}

function canPayCard(card: CreditFacility) {
  return cardDueAmount(card) > 0 && !cardPaidThisCycle(card.lastPaidOn, card.dueOn);
}

function dueCountdown(dueOn: string | null) {
  if (!dueOn) return null;
  const days = daysUntil(dueOn);
  if (days < 0) return { tone: "overdue" as const, label: "Overdue" };
  if (days === 0) return { tone: "upcoming" as const, label: "Due today" };
  return { tone: "upcoming" as const, label: `${days} day${days === 1 ? "" : "s"} left` };
}

function estimateCreditScore(usedPct: number) {
  return Math.max(300, Math.min(850, Math.round(900 - usedPct * 2.5 - (usedPct > 55 ? 25 : 0))));
}

function buildSpendingTrend(
  recent: CreditRecentTransaction[],
  cycleSpendMinor: number,
  outstandingMinor: number,
  limitMinor: number,
) {
  const days = 30;
  const now = new Date();
  const byDay = new Map<string, number>();
  for (const item of recent) {
    const key = localDateKey(item.transactionAt);
    byDay.set(key, (byDay.get(key) ?? 0) + item.amountMinor);
  }
  const windowKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    windowKeys.push(localDateKey(date));
  }
  const windowSpend = windowKeys.reduce((sum, key) => sum + (byDay.get(key) ?? 0), 0);
  let cumulative = 0;
  let peakDay = 0;
  const points: Array<{
    label: string;
    spendMinor: number;
    outstandingMinor: number;
    limitMinor: number;
    daySpendMinor: number;
  }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = localDateKey(date);
    const daySpend = byDay.get(key) ?? 0;
    cumulative += daySpend;
    peakDay = Math.max(peakDay, daySpend);
    const estimatedOutstanding = Math.max(0, outstandingMinor - (windowSpend - cumulative));
    points.push({
      label: new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(date),
      spendMinor: cumulative,
      outstandingMinor: estimatedOutstanding,
      limitMinor,
      daySpendMinor: daySpend,
    });
  }
  const activeDays = [...byDay.values()].filter((value) => value > 0).length || 1;
  return {
    points,
    peakDayMinor: peakDay,
    avgDailyMinor: Math.round(cycleSpendMinor / activeDays),
    totalSpendMinor: cycleSpendMinor,
    totalOutstandingMinor: outstandingMinor,
  };
}

function downloadCardsCsv(cards: CreditFacility[]) {
  const rows = [
    ["Name", "Mask", "Limit", "Used", "Hold", "Available", "Due on", "Min due", "Overdue", "Status"],
    ...cards.map((card) => {
      const summary = creditSummary(card);
      return [
        card.name,
        card.mask ?? "",
        String(card.limitMinor / 100),
        String(card.usedMinor / 100),
        String((card.holdMinor ?? 0) / 100),
        String(summary.availableMinor / 100),
        card.dueOn ?? "",
        String((card.minDueMinor ?? 0) / 100),
        String(card.overdueMinor / 100),
        isCardOverdue(card) ? "Overdue" : "Active",
      ];
    }),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hisaab-credit-cards.csv";
  link.click();
  URL.revokeObjectURL(url);
}

const DateInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function DateInput(props, ref) {
  return (
    <div className="date-shell">
      <span className="calendar-icon" aria-hidden="true">
        <Calendar size={13} />
      </span>
      <Input ref={ref} type="date" {...props} />
    </div>
  );
});

const IconInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode }
>(function IconInput({ icon, ...props }, ref) {
  return (
    <div className="date-shell">
      <span className="calendar-icon" aria-hidden="true">
        {icon}
      </span>
      <Input ref={ref} {...props} />
    </div>
  );
});

export function CardsView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: ["credit-dashboard"],
    queryFn: () => financeService.getCreditDashboard(),
    retry: false,
  });
  const [screen, setScreen] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<CreditFacility | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [paying, setPaying] = useState<CreditFacility | null>(null);
  const [deleting, setDeleting] = useState<CreditFacility | null>(null);

  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createCreditFacility(body),
    onError: (error) => toast.error(failMessage(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => financeService.updateCreditFacility(id, body),
    onError: (error) => toast.error(failMessage(error)),
  });
  const pay = useMutation({
    mutationFn: (id: string) => financeService.payCreditFacility(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["credit-facilities"] });
      await client.invalidateQueries({ queryKey: ["credit-dashboard"] });
      toast.success("Payment marked as done");
      setPaying(null);
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => financeService.deleteCreditFacility(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["credit-facilities"] });
      await client.invalidateQueries({ queryKey: ["credit-dashboard"] });
      toast.success("Card removed");
      setDeleting(null);
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  if (profile.isLoading || facilities.isLoading) return <PageSkeleton />;
  if (facilities.isError) return <ErrorState retry={() => void facilities.refetch()} />;

  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = (facilities.data ?? []).filter((item) => item.kind === "CARD");
  const overview = creditOverview({
    limitMinor: sumMinor(list, (item) => item.limitMinor),
    usedMinor: sumMinor(list, (item) => item.usedMinor),
    overdueMinor: sumMinor(list, (item) => item.overdueMinor),
    holdMinor: sumMinor(list, (item) => item.holdMinor ?? 0),
  });
  const upcoming = [...list]
    .filter((card) => card.dueOn)
    .sort((left, right) => (left.dueOn ?? "").localeCompare(right.dueOn ?? ""));
  const pendingBill = sumMinor(list, (card) => cardPendingMinor(card));
  const cycleSpend = sumMinor(list, (card) => card.todaySpendMinor ?? 0);
  const payable = upcoming.find((card) => canPayCard(card)) ?? list.find((card) => canPayCard(card));
  const pending = create.isPending || update.isPending;
  const nextDue = upcoming[0]?.dueOn ?? dashboard.data?.cycle.dueOn ?? null;
  const trendPack = buildSpendingTrend(
    dashboard.data?.recent ?? [],
    dashboard.data?.cycle.spendMinor ?? cycleSpend,
    overview.usedMinor,
    overview.limitMinor,
  );
  const creditScore = estimateCreditScore(overview.usedPct);
  const rewardsMinor = Math.max(0, Math.round((dashboard.data?.cycle.spendMinor ?? cycleSpend) * 0.12));

  function openAdd() {
    setEditing(null);
    setFormKey((value) => value + 1);
    setScreen("form");
  }

  function openEdit(card: CreditFacility) {
    setEditing(card);
    setFormKey((value) => value + 1);
    setScreen("form");
  }

  async function handleSaved() {
    await client.invalidateQueries({ queryKey: ["credit-facilities"] });
    await client.invalidateQueries({ queryKey: ["credit-dashboard"] });
    toast.success(editing ? "Card updated" : "Card saved");
    setScreen("list");
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        title="Credit Cards"
        description="Track limits, usage, bills, rewards and spending in one place."
        actions={
          <Button variant="secondary" onClick={openAdd}>
            <Plus size={14} />
            Add Card
          </Button>
        }
      />
      <div className="cards-hero">
        {(
          [
            {
              label: "Total credit limit",
              value: money(overview.limitMinor, currency),
              note: `Across ${list.length} card${list.length === 1 ? "" : "s"}`,
              icon: CreditCard,
              tone: "green",
              pct: null,
            },
            {
              label: "Total used",
              value: money(overview.usedMinor, currency),
              note: `${formatPct(overview.usedPct)} of total limit`,
              icon: Wallet,
              tone: "blue",
              pct: overview.usedPct,
            },
            {
              label: "Available limit",
              value: money(overview.availableMinor, currency),
              note: `${formatPct(overview.availablePct)} remaining`,
              icon: IndianRupee,
              tone: "purple",
              pct: overview.availablePct,
            },
            {
              label: "Total outstanding",
              value: money(pendingBill, currency),
              note: nextDue ? `Due on ${displayDateLong(nextDue)}` : "No due date set",
              icon: Lock,
              tone: "gold",
              pct: overview.limitMinor
                ? Math.round((pendingBill / overview.limitMinor) * 1000) / 10
                : null,
            },
          ] as Array<{
            label: string;
            value: string;
            note: string;
            icon: LucideIcon;
            tone: string;
            pct: number | null;
          }>
        ).map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="cards-kpi">
              <div className="cards-kpi-head">
                <span className={`cards-kpi-icon is-${item.tone}`}>
                  <Icon size={15} />
                </span>
                <small>{item.label}</small>
              </div>
              <strong>{item.value}</strong>
              {item.pct != null ? (
                <ProgressBar
                  value={item.pct}
                  tone={item.label === "Total used" && item.pct > 70 ? "warn" : "ok"}
                />
              ) : null}
              <span>{item.note}</span>
            </Card>
          );
        })}
      </div>
      {list.length ? (
        <>
          <CycleBanner
            currency={currency}
            pendingMinor={pendingBill}
            spendMinor={dashboard.data?.cycle.spendMinor || cycleSpend}
            transactionCount={dashboard.data?.cycle.transactionCount ?? 0}
            dueOn={nextDue}
            canPay={Boolean(payable)}
            onPay={() => payable && setPaying(payable)}
            onAdd={openAdd}
            onDownload={() => {
              downloadCardsCsv(list);
              toast.success("Card summary downloaded");
            }}
          />
          <div className="cards-dashboard">
            <div className="cards-dashboard-main">
              <YourCardsSection
                cards={list}
                currency={currency}
                onAdd={openAdd}
                onEdit={openEdit}
                onPay={setPaying}
                onDelete={setDeleting}
              />
              <div className="cards-lower">
                <RecentCardTransactions
                  currency={currency}
                  items={dashboard.data?.recent ?? []}
                />
                <UpcomingPayments cards={upcoming} currency={currency} onPay={setPaying} />
              </div>
              <SpendingTrendChart currency={currency} pack={trendPack} />
            </div>
            <aside className="cards-dashboard-side">
              <SpendingByCategory currency={currency} spending={dashboard.data?.spending ?? []} compact />
              <CardSmartInsights
                currency={currency}
                rewardsMinor={rewardsMinor}
                usedPct={overview.usedPct}
                spendMinor={dashboard.data?.cycle.spendMinor ?? cycleSpend}
                trend={dashboard.data?.trend ?? []}
                dueOn={nextDue}
                pendingMinor={pendingBill}
              />
              <QuickActions
                onAddCard={openAdd}
                onReport={() =>
                  document.getElementById("cards-spending-trend")?.scrollIntoView({ behavior: "smooth" })
                }
                onStatement={() => toast.info("Statement download opens from your bank app or email.")}
                onDownload={() => {
                  downloadCardsCsv(list);
                  toast.success("Card summary downloaded");
                }}
              />
            </aside>
          </div>
          <CardsFooterTips
            usedPct={overview.usedPct}
            dueOn={nextDue}
            creditScore={creditScore}
          />
        </>
      ) : (
        <EmptyState
          title="No credit cards yet"
          description="Add a card to track limit, usage and statement due date."
          action={<Button onClick={openAdd}>Add Card</Button>}
        />
      )}
      <Modal
        open={screen === "form"}
        onClose={() => {
          setScreen("list");
          setEditing(null);
        }}
        title={editing ? "Edit Credit Card" : "Add Credit Card"}
        description="Add your card details and track your spending smarter."
        size="xl"
      >
        <CardComposer
          key={formKey}
          currency={currency}
          existing={editing}
          pending={pending}
          onClose={() => {
            setScreen("list");
            setEditing(null);
          }}
          onSave={async (body) => {
            if (editing) {
              await update.mutateAsync({ id: editing.id, body });
            } else {
              await create.mutateAsync(body);
            }
            await handleSaved();
          }}
        />
      </Modal>
      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title="Mark payment as done"
        description={
          paying
            ? `Mark ${money(cardDueAmount(paying), currency)} for ${paying.name}${paying.mask ? ` (${paying.mask})` : ""} as paid? Used amount and the next due date will update.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPaying(null)}>
            Cancel
          </Button>
          <Button disabled={pay.isPending} onClick={() => paying && pay.mutate(paying.id)}>
            {pay.isPending ? "Saving…" : "Mark done"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove card"
        description={deleting ? `Remove ${deleting.name}? This cannot be undone.` : undefined}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SpendingTrendChart({
  currency,
  pack,
}: {
  currency: string;
  pack: ReturnType<typeof buildSpendingTrend>;
}) {
  return (
    <Card className="cards-trend" id="cards-spending-trend">
      <header>
        <div>
          <h2>Spending &amp; outstanding trend</h2>
          <small>Last 30 days — spending vs estimated outstanding.</small>
        </div>
      </header>
      <div className="cards-trend-body">
        <div className="cards-trend-chart">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={pack.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cardsSpendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 10 }}
                width={52}
                tickFormatter={(value) => money(Number(value), currency)}
              />
              <Tooltip
                formatter={(value, name) => [
                  money(Number(value) || 0, currency),
                  name === "spendMinor"
                    ? "Spending"
                    : name === "outstandingMinor"
                      ? "Outstanding"
                      : "Credit limit",
                ]}
              />
              <Area
                type="monotone"
                dataKey="spendMinor"
                stroke="var(--primary)"
                fill="url(#cardsSpendFill)"
                strokeWidth={2}
                name="spendMinor"
              />
              <Line
                type="monotone"
                dataKey="outstandingMinor"
                stroke="#f0b429"
                strokeWidth={2}
                dot={false}
                name="outstandingMinor"
              />
              <Line
                type="monotone"
                dataKey="limitMinor"
                stroke="color-mix(in srgb, var(--foreground) 35%, transparent)"
                strokeDasharray="4 4"
                dot={false}
                name="limitMinor"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ul className="cards-trend-metrics">
          <li>
            <small>Average daily spend</small>
            <strong>{money(pack.avgDailyMinor, currency)}</strong>
          </li>
          <li>
            <small>Total spend</small>
            <strong>{money(pack.totalSpendMinor, currency)}</strong>
          </li>
          <li>
            <small>Total outstanding</small>
            <strong>{money(pack.totalOutstandingMinor, currency)}</strong>
          </li>
          <li>
            <small>Highest spend day</small>
            <strong>{money(pack.peakDayMinor, currency)}</strong>
          </li>
        </ul>
      </div>
    </Card>
  );
}

function YourCardsSection({
  cards,
  currency,
  onAdd,
  onEdit,
  onPay,
  onDelete,
}: {
  cards: CreditFacility[];
  currency: string;
  onAdd: () => void;
  onEdit: (card: CreditFacility) => void;
  onPay: (card: CreditFacility) => void;
  onDelete: (card: CreditFacility) => void;
}) {
  return (
    <Card className="cards-your" id="cards-your-list">
      <header className="cards-table-head">
        <div>
          <h2>Your credit card</h2>
          <small>Limits, usage and due dates for each saved card.</small>
        </div>
      </header>
      <div className="cards-your-list">
        {cards.map((card) => {
          const summary = creditSummary(card);
          const due = dueCountdown(card.dueOn);
          const overdue = isCardOverdue(card);
          const pending = cardPendingMinor(card);
          const last4 = last4FromMask(card.mask);
          return (
            <article key={card.id} className="cards-card-row">
              <div className="cards-plastic">
                <small>Credit card</small>
                <strong>{card.name}</strong>
                <em>{last4 ? `•••• ${last4}` : "•••• ••••"}</em>
                <Badge tone={overdue ? "danger" : "success"}>
                  {overdue ? "Overdue" : "Active"}
                </Badge>
              </div>
              <div className="cards-stat-grid">
                <div>
                  <small>Limit</small>
                  <strong>{money(card.limitMinor, currency)}</strong>
                </div>
                <div>
                  <small>Used</small>
                  <strong>
                    {money(card.usedMinor, currency)}
                    <span>{formatPct(summary.usedPct)}</span>
                  </strong>
                  <ProgressBar value={summary.usedPct} tone={summary.usedPct > 70 ? "warn" : "ok"} />
                </div>
                <div>
                  <small>Available</small>
                  <strong>
                    {money(summary.availableMinor, currency)}
                    <span>
                      {formatPct(
                        card.limitMinor ? (summary.availableMinor / card.limitMinor) * 100 : 0,
                      )}
                    </span>
                  </strong>
                </div>
                <div>
                  <small>Outstanding</small>
                  <strong className="is-warn">{money(pending, currency)}</strong>
                </div>
                <div>
                  <small>Due date</small>
                  <strong>{card.dueOn ? displayDateLong(card.dueOn) : "—"}</strong>
                  {due ? <span className={`cards-pill is-${due.tone}`}>{due.label}</span> : null}
                </div>
              </div>
              <CardMenu card={card} onEdit={() => onEdit(card)} onPay={() => onPay(card)} onDelete={() => onDelete(card)} />
            </article>
          );
        })}
      </div>
      <button type="button" className="cards-add-new" onClick={onAdd}>
        <strong>
          <Plus size={16} aria-hidden="true" />
          Add New Card
        </strong>
        <span>Track another card and manage all your spends in one place.</span>
      </button>
    </Card>
  );
}

function CardSmartInsights({
  currency,
  rewardsMinor,
  usedPct,
  spendMinor,
  trend,
  dueOn,
  pendingMinor,
}: {
  currency: string;
  rewardsMinor: number;
  usedPct: number;
  spendMinor: number;
  trend: CreditUtilisationMonth[];
  dueOn: string | null;
  pendingMinor: number;
}) {
  const lastMonth = trend.at(-2);
  const spendDelta = lastMonth ? deltaPct(spendMinor, lastMonth.usedMinor) : 0;
  const due = dueOn ? dueCountdown(dueOn) : null;
  const insights: Array<{
    id: string;
    tone: "danger" | "warning" | "info";
    title: string;
    body: string;
    icon: LucideIcon;
  }> = [];

  if (spendDelta >= 20 && spendMinor > 0) {
    insights.push({
      id: "spending",
      tone: "danger",
      title: "High spending alert",
      body: `Card spend is ${spendDelta}% higher than last month. Review recent transactions.`,
      icon: AlertTriangle,
    });
  }
  if (dueOn && due) {
    insights.push({
      id: "due",
      tone: "warning",
      title: "Payment due soon",
      body: `${money(pendingMinor, currency)} due on ${displayDateLong(dueOn)} — ${due.label}.`,
      icon: Calendar,
    });
  }
  if (rewardsMinor > 0) {
    insights.push({
      id: "rewards",
      tone: "info",
      title: "Rewards earned",
      body: `You earned ${money(rewardsMinor, currency)} in rewards this month from card spend.`,
      icon: Gift,
    });
  }
  if (!insights.length) {
    insights.push({
      id: "tip",
      tone: "info",
      title: "Keep utilisation low",
      body:
        usedPct < 30
          ? "Great job — your card utilisation is below 30%."
          : "Try to keep utilisation below 30% for a healthier credit profile.",
      icon: Lightbulb,
    });
  }

  return (
    <Card className="cards-smart">
      <header>
        <div>
          <h2>Smart insights</h2>
          <small>Alerts and highlights for your cards.</small>
        </div>
      </header>
      <ul className="cards-insight-list">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id} className={`cards-insight-item is-${item.tone}`}>
              <span className="cards-insight-icon" aria-hidden="true">
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
  );
}

function CardsFooterTips({
  usedPct,
  dueOn,
  creditScore,
}: {
  usedPct: number;
  dueOn: string | null;
  creditScore: number;
}) {
  const due = dueOn ? dueCountdown(dueOn) : null;
  return (
    <section className="cards-footer-tips" aria-label="Card tips">
      <article>
        <Lightbulb size={15} aria-hidden="true" />
        <div>
          <strong>Save on interest</strong>
          <p>Pay before the due date to avoid interest and late fees.</p>
        </div>
      </article>
      <article className={usedPct > 30 ? "is-warn" : undefined}>
        <AlertTriangle size={15} aria-hidden="true" />
        <div>
          <strong>High utilisation</strong>
          <p>{formatPct(usedPct)} of your limit is in use this month.</p>
        </div>
      </article>
      <article>
        <Calendar size={15} aria-hidden="true" />
        <div>
          <strong>Upcoming due</strong>
          <p>{due ? `${due.label} to pay your card bill.` : "Set a due date on your card."}</p>
        </div>
      </article>
      <article>
        <Sparkles size={15} aria-hidden="true" />
        <div>
          <strong>Credit score booster</strong>
          <p>
            Score ~{creditScore}. Keep utilisation below 30% to maintain a good score.
          </p>
        </div>
      </article>
    </section>
  );
}

function QuickActions({
  onAddCard,
  onReport,
  onStatement,
  onDownload,
}: {
  onAddCard: () => void;
  onReport: () => void;
  onStatement: () => void;
  onDownload: () => void;
}) {
  return (
    <Card className="cards-actions">
      <header>
        <h2>Quick actions</h2>
      </header>
      <div className="cards-actions-grid">
        <button type="button" onClick={onAddCard}>
          <CreditCard size={18} />
          Add card
        </button>
        <button type="button" onClick={onReport}>
          <BarChart3 size={18} />
          Card report
        </button>
        <button type="button" onClick={onStatement}>
          <FileText size={18} />
          Statement
        </button>
        <button type="button" onClick={onDownload}>
          <Download size={18} />
          Download
        </button>
      </div>
    </Card>
  );
}

function CardMenu({
  card,
  onEdit,
  onPay,
  onDelete,
}: {
  card: CreditFacility;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);
  return (
    <div className="loan-row-menu" ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        className="px-2"
        aria-label={`Actions for ${card.name}`}
        aria-expanded={menu}
        onClick={() => setMenu((value) => !value)}
      >
        <MoreVertical size={16} />
      </Button>
      {menu ? (
        <div className="loan-row-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onEdit();
            }}
          >
            Edit
          </button>
          {canPayCard(card) ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                onPay();
              }}
            >
              Mark done
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setMenu(false);
              onDelete();
            }}
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

function UpcomingPayments({
  cards,
  currency,
  onPay,
}: {
  cards: CreditFacility[];
  currency: string;
  onPay: (card: CreditFacility) => void;
}) {
  return (
    <Card className="loans-upcoming">
      <header>
        <div>
          <h2>Upcoming payments</h2>
          <small>Next card bills and due dates.</small>
        </div>
        <button
          type="button"
          className="cards-link-btn"
          onClick={() => toast.info("Auto-pay reminders use each card's due date.")}
        >
          Set auto-pay
        </button>
      </header>
      {cards.length ? (
        <ul>
          {cards.map((card) => {
            const due = dueCountdown(card.dueOn);
            const amount = cardPendingMinor(card);
            return (
              <li key={card.id}>
                <span className={`loan-card-icon is-${due?.tone ?? "upcoming"}`}>
                  <CreditCard size={16} />
                </span>
                <div>
                  <strong>{card.name}</strong>
                  <small>
                    {card.mask || "Card"}
                    {card.dueOn ? ` · ${displayDateLong(card.dueOn)}` : ""}
                  </small>
                </div>
                <div className="loans-upcoming-amt">
                  <b>{money(amount, currency)}</b>
                  {due ? <em className={`loan-due is-${due.tone}`}>{due.label}</em> : null}
                  {canPayCard(card) ? (
                    <button type="button" className="loans-mark-done" onClick={() => onPay(card)}>
                      Mark done
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No upcoming card payments.</p>
      )}
    </Card>
  );
}

function CycleBanner({
  currency,
  pendingMinor,
  spendMinor,
  transactionCount,
  dueOn,
  canPay,
  onPay,
  onAdd,
  onDownload,
}: {
  currency: string;
  pendingMinor: number;
  spendMinor: number;
  transactionCount: number;
  dueOn: string | null;
  canPay: boolean;
  onPay: () => void;
  onAdd: () => void;
  onDownload: () => void;
}) {
  const due = dueCountdown(dueOn);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <section className="cards-cycle">
      <div>
        <small>Pending this cycle</small>
        <strong>{money(pendingMinor, currency)}</strong>
        <span>
          {transactionCount
            ? `From ${transactionCount} card transaction${transactionCount === 1 ? "" : "s"}`
            : spendMinor
              ? `${money(spendMinor, currency)} spent this cycle`
              : "Add a card spend in Transactions to update this"}
        </span>
      </div>
      <div>
        <small>Payment due date</small>
        <strong>{dueOn ? displayDateLong(dueOn) : "—"}</strong>
        <span>{due?.label ?? "Set a due date on a card"}</span>
      </div>
      <div className="cards-cycle-actions" ref={menuRef}>
        <Button type="button" disabled={!canPay} onClick={onPay}>
          Pay card bill
        </Button>
        <button
          type="button"
          className="cards-cycle-menu-btn"
          aria-label="More payment options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <MoreVertical size={18} />
        </button>
        {menuOpen ? (
          <div className="bank-menu-pop cards-cycle-menu-pop">
            <Link href="/transactions" onClick={() => setMenuOpen(false)}>View transactions</Link>
            <button type="button" onClick={() => { setMenuOpen(false); onAdd(); }}>Add card</button>
            <button type="button" onClick={() => { setMenuOpen(false); onDownload(); }}>Download summary</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RecentCardTransactions({
  currency,
  items,
}: {
  currency: string;
  items: CreditRecentTransaction[];
}) {
  return (
    <Card className="cards-recent">
      <header>
        <div>
          <h2>Recent credit transactions</h2>
          <small>Latest card spends from Transactions.</small>
        </div>
        <Link className="cards-link-btn" href="/transactions">
          View all
        </Link>
      </header>
      {items.length ? (
        <div className="cards-table-scroll">
          <table className="cards-table is-compact">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Card</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.merchant || "Card spend"}</strong>
                  </td>
                  <td>{item.cardName}</td>
                  <td>{displayDateLong(localDateKey(item.transactionAt))}</td>
                  <td>{money(item.amountMinor, currency)}</td>
                  <td>
                    <span className="cards-pill is-pending">Pending</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          When you add a credit-card expense in Transactions, it shows here and reduces available
          credit.
        </p>
      )}
    </Card>
  );
}

function SpendingByCategory({
  currency,
  spending,
  compact = false,
}: {
  currency: string;
  spending: CreditSpendingSlice[];
  compact?: boolean;
}) {
  const total = sumMinor(spending, (item) => item.amountMinor);
  return (
    <Card className="cards-spend">
      <header>
        <div>
          <h2>Spending overview</h2>
          <small>{compact ? "This month" : total ? `${money(total, currency)} this month` : "This month"}</small>
        </div>
      </header>
      {spending.length ? (
        <>
          <div className={`cards-donut${compact ? " is-compact" : ""}`}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={spending} dataKey="amountMinor" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none">
                  {spending.map((slice) => (
                    <Cell key={slice.id} fill={slice.colour || "var(--primary)"} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, item) => [money(Number(value) || 0, currency), String((item?.payload as CreditSpendingSlice | undefined)?.name ?? name)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul>
            {spending.map((slice) => (
              <li key={slice.id}>
                <i style={{ background: slice.colour || "var(--primary)" }} />
                <span>{slice.name}</span>
                <b>
                  {money(slice.amountMinor, currency)}
                  <small>{formatPct(total ? Math.round((slice.amountMinor / total) * 1000) / 10 : 0)}</small>
                </b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Link a card to a credit-card account, or add card spend in Transactions, to see this split.</p>
      )}
    </Card>
  );
}

function CardComposer({
  currency,
  existing,
  pending,
  onClose,
  onSave,
}: {
  currency: string;
  existing: CreditFacility | null;
  pending: boolean;
  onClose: () => void;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => (existing ? draftFromCard(existing) : emptyDraft()));
  const [errors, setErrors] = useState<FieldErrors>({});
  const limitMinor = parseAmountMinor(draft.limit);
  const usedMinor = parseAmountMinor(draft.used);
  const holdMinor = parseAmountMinor(draft.hold);
  const overdueMinor = parseAmountMinor(draft.overdue);
  const minDueMinor = parseAmountMinor(draft.minDue);
  const cycleSpendMinor = parseAmountMinor(draft.cycleSpend);
  const summary = useMemo(
    () =>
      creditSummary({
        limitMinor: Number.isFinite(limitMinor) ? limitMinor : 0,
        usedMinor: Number.isFinite(usedMinor) ? usedMinor : 0,
        holdMinor: Number.isFinite(holdMinor) ? holdMinor : 0,
        overdueMinor: Number.isFinite(overdueMinor) ? overdueMinor : 0,
        minDueMinor: Number.isFinite(minDueMinor) ? minDueMinor : 0,
        todaySpendMinor: Number.isFinite(cycleSpendMinor) ? cycleSpendMinor : 0,
      }),
    [cycleSpendMinor, holdMinor, limitMinor, minDueMinor, overdueMinor, usedMinor],
  );

  async function submit() {
    const nextErrors: FieldErrors = {};
    if (!draft.name.trim()) nextErrors.name = "Enter the card name.";
    if (draft.last4 && !/^\d{4}$/.test(draft.last4)) nextErrors.last4 = "Enter the last 4 digits.";
    if (!Number.isFinite(limitMinor) || limitMinor < 0) nextErrors.limit = "Enter the total spend limit.";
    if (!Number.isFinite(usedMinor) || usedMinor < 0) nextErrors.used = "Enter the used amount.";
    if (!Number.isFinite(holdMinor) || holdMinor < 0) nextErrors.hold = "Enter the credit hold amount.";
    if (!Number.isFinite(overdueMinor) || overdueMinor < 0) nextErrors.overdue = "Enter the overdue amount.";
    if (!Number.isFinite(minDueMinor) || minDueMinor < 0) nextErrors.minDue = "Enter the minimum due.";
    if (!Number.isFinite(cycleSpendMinor) || cycleSpendMinor < 0) nextErrors.cycleSpend = "Enter current cycle spend.";
    if (!draft.cycleStartOn) nextErrors.cycleStartOn = "Pick the billing start date.";
    if (!draft.dueOn) nextErrors.dueOn = "Pick the payment due date.";
    if (Number.isFinite(limitMinor) && Number.isFinite(usedMinor) && usedMinor > limitMinor) {
      nextErrors.used = "Used amount cannot exceed the spend limit.";
    }
    if (
      Number.isFinite(limitMinor) &&
      Number.isFinite(usedMinor) &&
      Number.isFinite(holdMinor) &&
      usedMinor + holdMinor > limitMinor
    ) {
      nextErrors.hold = "Used amount plus hold cannot exceed the spend limit.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await onSave({
          kind: "CARD",
          name: draft.name.trim(),
          provider: null,
          mask: draft.last4 ? `•••• ${draft.last4}` : null,
          limitMinor,
          usedMinor,
          holdMinor,
          overdueMinor,
          minDueMinor,
          todaySpendMinor: cycleSpendMinor,
          cycleStartOn: draft.cycleStartOn,
          dueOn: draft.dueOn,
          currency,
        });
    } catch {
      /* mutation onError already surfaced a toast */
    }
  }

  return (
    <form
      className="card-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="card-composer-grid">
        <div className="card-composer-main">
          <section className="card-section">
            <div className="card-section-head">
              <span className="card-section-icon">
                <CreditCard size={16} />
              </span>
              <h3>Card Information</h3>
            </div>
            <div className="card-fields">
              <Field label="Card name" error={errors.name}>
                <IconInput
                  icon={<UserRound size={13} />}
                  value={draft.name}
                  placeholder="e.g. HDFC Bank Credit Card"
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>
              <Field label="Last 4 digits" error={errors.last4}>
                <IconInput
                  icon={<CreditCard size={13} />}
                  value={draft.last4}
                  placeholder="e.g. 1234"
                  maxLength={4}
                  inputMode="numeric"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, last4: event.target.value.replace(/\D/g, "").slice(0, 4) }))
                  }
                />
              </Field>
              <Field label="Total spend limit (₹)" error={errors.limit}>
                <Input
                  inputMode="decimal"
                  placeholder="e.g. 1,50,000"
                  value={draft.limit}
                  onChange={(event) => setDraft((current) => ({ ...current, limit: event.target.value }))}
                />
              </Field>
              <Field label="Used amount (₹)" error={errors.used}>
                <Input
                  inputMode="decimal"
                  placeholder="e.g. 45,000"
                  value={draft.used}
                  onChange={(event) => setDraft((current) => ({ ...current, used: event.target.value }))}
                />
              </Field>
              <Field
                label="Credit hold amount (₹)"
                hint="Credit hold amount is the unbilled amount on hold by the bank."
                error={errors.hold}
              >
                <IconInput
                  icon={<Lock size={13} />}
                  inputMode="decimal"
                  placeholder="e.g. 0"
                  value={draft.hold}
                  onChange={(event) => setDraft((current) => ({ ...current, hold: event.target.value }))}
                />
              </Field>
              <Field
                label="Overdue amount (₹)"
                hint="Overdue amount is the pending due not paid yet."
                error={errors.overdue}
              >
                <IconInput
                  icon={<AlertTriangle size={13} />}
                  inputMode="decimal"
                  placeholder="e.g. 0"
                  value={draft.overdue}
                  onChange={(event) => setDraft((current) => ({ ...current, overdue: event.target.value }))}
                />
              </Field>
              <Field label="Current cycle spend (₹)" error={errors.cycleSpend}>
                <Input
                  inputMode="decimal"
                  placeholder="e.g. 8,500"
                  value={draft.cycleSpend}
                  onChange={(event) => setDraft((current) => ({ ...current, cycleSpend: event.target.value }))}
                />
              </Field>
              <Field
                label="Available limit (₹)"
                action={<span className="card-auto-tag">Auto calculated</span>}
              >
                <IconInput icon={<Lock size={13} />} readOnly tabIndex={-1} value={money(summary.availableMinor, currency)} />
              </Field>
              <Field
                label="Minimum due (₹)"
                hint="This is the amount Mark done will pay this cycle if nothing is overdue."
                error={errors.minDue}
              >
                <Input
                  inputMode="decimal"
                  placeholder="e.g. 3,000"
                  value={draft.minDue}
                  onChange={(event) => setDraft((current) => ({ ...current, minDue: event.target.value }))}
                />
              </Field>
            </div>
          </section>
          <section className="card-section">
            <div className="card-section-head">
              <span className="card-section-icon">
                <Calendar size={16} />
              </span>
              <h3>Billing Cycle</h3>
            </div>
            <div className="card-fields">
              <Field label="Billing start date" error={errors.cycleStartOn}>
                <DateInput
                  value={draft.cycleStartOn}
                  onChange={(event) => setDraft((current) => ({ ...current, cycleStartOn: event.target.value }))}
                />
              </Field>
              <Field
                label="Payment due date"
                hint="We'll use this to calculate your due dates and remaining limit."
                error={errors.dueOn}
              >
                <DateInput
                  value={draft.dueOn}
                  onChange={(event) => setDraft((current) => ({ ...current, dueOn: event.target.value }))}
                />
              </Field>
            </div>
          </section>
          <p className="card-banner">
            <Zap size={14} />
            Track your card usage, dues and spending easily
          </p>
        </div>
        <aside className="card-summary" aria-label="Live summary">
          <div className="card-section-head">
            <span className="card-section-icon">
              <TrendingUp size={16} />
            </span>
            <h3>Live Summary</h3>
          </div>
          <dl>
            <div>
              <dt>Total Spend Limit</dt>
              <dd>{money(summary.limitMinor, currency)}</dd>
            </div>
            <div>
              <dt>Used Amount</dt>
              <dd>{money(summary.usedMinor, currency)}</dd>
            </div>
            <div>
              <dt>Credit Hold Amount</dt>
              <dd>{money(summary.holdMinor, currency)}</dd>
            </div>
            <div>
              <dt>Current Cycle Spend</dt>
              <dd>{money(summary.todaySpendMinor, currency)}</dd>
            </div>
            <div>
              <dt>Overdue Amount</dt>
              <dd className="is-overdue">{money(summary.overdueMinor, currency)}</dd>
            </div>
            <div>
              <dt>Spend This Cycle</dt>
              <dd className="is-cycle">{money(summary.todaySpendMinor, currency)}</dd>
            </div>
            <div>
              <dt>Available Limit</dt>
              <dd className="is-available">{money(summary.availableMinor, currency)}</dd>
            </div>
          </dl>
          <div className="card-summary-ring">
            <small>Credit Limit Usage</small>
            <UsageRing pct={summary.usedPct} />
          </div>
          {draft.dueOn ? (
            <p className="card-due-tip">
              <Lightbulb size={14} />
              Pay your total due by {displayDateLong(draft.dueOn)} to avoid late fees and impact on credit score.
            </p>
          ) : null}
        </aside>
      </div>
      <div className="card-composer-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <CreditCard size={16} />
          {pending ? "Saving…" : existing ? "Update Card" : "Save Card"}
        </Button>
      </div>
    </form>
  );
}

function UsageRing({ pct }: { pct: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(100, Math.max(0, pct));
  return (
    <svg viewBox="0 0 120 120" width={148} height={148} className="loan-ring" role="img" aria-label={`${filled}% used`}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - filled / 100)}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="56" textAnchor="middle" className="loan-ring-pct">
        {formatPct(filled)}
      </text>
      <text x="60" y="74" textAnchor="middle" className="loan-ring-label">
        Used
      </text>
    </svg>
  );
}
