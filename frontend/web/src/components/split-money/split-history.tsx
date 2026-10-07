"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  HandCoins,
  Receipt,
  Search,
  Wallet,
  X,
  CircleDollarSign,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { avatarTone, initials, statusClass, statusLabel } from "./split-format";

const FILTERS = ["All", "Ongoing", "Settled", "You Owe", "Others Owe", "Cancelled"] as const;

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SplitHistoryView({
  onBack,
  onOpenExpense,
}: {
  onBack: () => void;
  onOpenExpense: (id: string) => void;
}) {
  const [tab, setTab] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["split-money", "history"],
    queryFn: () => splitMoneyService.history(),
  });
  const detailQuery = useQuery({
    queryKey: ["split-expense", selectedId],
    queryFn: () => splitMoneyService.getExpense(selectedId!),
    enabled: !!selectedId,
  });

  const summary = historyQuery.data?.summary;
  const expenses = useMemo(() => {
    const rows = historyQuery.data?.expenses ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
      if (q) {
        const hay = `${e.title} ${e.group?.name ?? ""} ${e.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tab === "All") return true;
      if (tab === "Ongoing") return !["settled", "cancelled"].includes(e.status);
      if (tab === "Settled") return e.status === "settled";
      if (tab === "You Owe") return (e.yourShareMinor ?? 0) > (e.youPaidMinor ?? 0);
      if (tab === "Others Owe") return (e.youPaidMinor ?? 0) > (e.yourShareMinor ?? 0);
      if (tab === "Cancelled") return e.status === "cancelled";
      return true;
    });
  }, [historyQuery.data?.expenses, tab, query]);

  const exportCsv = () => {
    const header = ["Title", "Date", "Group", "Category", "Total", "Your share", "You paid", "Status"];
    const lines = expenses.map((e) =>
      [
        e.title,
        e.expenseDate,
        e.group?.name ?? "Personal",
        e.category,
        (e.totalAmountMinor / 100).toFixed(2),
        ((e.yourShareMinor ?? 0) / 100).toFixed(2),
        ((e.youPaidMinor ?? 0) / 100).toFixed(2),
        statusLabel(e.status),
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "split-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    {
      tone: "green",
      icon: <Receipt size={20} />,
      value: money(summary?.totalExpensesMinor ?? 0),
      label: "Total Expenses",
      sub: `${summary?.totalExpenses ?? 0} expenses`,
    },
    {
      tone: "gold",
      icon: <CircleDollarSign size={20} />,
      value: money(summary?.yourShareMinor ?? 0),
      label: "Your Share",
    },
    {
      tone: "green",
      icon: <Wallet size={20} />,
      value: money(summary?.youPaidMinor ?? 0),
      label: "You Paid",
    },
    {
      tone: "red",
      icon: <ArrowUpRight size={20} />,
      value: money(summary?.youOweMinor ?? 0),
      label: "You Owe",
    },
    {
      tone: "blue",
      icon: <ArrowDownLeft size={20} />,
      value: money(summary?.youllReceiveMinor ?? 0),
      label: "You'll Receive",
    },
  ];

  const detail = detailQuery.data;
  const selectedRow = (historyQuery.data?.expenses ?? []).find((e) => e.id === selectedId);

  return (
    <main className="sm-page">
      <header className="sm-head">
        <div>
          <button className="sm-back-title" type="button" onClick={onBack}>
            <ArrowLeft size={18} /> Split Money
          </button>
          <h1>Split History</h1>
          <p style={{ color: "var(--muted-foreground)" }}>
            View all your split expenses, payments and settlements.
          </p>
        </div>
        <div className="sm-tools">
          <label className="sm-search">
            <Search size={14} />
            <input
              aria-label="Search split history"
              placeholder="Search by title, group or category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="sm-outline" type="button" onClick={exportCsv} disabled={!expenses.length}>
            <Download size={15} /> Export
          </button>
        </div>
      </header>

      <div className="sm-filters" style={{ marginBottom: 16 }}>
        {FILTERS.map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="sm-stat-grid sm-stat-grid-5">
        {cards.map((c) => (
          <article key={c.label} className={`sm-stat ${c.tone}`}>
            <span>{c.icon}</span>
            <div>
              <b>{c.value}</b>
              <p>{c.label}</p>
              {c.sub && <small className="muted">{c.sub}</small>}
            </div>
          </article>
        ))}
      </section>

      <div className={`sm-history-layout ${selectedId ? "has-detail" : ""}`}>
        <section className="sm-list-panel" style={{ padding: 12 }}>
          <div className="sm-expense-table">
            <div className="sm-row sm-hist-row sm-thead">
              <span>Expense</span>
              <span>Date</span>
              <span>Group</span>
              <span>Total</span>
              <span>Your share</span>
              <span>You paid</span>
              <span>Balance</span>
              <span>Status</span>
            </div>
            {historyQuery.isLoading && <p className="sm-empty">Loading…</p>}
            {!historyQuery.isLoading && expenses.length === 0 && (
              <p className="sm-empty">No split expenses match this view.</p>
            )}
            {expenses.map((e) => {
              const balance = (e.youPaidMinor ?? 0) - (e.yourShareMinor ?? 0);
              const people = (e.participants ?? []).slice(0, 3);
              const extra = (e.participants?.length ?? 0) - people.length;
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`sm-row sm-hist-row ${selectedId === e.id ? "active" : ""}`}
                  onClick={() => setSelectedId(e.id)}
                  aria-pressed={selectedId === e.id}
                >
                  <div className="sm-expense">
                    <span className="sm-exp-icon food">
                      <Receipt size={16} />
                    </span>
                    <div>
                      <b>{e.title}</b>
                      <small>{e.category}</small>
                    </div>
                  </div>
                  <span>{e.expenseDate}</span>
                  <span className="sm-avatar-stack">
                    {people.map((p, i) => (
                      <span key={p.id} className={`sm-avatar small ${avatarTone(i)}`}>
                        {initials(p.person?.fullName ?? "?")}
                      </span>
                    ))}
                    {extra > 0 && <span className="sm-more">+{extra}</span>}
                    {!people.length && <small>{e.group?.name ?? "Personal"}</small>}
                  </span>
                  <b>{money(e.totalAmountMinor)}</b>
                  <b>{money(e.yourShareMinor ?? 0)}</b>
                  <b>{money(e.youPaidMinor ?? 0)}</b>
                  <b className={balance < 0 ? "danger" : "success"}>
                    {balance === 0 ? money(0) : `${balance < 0 ? "-" : "+"}${money(Math.abs(balance))}`}
                  </b>
                  <span className={`sm-status ${statusClass(e.status)}`}>{statusLabel(e.status)}</span>
                </button>
              );
            })}
          </div>
          <p className="sm-table-foot">
            Showing {expenses.length} of {historyQuery.data?.expenses.length ?? 0} expenses
          </p>
        </section>

        {selectedId && (
          <aside className="sm-detail-panel" aria-label="Expense details">
            <header>
              <div>
                <h2>{detail?.title ?? selectedRow?.title ?? "Expense"}</h2>
                <small>
                  {detail?.expenseDate ?? selectedRow?.expenseDate}
                  {detail?.expenseTime ? ` · ${detail.expenseTime}` : ""}
                </small>
              </div>
              <button type="button" className="sm-icon-btn" aria-label="Close" onClick={() => setSelectedId(null)}>
                <X size={16} />
              </button>
            </header>
            {(detail ?? selectedRow) && (
              <>
                <div className="sm-chip-row">
                  <span className={`sm-status ${statusClass((detail ?? selectedRow)!.status)}`}>
                    {statusLabel((detail ?? selectedRow)!.status)}
                  </span>
                  <span className="sm-chip">{(detail ?? selectedRow)!.category}</span>
                  {(detail ?? selectedRow)!.group?.name && (
                    <span className="sm-chip">{(detail ?? selectedRow)!.group!.name}</span>
                  )}
                </div>
                <div className="sm-detail-totals">
                  <div>
                    <small>Total Amount</small>
                    <b>{money((detail ?? selectedRow)!.totalAmountMinor)}</b>
                  </div>
                  <div>
                    <small>Your Share</small>
                    <b>{money((detail ?? selectedRow)!.yourShareMinor ?? 0)}</b>
                  </div>
                  <div>
                    <small>You Paid</small>
                    <b>{money((detail ?? selectedRow)!.youPaidMinor ?? 0)}</b>
                  </div>
                </div>
                {(detail ?? selectedRow)!.description && (
                  <p className="sm-detail-note">{(detail ?? selectedRow)!.description}</p>
                )}
              </>
            )}

            <h3>Participants ({detail?.participants?.length ?? 0})</h3>
            <ul className="sm-detail-list">
              {(detail?.participants ?? []).map((p, i) => (
                <li key={p.id}>
                  <span className={`sm-avatar small ${avatarTone(i)}`}>
                    {initials(p.person?.fullName ?? "?")}
                  </span>
                  <div>
                    <b>{p.person?.fullName ?? "Unknown"}</b>
                    <small>Paid {money(p.paidAmountMinor)}</small>
                  </div>
                  <span className="sm-detail-amount">{money(p.shareAmountMinor)}</span>
                  <span className={`sm-status ${statusClass(p.status)}`}>{statusLabel(p.status)}</span>
                </li>
              ))}
              {detailQuery.isLoading && <li className="sm-empty">Loading…</li>}
            </ul>

            <h3>Payment History</h3>
            <ul className="sm-detail-list">
              {(detail?.payments ?? []).map((p) => (
                <li key={p.id}>
                  <HandCoins size={16} />
                  <div>
                    <b>
                      {p.payer?.fullName ?? "Someone"} paid {money(p.amountMinor)}
                    </b>
                    <small>
                      {p.paymentDate.slice(0, 10)} · {statusLabel(p.method)}
                    </small>
                  </div>
                </li>
              ))}
              {detail && !(detail.payments ?? []).length && (
                <li className="sm-empty">No payments recorded yet.</li>
              )}
            </ul>

            {!!detail?.activities?.length && (
              <>
                <h3>Activity Log</h3>
                <ul className="sm-detail-list">
                  {detail.activities.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <div>
                        <b>{statusLabel(a.action)}</b>
                        <small>{a.createdAt.slice(0, 10)}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button
              className="sm-primary sm-detail-open"
              type="button"
              onClick={() => onOpenExpense(selectedId)}
            >
              Open full detail
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}
