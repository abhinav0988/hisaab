"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { statusClass, statusLabel } from "./split-format";

export function SplitHistoryView({
  onBack,
  onOpenExpense,
}: {
  onBack: () => void;
  onOpenExpense: (id: string) => void;
}) {
  const [tab, setTab] = useState("All");
  const historyQuery = useQuery({
    queryKey: ["split-money", "history"],
    queryFn: () => splitMoneyService.history(),
  });

  const summary = historyQuery.data?.summary;
  const expenses = useMemo(() => {
    const rows = historyQuery.data?.expenses ?? [];
    return rows.filter((e) => {
      if (tab === "All") return true;
      if (tab === "Ongoing")
        return !["settled", "cancelled"].includes(e.status);
      if (tab === "Settled") return e.status === "settled";
      if (tab === "You Owe") return (e.yourShareMinor ?? 0) > (e.youPaidMinor ?? 0);
      if (tab === "Others Owe") return (e.youPaidMinor ?? 0) > (e.yourShareMinor ?? 0);
      if (tab === "Cancelled") return e.status === "cancelled";
      return true;
    });
  }, [historyQuery.data?.expenses, tab]);

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
      </header>

      <div className="sm-filters" style={{ marginBottom: 16 }}>
        {["All", "Ongoing", "Settled", "You Owe", "Others Owe", "Cancelled"].map((t) => (
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

      <section className="sm-stat-grid">
        <article className="sm-stat green">
          <div>
            <b>{money(summary?.totalExpensesMinor ?? 0)}</b>
            <p>Total Expenses ({summary?.totalExpenses ?? 0})</p>
          </div>
        </article>
        <article className="sm-stat blue">
          <div>
            <b>{money(summary?.yourShareMinor ?? 0)}</b>
            <p>Your Share</p>
          </div>
        </article>
        <article className="sm-stat gold">
          <div>
            <b>{money(summary?.youPaidMinor ?? 0)}</b>
            <p>You Paid</p>
          </div>
        </article>
        <article className="sm-stat red">
          <div>
            <b>{money(summary?.youOweMinor ?? 0)}</b>
            <p>You Owe</p>
          </div>
        </article>
        <article className="sm-stat blue">
          <div>
            <b>{money(summary?.youllReceiveMinor ?? 0)}</b>
            <p>You&apos;ll Receive</p>
          </div>
        </article>
      </section>

      <section className="sm-list-panel" style={{ padding: 12 }}>
        <div className="sm-expense-table">
          <div className="sm-row sm-thead">
            <span>Expense</span>
            <span>Total</span>
            <span>Your share</span>
            <span>You paid</span>
            <span>Balance</span>
            <span>Status</span>
          </div>
          {expenses.map((e) => {
            const balance = (e.yourShareMinor ?? 0) - (e.youPaidMinor ?? 0);
            return (
              <button
                key={e.id}
                type="button"
                className="sm-row"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => onOpenExpense(e.id)}
              >
                <div className="sm-expense">
                  <div>
                    <b>{e.title}</b>
                    <small>
                      {e.expenseDate} · {e.group?.name ?? "Personal"}
                    </small>
                  </div>
                </div>
                <b>{money(e.totalAmountMinor)}</b>
                <b>{money(e.yourShareMinor ?? 0)}</b>
                <b>{money(e.youPaidMinor ?? 0)}</b>
                <b className={balance > 0 ? "danger" : "success"}>{money(Math.abs(balance))}</b>
                <span className={`sm-status ${statusClass(e.status)}`}>
                  {statusLabel(e.status)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
