"use client";

import type { CreditFacility, CreditSpendingSlice, CreditUtilisationMonth } from "@hisaab/types";
import { Badge, Button, Card, Field, Input } from "@hisaab/ui";
import {
  cardDueAmount,
  cardPaidThisCycle,
  creditOverview,
  creditSummary,
  daysUntil,
  emiDueCopy,
  majorToMinor,
} from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CreditCard,
  Download,
  IndianRupee,
  Lightbulb,
  Lock,
  MoreVertical,
  PieChart as PieIcon,
  Plus,
  TrendingUp,
  UserRound,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import {
  CartesianGrid,
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
import { ProgressBar } from "@/components/layout/chrome";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { displayDate, displayDateLong, isoPlusDays, isoToday, sumMinor } from "@/lib/finance-modules";
import { money } from "@/lib/format";
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

const USED_COLOR = "#4d8ec8";
const AVAILABLE_COLOR = "#8b7cc9";
const OVERDUE_COLOR = "var(--danger)";

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

function monthLabel(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, 1),
  );
}

function isCardOverdue(card: CreditFacility) {
  if (card.overdueMinor > 0) return true;
  return Boolean(card.dueOn && daysUntil(card.dueOn) < 0);
}

function canPayCard(card: CreditFacility) {
  return cardDueAmount(card) > 0 && !cardPaidThisCycle(card.lastPaidOn, card.dueOn);
}

function dueTone(card: CreditFacility) {
  if (!card.dueOn) return null;
  const copy = emiDueCopy(card.dueOn);
  if (copy.tone === "overdue") return { tone: "overdue" as const, label: "Overdue" };
  return { tone: "upcoming" as const, label: copy.tone === "pending" ? "Due today" : "Upcoming" };
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
  const pending = create.isPending || update.isPending;

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

  async function handleSaved(addAnother = false) {
    await client.invalidateQueries({ queryKey: ["credit-facilities"] });
    await client.invalidateQueries({ queryKey: ["credit-dashboard"] });
    toast.success(editing ? "Card updated" : "Card saved");
    if (addAnother && !editing) {
      setFormKey((value) => value + 1);
      return;
    }
    setScreen("list");
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        title="Credit Cards"
        description="Track limits, utilisation, due dates and overdue amounts."
        actions={<Button onClick={openAdd}>Add Card</Button>}
      />
      <div className="cards-hero">
        {(
          [
            {
              label: "Total Limit",
              value: money(overview.limitMinor, currency),
              note: `${list.length} card${list.length === 1 ? "" : "s"}`,
              icon: CreditCard,
              tone: "green",
            },
            {
              label: "Used Amount",
              value: money(overview.usedMinor, currency),
              note: `${formatPct(overview.usedPct)} of total limit`,
              icon: Wallet,
              tone: "blue",
            },
            {
              label: "Available Limit",
              value: money(overview.availableMinor, currency),
              note: `${formatPct(overview.availablePct)} remaining`,
              icon: IndianRupee,
              tone: "purple",
            },
          ] as Array<{ label: string; value: string; note: string; icon: LucideIcon; tone: string }>
        ).map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="loans-kpi">
              <span className={`loans-kpi-icon is-${item.tone}`}>
                <Icon size={16} />
              </span>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <span>{item.note}</span>
              </div>
            </Card>
          );
        })}
        <PlasticCard card={list[0]} onAdd={openAdd} />
      </div>
      {list.length ? (
        <div className="cards-board">
          <div className="cards-board-main">
            <div className="cards-charts">
              <UtilisationTrend currency={currency} trend={dashboard.data?.trend ?? []} />
              <UtilisationOverview currency={currency} overview={overview} />
            </div>
            <CardsTable
              cards={list}
              currency={currency}
              onEdit={openEdit}
              onPay={setPaying}
              onDelete={setDeleting}
            />
          </div>
          <aside className="cards-board-side">
            <UpcomingPayments cards={upcoming} currency={currency} onPay={setPaying} />
            <QuickActions
              onAdd={openAdd}
              onSummary={() =>
                document.getElementById("cards-utilisation")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              onRemind={() =>
                toast.info("Reminders use each card's payment due date in Upcoming payments.")
              }
              onDownload={() => {
                downloadCardsCsv(list);
                toast.success("Card summary downloaded");
              }}
            />
            <SpendingByCategory currency={currency} spending={dashboard.data?.spending ?? []} />
          </aside>
        </div>
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
          onSave={async (body, addAnother) => {
            if (editing) {
              await update.mutateAsync({ id: editing.id, body });
            } else {
              await create.mutateAsync(body);
            }
            await handleSaved(addAnother);
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

function PlasticCard({ card, onAdd }: { card?: CreditFacility; onAdd: () => void }) {
  return (
    <div className="cards-plastic">
      <small>Hisaab</small>
      <strong>{card?.name ?? "Add your first card"}</strong>
      <em>{card?.mask ?? "•••• ••••"}</em>
      <Button type="button" onClick={onAdd}>
        <Plus size={14} />
        Add Card
      </Button>
    </div>
  );
}

function UtilisationTrend({
  currency,
  trend,
}: {
  currency: string;
  trend: CreditUtilisationMonth[];
}) {
  const data = trend.map((item) => ({ ...item, label: monthLabel(item.month) }));
  return (
    <Card className="cards-chart">
      <header>
        <div>
          <h2>Credit utilisation trend</h2>
          <small>From saved month snapshots — not estimated.</small>
        </div>
      </header>
      {data.length ? (
        <div className="cards-chart-body">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" width={42} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const point = item?.payload as CreditUtilisationMonth | undefined;
                  if (!point) return [`${value}%`, "Used"];
                  return [`${formatPct(point.usedPct)} · ${money(point.usedMinor, currency)}`, "Used"];
                }}
              />
              <Line type="monotone" dataKey="usedPct" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p>Usage history starts after you save a card.</p>
      )}
    </Card>
  );
}

function UtilisationOverview({
  currency,
  overview,
}: {
  currency: string;
  overview: ReturnType<typeof creditOverview>;
}) {
  const overdueSlice = Math.min(overview.overdueMinor, overview.usedMinor);
  const currentUsed = Math.max(0, overview.usedMinor - overdueSlice);
  const slices = [
    { name: "Used", value: currentUsed, color: USED_COLOR, amount: overview.usedMinor, pct: overview.usedPct },
    { name: "Available", value: overview.availableMinor, color: AVAILABLE_COLOR, amount: overview.availableMinor, pct: overview.availablePct },
    { name: "Overdue", value: overdueSlice, color: OVERDUE_COLOR, amount: overview.overdueMinor, pct: overview.overduePct },
  ].filter((item) => item.value > 0);
  const hasData = overview.limitMinor > 0;
  return (
    <Card className="cards-chart" id="cards-utilisation">
      <header>
        <div>
          <h2>Utilisation overview</h2>
          <small>{money(overview.usedMinor, currency)} used of {money(overview.limitMinor, currency)}</small>
        </div>
      </header>
      {hasData ? (
        <div className="cards-donut">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={slices} dataKey="value" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none">
                {slices.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [money(Number(value) || 0, currency), String(name)]} />
            </PieChart>
          </ResponsiveContainer>
          <ul>
            {slices.map((slice) => (
              <li key={slice.name}>
                <i style={{ background: slice.color }} />
                <span>{slice.name}</span>
                <b>
                  {money(slice.amount, currency)}
                  <small>{formatPct(slice.pct)}</small>
                </b>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>Add a spend limit to see utilisation.</p>
      )}
    </Card>
  );
}

function CardsTable({
  cards,
  currency,
  onEdit,
  onPay,
  onDelete,
}: {
  cards: CreditFacility[];
  currency: string;
  onEdit: (card: CreditFacility) => void;
  onPay: (card: CreditFacility) => void;
  onDelete: (card: CreditFacility) => void;
}) {
  return (
    <Card className="cards-table-wrap">
      <header>
        <div>
          <h2>Your credit cards</h2>
          <small>Limits, usage, due dates and minimum due.</small>
        </div>
      </header>
      <div className="cards-table-scroll">
        <table className="cards-table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Total limit</th>
              <th>Used</th>
              <th>Available</th>
              <th>Due date</th>
              <th>Min. due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => {
              const summary = creditSummary(card);
              const due = dueTone(card);
              const overdue = isCardOverdue(card);
              return (
                <tr key={card.id}>
                  <td>
                    <div className="cards-table-name">
                      <span className="cards-table-icon">
                        <CreditCard size={15} />
                      </span>
                      <div>
                        <strong>{card.name}</strong>
                        <small>{card.mask || "Card"}</small>
                      </div>
                    </div>
                  </td>
                  <td>{money(card.limitMinor, currency)}</td>
                  <td>
                    <div className="cards-table-bar">
                      <b>
                        {money(card.usedMinor, currency)}
                        <small>{formatPct(summary.usedPct)}</small>
                      </b>
                      <ProgressBar value={summary.usedPct} tone={summary.usedPct > 70 ? "warn" : "ok"} />
                    </div>
                  </td>
                  <td>{money(summary.availableMinor, currency)}</td>
                  <td>
                    <div className="cards-table-due">
                      <b>{displayDate(card.dueOn)}</b>
                      {due ? <span className={`cards-pill is-${due.tone}`}>{due.label}</span> : null}
                    </div>
                  </td>
                  <td>{money(card.minDueMinor ?? 0, currency)}</td>
                  <td>
                    <Badge tone={overdue ? "danger" : "success"}>{overdue ? "Overdue" : "Active"}</Badge>
                  </td>
                  <td>
                    <CardMenu
                      card={card}
                      onEdit={() => onEdit(card)}
                      onPay={() => onPay(card)}
                      onDelete={() => onDelete(card)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          <small>Statement dues on your cards.</small>
        </div>
      </header>
      {cards.length ? (
        <ul>
          {cards.map((card) => {
            const due = dueTone(card);
            const amount = cardDueAmount(card);
            return (
              <li key={card.id}>
                <span className={`loan-card-icon is-${due?.tone ?? "upcoming"}`}>
                  <CreditCard size={16} />
                </span>
                <div>
                  <strong>{card.name}</strong>
                  <small>
                    {card.mask || "Card"}
                    {card.dueOn ? ` · ${displayDate(card.dueOn)}` : ""}
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

function QuickActions({
  onAdd,
  onSummary,
  onRemind,
  onDownload,
}: {
  onAdd: () => void;
  onSummary: () => void;
  onRemind: () => void;
  onDownload: () => void;
}) {
  return (
    <Card className="cards-actions">
      <h2>Quick actions</h2>
      <div className="cards-actions-grid">
        <button type="button" onClick={onAdd}>
          <Plus size={16} />
          Add Card
        </button>
        <button type="button" onClick={onSummary}>
          <PieIcon size={16} />
          Card Summary
        </button>
        <button type="button" onClick={onRemind}>
          <Bell size={16} />
          Set Reminder
        </button>
        <button type="button" onClick={onDownload}>
          <Download size={16} />
          Download Report
        </button>
      </div>
    </Card>
  );
}

function SpendingByCategory({
  currency,
  spending,
}: {
  currency: string;
  spending: CreditSpendingSlice[];
}) {
  const total = sumMinor(spending, (item) => item.amountMinor);
  return (
    <Card className="cards-spend">
      <header>
        <div>
          <h2>Spending by category</h2>
          <small>This month, from card-linked transactions.</small>
        </div>
      </header>
      {spending.length ? (
        <>
          <div className="cards-donut is-compact">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={spending} dataKey="amountMinor" innerRadius={38} outerRadius={56} paddingAngle={2} stroke="none">
                  {spending.map((slice) => (
                    <Cell key={slice.id} fill={slice.colour || "var(--primary)"} />
                  ))}
                </Pie>
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
  onSave: (body: unknown, addAnother?: boolean) => Promise<void>;
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

  async function submit(addAnother = false) {
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
      await onSave(
        {
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
        },
        addAnother,
      );
    } catch {
      /* mutation onError already surfaced a toast */
    }
  }

  return (
    <form
      className="card-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
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
        <div className="card-composer-save">
          {existing ? null : (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void submit(true)}>
              Save & Add Another
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            <CreditCard size={16} />
            {pending ? "Saving…" : existing ? "Update Card" : "Save Card"}
          </Button>
        </div>
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
