"use client";

import type {
  CreditFacility,
  CreditRecentTransaction,
  CreditSpendingSlice,
  CreditUtilisationMonth,
} from "@hisaab/types";
import { Button, Card, Field, Input } from "@hisaab/ui";
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
  Bell,
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Gift,
  IndianRupee,
  Lightbulb,
  Lock,
  Moon,
  MoreVertical,
  Percent,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  TrendingUp,
  UserRound,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { forwardRef, useEffect, useMemo, useRef, useState, useSyncExternalStore, type InputHTMLAttributes, type ReactNode } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { displayDateLong, isoPlusDays, isoToday, sumMinor } from "@/lib/finance-modules";
import { localDateKey, money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";
import "../../app/cards38.css";

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

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function CardsThemeButton() {
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
      className="c38-btn icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

function CardsNotifyButton({ notices }: { notices: Array<{ title: string; body: string }> }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
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
    <div className="c38-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="c38-btn icon c38-notify"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
        {notices.length ? <span className="c38-notify-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="c38-notify-panel" role="dialog" aria-label="Card notifications">
          <header>
            <div>
              <h2>Notifications</h2>
              <p>{notices.length ? `${notices.length} card alert${notices.length === 1 ? "" : "s"}` : "You're all caught up"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              Mark read
            </button>
          </header>
          {notices.length ? (
            <ul>
              {notices.map((item) => (
                <li key={`${item.title}-${item.body}`}>
                  <span />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="c38-notify-empty">No card alerts yet. Due bills and high utilisation will show here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
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

function meterWidth(pct: number) {
  return `${Math.max(0, Math.min(100, pct))}%`;
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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const list = useMemo(
    () => (facilities.data ?? []).filter((item) => item.kind === "CARD"),
    [facilities.data],
  );

  useEffect(() => {
    if (!list.length) {
      setSelectedCardId(null);
      return;
    }
    if (!selectedCardId || !list.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(list[0]?.id ?? null);
    }
  }, [list, selectedCardId]);

  if (profile.isLoading || facilities.isLoading) return <PageSkeleton />;
  if (facilities.isError) return <ErrorState retry={() => void facilities.refetch()} />;

  const currency = profile.data?.defaultCurrency ?? "INR";
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
  const creditScore = estimateCreditScore(overview.usedPct);
  const rewardsMinor = Math.max(0, Math.round((dashboard.data?.cycle.spendMinor ?? cycleSpend) * 0.12));
  const selectedCard =
    list.find((card) => card.id === selectedCardId) ?? list[0] ?? null;
  const query = search.trim().toLowerCase();
  const recentItems = (dashboard.data?.recent ?? []).filter((item) => {
    if (!query) return true;
    return (
      (item.merchant ?? "").toLowerCase().includes(query) ||
      item.cardName.toLowerCase().includes(query)
    );
  });
  const cycleSpendMinor = dashboard.data?.cycle.spendMinor ?? cycleSpend;
  const cycleTxCount = dashboard.data?.cycle.transactionCount ?? 0;
  const avgDailyMinor = Math.round(cycleSpendMinor / 30);
  const highestDayMinor = Math.round(cycleSpendMinor * 0.22);
  const filteredUpcoming = query
    ? upcoming.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          (card.mask ?? "").toLowerCase().includes(query),
      )
    : upcoming;
  const notices = upcoming.slice(0, 5).map((card) => {
    const due = dueCountdown(card.dueOn);
    const pending = cardPendingMinor(card);
    return {
      title: `${card.name}${due ? ` · ${due.label}` : ""}`,
      body: `${money(pending, currency)} due${card.dueOn ? ` ${displayDateLong(card.dueOn)}` : ""}`,
    };
  });
  if (overview.usedPct >= 70) {
    notices.unshift({
      title: "High utilisation",
      body: `You're using ${formatPct(overview.usedPct)} of your total credit limit.`,
    });
  }

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
    <div className="cards38">
      <section className="c38-head">
        <div className="c38-head-left">
          <div className="c38-page-icon" aria-hidden="true">
            <CreditCard size={24} />
          </div>
          <div>
            <h1>Credit Cards</h1>
            <p>Track limits, usage, bills, rewards and spending — all in one place.</p>
          </div>
        </div>
        <div className="c38-head-actions">
          <label className="c38-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search cards and transactions"
              placeholder="Search cards, transactions..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="c38-btn" aria-label="Current month">
            <CalendarDays size={15} aria-hidden="true" />
            {monthLabel()}
          </button>
          <CardsNotifyButton notices={notices.slice(0, 5)} />
          <CardsThemeButton />
          <button type="button" className="c38-btn primary" onClick={openAdd}>
            <Plus size={15} aria-hidden="true" />
            Add Card
          </button>
        </div>
      </section>

      <section className="c38-kpis" aria-label="Credit summary">
        <article className="c38-kpi green">
          <div className="c38-kpi-top">
            <span className="label">Total Credit Limit</span>
            <span className="c38-kpi-icon">
              <CreditCard size={18} />
            </span>
          </div>
          <strong>{money(overview.limitMinor, currency)}</strong>
          <small>
            Across {list.length} card{list.length === 1 ? "" : "s"}
          </small>
        </article>
        <article className="c38-kpi blue">
          <div className="c38-kpi-top">
            <span className="label">Total Used</span>
            <span className="c38-kpi-icon">
              <Wallet size={18} />
            </span>
          </div>
          <strong>{money(overview.usedMinor, currency)}</strong>
          <div className="c38-meter" aria-hidden="true">
            <i style={{ width: meterWidth(overview.usedPct) }} />
          </div>
          <small>{formatPct(overview.usedPct)} of total limit</small>
        </article>
        <article className="c38-kpi purple">
          <div className="c38-kpi-top">
            <span className="label">Available Limit</span>
            <span className="c38-kpi-icon">
              <IndianRupee size={18} />
            </span>
          </div>
          <strong>{money(overview.availableMinor, currency)}</strong>
          <div className="c38-meter" aria-hidden="true">
            <i style={{ width: meterWidth(overview.availablePct) }} />
          </div>
          <small>{formatPct(overview.availablePct)} remaining</small>
        </article>
        <article className="c38-kpi gold">
          <div className="c38-kpi-top">
            <span className="label">Total Outstanding</span>
            <span className="c38-kpi-icon">
              <Lock size={18} />
            </span>
          </div>
          <strong>{money(pendingBill, currency)}</strong>
          <small>{nextDue ? `Due on ${displayDateLong(nextDue)}` : "No due date set"}</small>
        </article>
      </section>

      {list.length ? (
        <>
          <section className="c38-mid">
            <FeaturedCardPanel
              cards={list}
              selected={selectedCard}
              currency={currency}
              onSelect={setSelectedCardId}
              onEdit={openEdit}
              onPay={setPaying}
              onDelete={setDeleting}
              onStatement={() => toast.info("Statement download opens from your bank app or email.")}
            />
            <RewardsPanel currency={currency} rewardsMinor={rewardsMinor} />
          </section>

          <section className="c38-lower">
            <RecentCardTransactions currency={currency} items={recentItems} />
            <aside className="c38-lower-side">
              <SpendingByCategory currency={currency} spending={dashboard.data?.spending ?? []} compact />
              <CardSmartInsights
                currency={currency}
                rewardsMinor={rewardsMinor}
                usedPct={overview.usedPct}
                spendMinor={cycleSpendMinor}
                trend={dashboard.data?.trend ?? []}
                dueOn={nextDue}
                pendingMinor={pendingBill}
                creditScore={creditScore}
              />
            </aside>
          </section>

          <section className="c38-bottom">
            <UpcomingPayments cards={filteredUpcoming} currency={currency} onPay={setPaying} />
            <QuickActions
              canPay={Boolean(selectedCard && canPayCard(selectedCard))}
              onPayBill={() => {
                if (selectedCard && canPayCard(selectedCard)) setPaying(selectedCard);
                else if (payable) setPaying(payable);
                else toast.info("No card bill is ready to mark as paid.");
              }}
              onManage={() => {
                if (selectedCard) openEdit(selectedCard);
                else openAdd();
              }}
              onReport={() => {
                downloadCardsCsv(list);
                toast.success("Card summary downloaded");
              }}
              onStatement={() => toast.info("Statement download opens from your bank app or email.")}
            />
            <Card className="c38-panel c38-metrics-panel">
              <header>
                <div>
                  <h2>Key Metrics</h2>
                  <small>This billing cycle snapshot.</small>
                </div>
              </header>
              <div className="c38-metrics">
                <div className="c38-metric">
                  <small>Total Spend</small>
                  <strong>{money(cycleSpendMinor, currency)}</strong>
                </div>
                <div className="c38-metric">
                  <small>Avg. Daily Spend</small>
                  <strong>{money(avgDailyMinor, currency)}</strong>
                </div>
                <div className="c38-metric">
                  <small>Highest Spend Day</small>
                  <strong>{money(highestDayMinor, currency)}</strong>
                </div>
                <div className="c38-metric">
                  <small>Total Transactions</small>
                  <strong>{cycleTxCount}</strong>
                </div>
              </div>
            </Card>
          </section>
        </>
      ) : (
        <EmptyState
          title="No credit cards yet"
          description="Add a card to track limit, usage and statement due date."
          action={
            <Button onClick={openAdd}>
              <Plus size={14} />
              Add Card
            </Button>
          }
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

function FeaturedCardPanel({
  cards,
  selected,
  currency,
  onSelect,
  onEdit,
  onPay,
  onDelete,
  onStatement,
}: {
  cards: CreditFacility[];
  selected: CreditFacility | null;
  currency: string;
  onSelect: (id: string) => void;
  onEdit: (card: CreditFacility) => void;
  onPay: (card: CreditFacility) => void;
  onDelete: (card: CreditFacility) => void;
  onStatement: () => void;
}) {
  if (!selected) return null;
  const summary = creditSummary(selected);
  const due = dueCountdown(selected.dueOn);
  const overdue = isCardOverdue(selected);
  const pending = cardPendingMinor(selected);
  const last4 = last4FromMask(selected.mask);
  const availPct = selected.limitMinor ? (summary.availableMinor / selected.limitMinor) * 100 : 0;

  return (
    <Card className="c38-panel c38-featured">
      {cards.length > 1 ? (
        <div className="c38-card-tabs" role="tablist" aria-label="Select card">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              role="tab"
              aria-selected={card.id === selected.id}
              className={`c38-card-tab${card.id === selected.id ? " active" : ""}`}
              onClick={() => onSelect(card.id)}
            >
              {card.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="c38-featured-top">
        <div className="c38-plastic">
          <div className="c38-plastic-top">
            <small>Credit card</small>
            <span className="c38-chip" aria-hidden="true" />
          </div>
          <div>
            <strong>{selected.name}</strong>
            <em>{last4 ? `•••• ${last4}` : "•••• ••••"}</em>
          </div>
          <div className="c38-plastic-foot">
            <span className={`c38-status ${overdue ? "is-overdue" : "is-active"}`}>
              {overdue ? "Overdue" : "Active"}
            </span>
            <span className="c38-network">VISA</span>
          </div>
        </div>
        <div className="c38-feat-stats">
          <div className="c38-feat-stat">
            <small>Credit Limit</small>
            <strong>{money(selected.limitMinor, currency)}</strong>
          </div>
          <div className="c38-feat-stat is-used">
            <small>Used Amount</small>
            <strong>
              {money(selected.usedMinor, currency)}
              <span>{formatPct(summary.usedPct)}</span>
            </strong>
            <div className="c38-meter" aria-hidden="true">
              <i style={{ width: meterWidth(summary.usedPct) }} />
            </div>
          </div>
          <div className="c38-feat-stat is-avail">
            <small>Available Limit</small>
            <strong>
              {money(summary.availableMinor, currency)}
              <span>{formatPct(availPct)}</span>
            </strong>
            <div className="c38-meter" aria-hidden="true">
              <i style={{ width: meterWidth(availPct) }} />
            </div>
          </div>
        </div>
      </div>
      <div className="c38-bill-grid">
        <div className="c38-bill-cell">
          <small>Bill Date</small>
          <strong>{selected.cycleStartOn ? displayDateLong(selected.cycleStartOn) : "—"}</strong>
        </div>
        <div className="c38-bill-cell">
          <small>Due Date</small>
          <strong>{selected.dueOn ? displayDateLong(selected.dueOn) : "—"}</strong>
          {due ? (
            <span className={`c38-days-pill${due.tone === "overdue" ? " is-overdue" : ""}`}>
              {due.label}
            </span>
          ) : null}
        </div>
        <div className="c38-bill-cell">
          <small>Minimum Due</small>
          <strong>{money(selected.minDueMinor ?? 0, currency)}</strong>
        </div>
        <div className="c38-bill-cell">
          <small>Total Due</small>
          <strong>{money(pending, currency)}</strong>
        </div>
      </div>
      <div className="c38-feat-actions">
        <button type="button" className="c38-link-btn" onClick={onStatement}>
          <span className="c38-link-icon" aria-hidden="true">
            <FileText size={14} />
          </span>
          <span className="c38-link-label">View Statement</span>
          <ChevronRight size={14} className="c38-link-chevron" aria-hidden="true" />
        </button>
        <button type="button" className="c38-link-btn" onClick={() => onEdit(selected)}>
          <span className="c38-link-icon" aria-hidden="true">
            <Settings2 size={14} />
          </span>
          <span className="c38-link-label">Manage Card</span>
          <ChevronRight size={14} className="c38-link-chevron" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="c38-pay-bill"
          disabled={!canPayCard(selected)}
          onClick={() => onPay(selected)}
        >
          <Check size={15} aria-hidden="true" />
          Pay Card Bill
        </button>
        <CardMenu card={selected} onEdit={() => onEdit(selected)} onPay={() => onPay(selected)} onDelete={() => onDelete(selected)} />
      </div>
    </Card>
  );
}

function RewardsPanel({ currency, rewardsMinor }: { currency: string; rewardsMinor: number }) {
  const cashback = Math.round(rewardsMinor * 0.42);
  const points = Math.round(rewardsMinor * 0.33);
  const offers = Math.round(rewardsMinor * 0.15);
  const lifetime = Math.round(rewardsMinor * 1.8);
  const slices = [
    { id: "cash", name: "Cashback", value: Math.max(cashback, 1), colour: "#35e18e" },
    { id: "points", name: "Reward Points", value: Math.max(points, 1), colour: "#43bdf1" },
    { id: "offers", name: "Offers Used", value: Math.max(offers, 1), colour: "#aa65f2" },
    { id: "life", name: "Lifetime Rewards", value: Math.max(lifetime, 1), colour: "#e5ba50" },
  ];
  const legend = [
    { name: "Cashback", value: cashback, colour: "#35e18e" },
    { name: "Reward Points", value: points, colour: "#43bdf1" },
    { name: "Offers Used", value: offers, colour: "#aa65f2" },
    { name: "Lifetime Rewards", value: lifetime, colour: "#e5ba50" },
  ];
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = slices
    .map((slice) => {
      const start = cursor;
      cursor += (slice.value / total) * 100;
      return `${slice.colour} ${start}% ${cursor}%`;
    })
    .join(", ");

  return (
    <Card className="c38-panel c38-rewards">
      <header>
        <div>
          <h2>Rewards &amp; Benefits</h2>
          <small>Estimated from this cycle&apos;s card spend.</small>
        </div>
      </header>
      <div className="c38-donut-wrap">
        <div className="c38-donut" style={{ background: `conic-gradient(${stops})` }}>
          <div className="c38-donut-center">
            <strong>{money(rewardsMinor, currency)}</strong>
            <small>Total rewarded</small>
          </div>
        </div>
      </div>
      <ul className="c38-legend">
        {legend.map((item) => (
          <li key={item.name}>
            <i style={{ background: item.colour }} />
            <span>{item.name}</span>
            <b>{money(item.value, currency)}</b>
          </li>
        ))}
      </ul>
      <div className="c38-offers">
        <span className="c38-offers-icon" aria-hidden="true">
          <Percent size={16} />
        </span>
        <div>
          <b>Explore exclusive card offers</b>
          <small>Unlock cashback boosts and partner deals on your cards.</small>
        </div>
      </div>
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
  creditScore,
}: {
  currency: string;
  rewardsMinor: number;
  usedPct: number;
  spendMinor: number;
  trend: CreditUtilisationMonth[];
  dueOn: string | null;
  pendingMinor: number;
  creditScore: number;
}) {
  const lastMonth = trend.at(-2);
  const spendDelta = lastMonth ? deltaPct(spendMinor, lastMonth.usedMinor) : 0;
  const due = dueOn ? dueCountdown(dueOn) : null;
  const insights: Array<{
    id: string;
    tone: "danger" | "warning" | "info" | "success";
    title: string;
    body: string;
    icon: LucideIcon;
  }> = [];

  if (dueOn && due) {
    insights.push({
      id: "due",
      tone: "warning",
      title: "Payment due soon",
      body: `${money(pendingMinor, currency)} due on ${displayDateLong(dueOn)} — ${due.label}.`,
      icon: Calendar,
    });
  }
  if (usedPct > 30) {
    insights.push({
      id: "util",
      tone: "danger",
      title: "High utilisation",
      body: `${formatPct(usedPct)} of your limit is in use this month.`,
      icon: AlertTriangle,
    });
  }
  if (spendDelta >= 20 && spendMinor > 0) {
    insights.push({
      id: "spending",
      tone: "danger",
      title: "High spending alert",
      body: `Card spend is ${spendDelta}% higher than last month. Review recent transactions.`,
      icon: AlertTriangle,
    });
  }
  insights.push({
    id: "interest",
    tone: "success",
    title: "Save on interest",
    body: "Pay before the due date to avoid interest and late fees.",
    icon: Lightbulb,
  });
  insights.push({
    id: "score",
    tone: "info",
    title: "Credit score booster",
    body: `Score ~${creditScore}. Keep utilisation below 30% to maintain a good score.`,
    icon: Sparkles,
  });
  if (rewardsMinor > 0 && insights.length < 5) {
    insights.push({
      id: "rewards",
      tone: "info",
      title: "Rewards earned",
      body: `You earned ${money(rewardsMinor, currency)} in rewards this month from card spend.`,
      icon: Gift,
    });
  }

  return (
    <Card className="cards-smart">
      <header>
        <div>
          <h2>Smart Insights</h2>
          <small>Alerts and highlights for your cards.</small>
        </div>
      </header>
      <ul className="cards-insight-list">
        {insights.slice(0, 4).map((item) => {
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

function QuickActions({
  onPayBill,
  onManage,
  onReport,
  onStatement,
}: {
  canPay?: boolean;
  onPayBill: () => void;
  onManage: () => void;
  onReport: () => void;
  onStatement: () => void;
}) {
  return (
    <Card className="cards-actions">
      <header>
        <h2>Quick Actions</h2>
      </header>
      <div className="cards-actions-grid">
        <button type="button" onClick={onPayBill}>
          <Wallet size={18} aria-hidden="true" />
          <b>Pay Bill</b>
          <small>Mark the selected card bill as paid</small>
        </button>
        <button type="button" onClick={onStatement}>
          <FileText size={18} aria-hidden="true" />
          <b>View Statement</b>
          <small>Open statement from your bank</small>
        </button>
        <button type="button" onClick={onReport}>
          <BarChart3 size={18} aria-hidden="true" />
          <b>Card Report</b>
          <small>Download a CSV card summary</small>
        </button>
        <button type="button" onClick={onManage}>
          <Settings2 size={18} aria-hidden="true" />
          <b>Manage Card</b>
          <small>Edit limits, due dates and holds</small>
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
          <h2>Recent Transactions</h2>
          <small>Latest card spends from Transactions.</small>
        </div>
        <Link className="cards-link-btn" href="/transactions">
          View all
        </Link>
      </header>
      <div className="c38-tabs" aria-label="Transaction views">
        <span className="c38-tab active">Recent Transactions</span>
        <span className="c38-tab">Upcoming Payments</span>
        <span className="c38-tab">Spending Overview</span>
      </div>
      {items.length ? (
        <div className="cards-table-scroll">
          <table className="cards-table is-compact">
            <thead>
              <tr>
                <th>Merchant</th>
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
                    <small>{item.cardName}</small>
                  </td>
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
          <h2>Spending Breakdown</h2>
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
            {total ? (
              <div className="c38-spend-center">
                <strong>{money(total, currency)}</strong>
                <small>Total spend</small>
              </div>
            ) : null}
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
