"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  HandCoins,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { statusClass, statusLabel } from "./split-format";

function Stat({
  icon,
  title,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className={`sm-stat ${tone}`}>
      <span>{icon}</span>
      <div>
        <b>{value}</b>
        <p>{title}</p>
      </div>
      <small>
        {note}
        <br />
        vs last month
      </small>
    </article>
  );
}

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("food") || n.includes("dining")) return <UtensilsCrossed />;
  if (n.includes("travel")) return <Send />;
  if (n.includes("shop")) return <ShoppingBag />;
  if (n.includes("bill")) return <ReceiptText />;
  return <MoreHorizontal />;
}

function expenseIcon(category: string) {
  const n = category.toLowerCase();
  if (n.includes("food") || n.includes("dining")) return "food";
  if (n.includes("travel")) return "travel";
  if (n.includes("shop")) return "shop";
  if (n.includes("bill")) return "bill";
  return "bill";
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

  const shown = useMemo(() => {
    return expenses.filter((x) => {
      const matchesQuery =
        !query ||
        x.title.toLowerCase().includes(query.toLowerCase()) ||
        x.category.toLowerCase().includes(query.toLowerCase());
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

  return (
    <main className="sm-page">
      <header className="sm-head">
        <div>
          <p className="sm-kicker">SHARED FINANCES</p>
          <h1>Split Money</h1>
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
          icon={<ReceiptText />}
          title="Total shared expenses"
          value={money(summary?.totalSharedMinor ?? 0)}
          note={`↑ ${summary?.totalSharedChangePct ?? 0}%`}
        />
        <Stat
          tone="blue"
          icon={<HandCoins />}
          title="Money to receive"
          value={money(summary?.moneyToReceiveMinor ?? 0)}
          note={`↑ ${summary?.receiveChangePct ?? 0}%`}
        />
        <Stat
          tone="gold"
          icon={<Send />}
          title="Money to pay"
          value={money(summary?.moneyToPayMinor ?? 0)}
          note={`${(summary?.payChangePct ?? 0) >= 0 ? "↑" : "↓"} ${Math.abs(summary?.payChangePct ?? 0)}%`}
        />
        <Stat
          tone="red"
          icon={<Bell />}
          title="Pending settlements"
          value={String(summary?.pendingSettlements ?? 0)}
          note={`+${summary?.pendingChange ?? 0}`}
        />
      </section>

      <section className="sm-hero">
        <div>
          <span className="sm-chip">SMART SPLITTING</span>
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
            <button className="sm-outline" type="button" onClick={() => onTab("import")}>
              How it works
            </button>
          </div>
        </div>
        <div className="sm-illustration" aria-hidden>
          <div className="sm-orbit" />
          <div className="sm-receipt">
            <ReceiptText size={45} />
          </div>
          <i className="sm-coin c1">₹</i>
          <i className="sm-coin c2">₹</i>
          <i className="sm-person p1">AM</i>
          <i className="sm-person p2">RS</i>
          <i className="sm-person p3">PV</i>
        </div>
      </section>

      <section className="sm-insights">
        <article className="sm-panel sm-progress">
          <div
            className="sm-ring"
            style={{
              background: `radial-gradient(circle,var(--surface) 57%,transparent 58%),conic-gradient(#16cb81 0 ${settledPct}%,var(--muted) ${settledPct}% 100%)`,
            }}
          >
            <b>{settledPct}%</b>
            <span>Settled</span>
          </div>
          <div>
            <h3>Settlement Progress</h3>
            <p>
              <strong>{money(summary?.collectedMinor ?? 0)}</strong> collected of{" "}
              {money(summary?.totalSharedMinor ?? 0)}
            </p>
            <div className="sm-bar">
              <i style={{ width: `${settledPct}%` }} />
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
          {categories.length === 0 && <p>No category spend yet.</p>}
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

      <div className="sm-wizard-grid" style={{ marginBottom: 16 }}>
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
            <label className="sm-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search expenses, people, groups..."
              />
            </label>
          </div>
          <div className="sm-expense-table">
            <div className="sm-row sm-thead">
              <span>Expense</span>
              <span>Total</span>
              <span>You paid</span>
              <span>Your share</span>
              <span>Collected</span>
              <span>Pending</span>
              <span>Status</span>
            </div>
            {shown.length === 0 && (
              <div className="sm-row">
                <div className="sm-expense">
                  <span className="sm-exp-icon food">
                    <Wallet />
                  </span>
                  <div>
                    <b>No split expenses yet</b>
                    <small>Create your first shared expense to get started.</small>
                  </div>
                </div>
              </div>
            )}
            {shown.map((x) => (
              <button
                className="sm-row"
                key={x.id}
                type="button"
                onClick={() => onOpenExpense(x.id)}
                style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              >
                <div className="sm-expense">
                  <span className={`sm-exp-icon ${expenseIcon(x.category)}`}>
                    {expenseIcon(x.category) === "food" ? (
                      <UtensilsCrossed />
                    ) : expenseIcon(x.category) === "shop" ? (
                      <ShoppingBag />
                    ) : (
                      <Wallet />
                    )}
                  </span>
                  <div>
                    <b>{x.title}</b>
                    <small>
                      {x.group?.name ?? "Personal"} · {x.expenseDate}
                      {x.expenseTime ? ` · ${x.expenseTime}` : ""}
                    </small>
                  </div>
                </div>
                <b>{money(x.totalAmountMinor)}</b>
                <b>{money(x.youPaidMinor ?? 0)}</b>
                <b>{money(x.yourShareMinor ?? 0)}</b>
                <b className="success">{money(x.collectedMinor ?? 0)}</b>
                <b className={(x.pendingMinor ?? 0) === 0 ? "success" : "danger"}>
                  {money(x.pendingMinor ?? 0)}
                </b>
                <div>
                  <div className="sm-mini-bar">
                    <i style={{ width: `${x.settledPercent ?? 0}%` }} />
                  </div>
                  <span className={`sm-status ${statusClass(x.status)}`}>
                    {statusLabel(x.status)}
                  </span>
                </div>
                <span className="sm-menu">
                  <MoreHorizontal size={19} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="sm-preview">
          <h2>Quick Actions</h2>
          <div className="sm-methods" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
            <button type="button" onClick={onCreate}>
              <Plus />
              <b>Split Expense</b>
            </button>
            <button type="button" onClick={() => onTab("groups")}>
              <Users />
              <b>Create Group</b>
            </button>
            <button type="button" onClick={() => onTab("people")}>
              <Users />
              <b>Add Person</b>
            </button>
            <button type="button" onClick={() => onTab("import")}>
              <ReceiptText />
              <b>Import Receipt</b>
            </button>
          </div>
          <h2>Upcoming Settlements</h2>
          {upcoming.length === 0 && <p style={{ color: "var(--muted-foreground)" }}>None due soon.</p>}
          {upcoming.map((u) => (
            <div key={u.expenseId} className="sm-callout" style={{ marginBottom: 8 }}>
              <div>
                <b>{u.participants[0]?.name ?? "Participant"}</b>
                <small>
                  {u.title} · {u.dueDate}
                </small>
                <strong className="danger">{money(u.pendingMinor)}</strong>
              </div>
            </div>
          ))}
          <h2 style={{ marginTop: 18 }}>Summary</h2>
          <dl>
            <dt>Total Shared</dt>
            <dd>{money(summary?.totalSharedMinor ?? 0)}</dd>
            <dt>You Are Owed</dt>
            <dd>{money(summary?.moneyToReceiveMinor ?? 0)}</dd>
            <dt>You Owe</dt>
            <dd>{money(summary?.moneyToPayMinor ?? 0)}</dd>
            <dt>Pending</dt>
            <dd>{summary?.pendingSettlements ?? 0}</dd>
          </dl>
        </aside>
      </div>
    </main>
  );
}
