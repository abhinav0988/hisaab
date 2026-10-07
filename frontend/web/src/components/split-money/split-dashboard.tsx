"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronDown,
  Filter,
  HandCoins,
  MoreHorizontal,
  PlayCircle,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
  Wifi,
} from "lucide-react";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { avatarTone, initials, statusLabel } from "./split-format";

function Stat({
  icon,
  title,
  value,
  note,
  tone,
  noteTone = "up",
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string | null;
  tone: string;
  noteTone?: "up" | "down" | "muted";
}) {
  return (
    <article className={`sm-stat ${tone}`}>
      <span>{icon}</span>
      <div>
        <b>{value}</b>
        <p>{title}</p>
      </div>
      {note ? (
        <small className={noteTone === "down" ? "down" : noteTone === "muted" ? "muted" : undefined}>
          {note}
          <br />
          vs last month
        </small>
      ) : null}
    </article>
  );
}

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("food") || n.includes("dining")) return <UtensilsCrossed size={13} />;
  if (n.includes("travel")) return <Send size={13} />;
  if (n.includes("shop")) return <ShoppingBag size={13} />;
  if (n.includes("bill") || n.includes("util") || n.includes("electric") || n.includes("wifi"))
    return <Wifi size={13} />;
  return <MoreHorizontal size={13} />;
}

function expenseIcon(category: string) {
  const n = category.toLowerCase();
  if (n.includes("food") || n.includes("dining")) return "food";
  if (n.includes("travel")) return "travel";
  if (n.includes("shop")) return "shop";
  if (n.includes("bill") || n.includes("util")) return "bill";
  return "bill";
}

function formatExpenseWhen(date: string, time: string | null) {
  const d = new Date(`${date}T${time || "12:00"}:00`);
  if (Number.isNaN(d.getTime())) {
    return time ? `${date} · ${time}` : date;
  }
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
  const clock = time
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(d)
    : null;
  return clock ? `${day} · ${clock}` : day;
}

function formatDue(date: string | null) {
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
}

function displayStatus(status: string, settledPercent?: number) {
  if (status === "settled" || status === "paid") return "Settled";
  if (status === "partially_paid" || status === "partially_settled") {
    if ((settledPercent ?? 0) >= 80) return "Almost Settled";
    return "Partially Settled";
  }
  return statusLabel(status);
}

function displayStatusClass(status: string, settledPercent?: number) {
  const label = displayStatus(status, settledPercent);
  return label.toLowerCase().replaceAll(" ", "-");
}

export function SplitDashboard({
  onCreate,
  onOpenExpense,
  onTab,
}: {
  onCreate: () => void;
  onOpenExpense: (id: string) => void;
  onTab: (tab: "groups" | "people" | "history" | "settlements" | "import") => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState("Overview");

  const dashQuery = useQuery({
    queryKey: ["split-money", "dashboard"],
    queryFn: () => splitMoneyService.dashboard(),
  });

  const summary = dashQuery.data?.summary;
  const expenses = dashQuery.data?.recentExpenses ?? [];
  const categories = dashQuery.data?.topCategories ?? [];
  const upcoming = dashQuery.data?.upcomingSettlements ?? [];
  const hasActivity = (summary?.totalSharedMinor ?? 0) > 0;

  const shown = useMemo(() => {
    return expenses.filter((x) => {
      const matchesQuery =
        !query ||
        x.title.toLowerCase().includes(query.toLowerCase()) ||
        x.category.toLowerCase().includes(query.toLowerCase()) ||
        (x.group?.name ?? "").toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (filter === "All") return true;
      if (filter === "You Owe") return (x.yourShareMinor ?? 0) > (x.youPaidMinor ?? 0);
      if (filter === "You Are Owed") return (x.youPaidMinor ?? 0) > (x.yourShareMinor ?? 0);
      if (filter === "Partially Paid")
        return x.status === "partially_paid" || x.status === "partially_settled";
      if (filter === "Settled") return x.status === "settled";
      if (filter === "Overdue") return x.status === "overdue";
      return statusLabel(x.status).includes(filter);
    });
  }, [expenses, filter, query]);

  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  if (dashQuery.isLoading) {
    return (
      <main className="sm-page">
        <p className="sm-kicker">SHARED FINANCES</p>
        <h1>Split Money</h1>
        <p>Loading dashboard…</p>
      </main>
    );
  }

  if (dashQuery.isError) {
    return (
      <main className="sm-page">
        <h1>Split Money</h1>
        <p className="danger">Could not load Split Money. Please retry.</p>
        <button className="sm-primary" type="button" onClick={() => void dashQuery.refetch()}>
          Retry
        </button>
      </main>
    );
  }

  const settledPct = summary?.settledPercent ?? 0;
  const total = summary?.totalSharedMinor || 1;
  const paidPct = Math.min(100, Math.round(((summary?.collectedMinor ?? 0) / total) * 100));
  const overduePct = Math.min(
    100 - paidPct,
    Math.round(((summary?.overdueMinor ?? 0) / total) * 100),
  );
  const pendingPct = Math.max(0, 100 - paidPct - overduePct);

  const rightRail = (
    <aside className="sm-rail">
      <section className="sm-panel sm-qa-card">
        <div className="sm-rail-title">
          <h2>Quick Actions</h2>
          <p>Common next steps</p>
        </div>
        <div className="sm-qa-grid">
          <button type="button" onClick={onCreate}>
            <span className="sm-qa-icon">
              <Plus size={18} />
            </span>
            Split Expense
          </button>
          <button type="button" onClick={() => onTab("groups")}>
            <span className="sm-qa-icon">
              <Users size={18} />
            </span>
            Create Group
          </button>
          <button type="button" onClick={() => onTab("people")}>
            <span className="sm-qa-icon">
              <UserPlus size={18} />
            </span>
            Add Person
          </button>
          <button type="button" onClick={() => onTab("settlements")}>
            <span className="sm-qa-icon">
              <CalendarDays size={18} />
            </span>
            View Calendar
          </button>
        </div>
      </section>

      <section className="sm-panel sm-upcoming-card">
        <div className="sm-upcoming-head">
          <h2>Upcoming Settlements</h2>
          <button type="button" onClick={() => onTab("settlements")}>
            View all
          </button>
        </div>
        <div className="sm-upcoming">
          {upcoming.length === 0 && (
            <p className="sm-muted-note">None due soon.</p>
          )}
          {upcoming.map((u, idx) => {
            const person = u.participants[0];
            return (
              <button
                key={`${u.expenseId}-${person?.personId ?? idx}`}
                type="button"
                className="sm-upcoming-row"
                onClick={() => onOpenExpense(u.expenseId)}
              >
                <span className={`sm-avatar small ${avatarTone(idx + 1)}`}>
                  {initials(person?.name ?? u.title)}
                </span>
                <div>
                  <b>{person?.name ?? "Participant"}</b>
                  <small>{u.title}</small>
                </div>
                <em>{formatDue(u.dueDate)}</em>
                <strong>{money(person?.pendingMinor ?? u.pendingMinor)}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sm-panel sm-summary-card">
        <div className="sm-panel-title">
          <h2>Summary</h2>
          <button type="button">
            This month <ChevronDown size={13} />
          </button>
        </div>
        <div className="sm-summary-list">
          <div className="sm-summary-row">
            <span className="green">
              <ReceiptText size={14} />
            </span>
            <p>Total Shared Expenses</p>
            <b>{money(summary?.totalSharedMinor ?? 0)}</b>
          </div>
          <div className="sm-summary-row">
            <span className="blue">
              <HandCoins size={14} />
            </span>
            <p>You Are Owed</p>
            <b>{money(summary?.moneyToReceiveMinor ?? 0)}</b>
          </div>
          <div className="sm-summary-row">
            <span className="gold">
              <Send size={14} />
            </span>
            <p>You Owe</p>
            <b>{money(summary?.moneyToPayMinor ?? 0)}</b>
          </div>
          <div className="sm-summary-row">
            <span className="red">
              <Bell size={14} />
            </span>
            <p>Pending Settlements</p>
            <b>{summary?.pendingSettlements ?? 0}</b>
          </div>
        </div>
      </section>
    </aside>
  );

  return (
    <main className="sm-page">
      <header className="sm-head">
        <div>
          <h1>
            <BadgeCheck size={26} className="sm-title-check" aria-hidden />
            Split Money
          </h1>
        </div>
        <div className="sm-tools">
          <label>
            <Search size={16} />
            <input
              placeholder="Search expenses, people, groups..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="sm-month" type="button">
            <CalendarDays size={16} /> {monthLabel} <ChevronDown size={14} />
          </button>
          <button className="sm-primary" type="button" onClick={onCreate}>
            <Plus size={18} /> Split Expense
          </button>
        </div>
      </header>

      <section className="sm-stat-grid">
        <Stat
          tone="green"
          icon={<ReceiptText size={20} />}
          title="Total shared expenses"
          value={money(summary?.totalSharedMinor ?? 0)}
          note={
            hasActivity
              ? `${(summary?.totalSharedChangePct ?? 0) >= 0 ? "+" : ""}${summary?.totalSharedChangePct ?? 0}%`
              : null
          }
          noteTone={(summary?.totalSharedChangePct ?? 0) < 0 ? "down" : "up"}
        />
        <Stat
          tone="blue"
          icon={<HandCoins size={20} />}
          title="Money to receive"
          value={money(summary?.moneyToReceiveMinor ?? 0)}
          note={
            hasActivity
              ? `${(summary?.receiveChangePct ?? 0) >= 0 ? "+" : ""}${summary?.receiveChangePct ?? 0}%`
              : null
          }
          noteTone={(summary?.receiveChangePct ?? 0) < 0 ? "down" : "up"}
        />
        <Stat
          tone="gold"
          icon={<Send size={20} />}
          title="Money to pay"
          value={money(summary?.moneyToPayMinor ?? 0)}
          note={
            hasActivity
              ? `${(summary?.payChangePct ?? 0) >= 0 ? "+" : ""}${summary?.payChangePct ?? 0}%`
              : null
          }
          noteTone={(summary?.payChangePct ?? 0) < 0 ? "down" : "up"}
        />
        <Stat
          tone="red"
          icon={<Bell size={20} />}
          title="Pending settlements"
          value={String(summary?.pendingSettlements ?? 0)}
          note={
            hasActivity
              ? `${(summary?.pendingChange ?? 0) >= 0 ? "+" : ""}${summary?.pendingChange ?? 0}`
              : null
          }
          noteTone={(summary?.pendingChange ?? 0) < 0 ? "up" : "down"}
        />
      </section>

      <div className="sm-main-grid">
        <div className="sm-main-col">
          <section className="sm-hero">
            <div>
              <h2>
                Split smarter. <em>Settle easier.</em>
              </h2>
              <p>
                Track shared expenses, partial payments, groups and balances without doing
                calculations manually.
              </p>
              <div className="sm-hero-actions">
                <button className="sm-primary" type="button" onClick={onCreate}>
                  <Plus size={18} /> Split Expense
                </button>
                <button className="sm-outline" type="button" onClick={() => onTab("groups")}>
                  <Users size={17} /> Create Group
                </button>
                <button className="sm-ghost" type="button" onClick={() => onTab("import")}>
                  <PlayCircle size={17} /> How it works
                </button>
              </div>
            </div>
            <div className="sm-illustration" aria-hidden>
              <div className="sm-orbit" />
              <div className="sm-orbit-glow" />
              <div className="sm-receipt">
                <b>₹</b>
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="sm-wallet" />
              <i className="sm-coin c1">₹</i>
              <i className="sm-coin c2">₹</i>
              <i className="sm-coin c3">₹</i>
              <i className="sm-person p1">AM</i>
              <i className="sm-person p2">RS</i>
              <i className="sm-person p3">PV</i>
              <i className="sm-person p4">AG</i>
              <span className="sm-flow f1" />
              <span className="sm-flow f2" />
            </div>
          </section>

          <section className="sm-insights">
            <article className="sm-panel sm-progress">
              <div
                className="sm-ring"
                style={{
                  background: `radial-gradient(circle,var(--surface) 57%,transparent 58%),conic-gradient(#16cb81 0 ${settledPct}%,#24302b ${settledPct}% 100%)`,
                }}
              >
                <b>{settledPct}%</b>
                <span>Settled</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>Settlement Progress</h3>
                <p>
                  <strong>{money(summary?.collectedMinor ?? 0)}</strong> collected of{" "}
                  {money(summary?.totalSharedMinor ?? 0)}
                </p>
                <div className="sm-bar" aria-hidden>
                  <i className="seg-paid" style={{ width: `${paidPct}%` }} />
                  <i className="seg-pending" style={{ width: `${pendingPct}%` }} />
                  <i className="seg-overdue" style={{ width: `${overduePct}%` }} />
                </div>
                <div className="sm-legend">
                  <span>
                    <i className="paid" />
                    Paid <b>{money(summary?.collectedMinor ?? 0)}</b>
                  </span>
                  <span>
                    <i className="pending" />
                    Pending <b>{money(summary?.pendingMinor ?? 0)}</b>
                  </span>
                  <span>
                    <i className="overdue" />
                    Overdue <b>{money(summary?.overdueMinor ?? 0)}</b>
                  </span>
                </div>
              </div>
            </article>

            <article className="sm-panel sm-categories">
              <div className="sm-panel-title">
                <h3>Top Categories</h3>
                <button type="button">
                  This month <ChevronDown size={13} />
                </button>
              </div>
              {categories.length === 0 && <p className="sm-empty">No category spend yet.</p>}
              {categories.map((cat, i) => {
                const tones = ["green", "blue", "purple", "gold", "gray"] as const;
                const tone = tones[i % tones.length]!;
                const max = categories[0]?.amountMinor || 1;
                const pct = Math.round((cat.amountMinor / max) * 100);
                return (
                  <div className="sm-cat" key={cat.name}>
                    <span className={`sm-cat-icon ${tone}`}>{categoryIcon(cat.name)}</span>
                    <b>{cat.name}</b>
                    <i>
                      <em className={tone} style={{ width: `${pct}%`, display: "block" }} />
                    </i>
                    <strong>{money(cat.amountMinor)}</strong>
                  </div>
                );
              })}
            </article>
          </section>

          <section className="sm-list-panel">
            <div className="sm-tabs">
              {["Overview", "Expenses", "Groups", "People", "Settlements"].map((x) => (
                <button
                  key={x}
                  type="button"
                  className={tab === x ? "active" : ""}
                  onClick={() => {
                    setTab(x);
                    if (x === "Groups") onTab("groups");
                    if (x === "People") onTab("people");
                    if (x === "Settlements") onTab("settlements");
                    if (x === "Expenses") onTab("history");
                  }}
                >
                  {x === "Overview" ? <ReceiptText size={16} /> : null}
                  {x === "Groups" ? <Users size={16} /> : null}
                  {x}
                </button>
              ))}
            </div>
            <div className="sm-list-toolbar">
              <div className="sm-filters">
                {["All", "You Owe", "You Are Owed", "Partially Paid", "Settled", "Overdue"].map(
                  (x) => (
                    <button
                      key={x}
                      type="button"
                      className={filter === x ? "selected" : ""}
                      onClick={() => setFilter(x)}
                    >
                      {x}
                    </button>
                  ),
                )}
              </div>
              <div className="sm-list-tools">
                <label className="sm-search">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search expenses, people, groups..."
                  />
                </label>
                <button className="sm-outline sm-filter-btn" type="button">
                  <Filter size={14} /> Filter
                </button>
              </div>
            </div>
            <div className="sm-expense-table">
              <div className="sm-row sm-thead">
                <span>Expense</span>
                <span>Total</span>
                <span>You paid</span>
                <span>People</span>
                <span>Your share</span>
                <span>Collected</span>
                <span>Pending</span>
                <span>Progress</span>
                <span>Status</span>
                <span />
              </div>
              {shown.length === 0 && (
                <div className="sm-empty">
                  <span className="sm-exp-icon food" style={{ margin: "0 auto 10px" }}>
                    <Wallet size={18} />
                  </span>
                  <b>No split expenses yet</b>
                  Create your first shared expense to get started.
                </div>
              )}
              {shown.map((x) => {
                const people = x.participants ?? [];
                const payer =
                  x.payers?.find((p) => (p.paidAmountMinor ?? 0) > 0)?.person ??
                  x.payers?.[0]?.person ??
                  null;
                const visiblePeople = people.slice(0, 3);
                const extra = Math.max(0, people.length - visiblePeople.length);
                const pct = x.settledPercent ?? 0;
                return (
                  <button
                    className="sm-row"
                    key={x.id}
                    type="button"
                    onClick={() => onOpenExpense(x.id)}
                  >
                    <div className="sm-expense">
                      <span className={`sm-exp-icon ${expenseIcon(x.category)}`}>
                        {expenseIcon(x.category) === "food" ? (
                          <UtensilsCrossed size={16} />
                        ) : expenseIcon(x.category) === "shop" ? (
                          <ShoppingBag size={16} />
                        ) : expenseIcon(x.category) === "travel" ? (
                          <Send size={16} />
                        ) : (
                          <Wifi size={16} />
                        )}
                      </span>
                      <div>
                        <b>{x.title}</b>
                        <small>
                          {x.group?.name ?? "Personal"} ·{" "}
                          {formatExpenseWhen(x.expenseDate, x.expenseTime)}
                        </small>
                      </div>
                    </div>
                    <b>{money(x.totalAmountMinor)}</b>
                    <div className="sm-payer-cell">
                      {payer ? (
                        <span className={`sm-avatar small ${avatarTone(0)}`}>
                          {initials(payer.fullName)}
                        </span>
                      ) : null}
                      <b>{money(x.youPaidMinor ?? 0)}</b>
                    </div>
                    <div className="sm-people-cell">
                      <div className="sm-avatar-stack">
                        {visiblePeople.map((p, i) => (
                          <span
                            key={p.id}
                            className={`sm-avatar small ${avatarTone(i + 1)}`}
                            title={p.person?.fullName ?? "Participant"}
                          >
                            {initials(p.person?.fullName ?? "?")}
                          </span>
                        ))}
                        {extra > 0 ? <span className="sm-more">+{extra}</span> : null}
                      </div>
                      <b>{people.length} people</b>
                    </div>
                    <b>{money(x.yourShareMinor ?? 0)}</b>
                    <b className="success">{money(x.collectedMinor ?? 0)}</b>
                    <b className={(x.pendingMinor ?? 0) === 0 ? "success" : "danger"}>
                      {money(x.pendingMinor ?? 0)}
                    </b>
                    <div className="sm-progress-cell">
                      <div className="sm-mini-bar">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <span>{pct}%</span>
                    </div>
                    <span className={`sm-status ${displayStatusClass(x.status, pct)}`}>
                      {displayStatus(x.status, pct)}
                    </span>
                    <span className="sm-menu" aria-hidden>
                      <MoreHorizontal size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {rightRail}
      </div>
    </main>
  );
}
