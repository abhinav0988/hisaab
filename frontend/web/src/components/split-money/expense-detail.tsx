"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { avatarTone, initials, statusLabel } from "./split-format";

export function ExpenseDetail({
  expenseId,
  onBack,
}: {
  expenseId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [payAmount, setPayAmount] = useState("");
  const [payParticipant, setPayParticipant] = useState("");
  const [method, setMethod] = useState("upi");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState("discount");

  const query = useQuery({
    queryKey: ["split-expense", expenseId],
    queryFn: () => splitMoneyService.getExpense(expenseId),
  });
  const peopleQuery = useQuery({
    queryKey: ["split-people"],
    queryFn: () => splitMoneyService.listPeople(),
  });

  const expense = query.data;
  const self = peopleQuery.data?.find((p) => p.isSelf);

  const payMutation = useMutation({
    mutationFn: () => {
      if (!expense || !self) throw new Error("Missing data");
      const participant =
        expense.participants?.find((p) => p.id === payParticipant) ??
        expense.participants?.find((p) => p.pendingAmountMinor > 0);
      if (!participant) throw new Error("Select a participant");
      const amountMinor = Math.round(Number(payAmount.replace(/,/g, "")) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error("Invalid amount");
      const receiver =
        expense.payers?.[0]?.personId ?? self.id;
      return splitMoneyService.recordPayment(expenseId, {
        participantId: participant.id,
        payerPersonId: participant.personId,
        receiverPersonId: receiver,
        amountMinor,
        method,
        paymentDate: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully.");
      setPayAmount("");
      void qc.invalidateQueries({ queryKey: ["split-expense", expenseId] });
      void qc.invalidateQueries({ queryKey: ["split-money"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjMutation = useMutation({
    mutationFn: () => {
      const participant =
        expense?.participants?.find((p) => p.id === payParticipant) ??
        expense?.participants?.[0];
      if (!participant) throw new Error("Select a participant");
      const amountMinor = Math.round(Number(adjAmount.replace(/,/g, "")) * 100);
      return splitMoneyService.createAdjustment(expenseId, {
        participantId: participant.id,
        amountMinor: -Math.abs(amountMinor),
        type: adjType,
        reason: `${adjType} adjustment`,
      });
    },
    onSuccess: () => {
      toast.success("Balance adjusted.");
      setAdjAmount("");
      void qc.invalidateQueries({ queryKey: ["split-expense", expenseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <main className="sm-page"><p>Loading expense…</p></main>;
  if (!expense) return <main className="sm-page"><p>Expense not found.</p></main>;

  const selfPart = expense.participants?.find((p) => p.personId === self?.id);

  return (
    <main className="sm-page">
      <header className="sm-create-head">
        <button className="sm-back-title" type="button" onClick={onBack}>
          <ArrowLeft size={18} /> Split Money
        </button>
        <div className="sm-tools">
          <button
            className="sm-outline"
            type="button"
            onClick={() =>
              void splitMoneyService
                .scheduleReminder(expenseId, {
                  channel: "in_app",
                  scheduledAt: new Date().toISOString(),
                  message: `Reminder for ${expense.title}`,
                })
                .then(() => toast.success("Reminder scheduled."))
            }
          >
            Send Reminder
          </button>
          <button
            className="sm-outline"
            type="button"
            onClick={() =>
              void splitMoneyService
                .convertToLend(expenseId)
                .then(() => toast.success("Borrow/Lend suggestions ready."))
            }
          >
            Convert to Borrow/Lend
          </button>
          <button
            className="sm-primary"
            type="button"
            onClick={() => void splitMoneyService.settleExpense(expenseId).then(() => {
              toast.success("Expense marked as settled.");
              void qc.invalidateQueries({ queryKey: ["split-expense", expenseId] });
            })}
          >
            Mark Settled
          </button>
        </div>
      </header>

      <section className="sm-wizard-title">
        <p className="sm-kicker">{expense.category}</p>
        <h1>{expense.title}</h1>
        <p>
          {expense.expenseDate}
          {expense.expenseTime ? ` · ${expense.expenseTime}` : ""} ·{" "}
          {statusLabel(expense.status)}
        </p>
      </section>

      <section className="sm-stat-grid">
        <article className="sm-stat green">
          <div>
            <b>{money(expense.totalAmountMinor)}</b>
            <p>Total amount</p>
          </div>
        </article>
        <article className="sm-stat blue">
          <div>
            <b>{money(selfPart?.adjustedShareAmountMinor ?? 0)}</b>
            <p>Your share</p>
          </div>
        </article>
        <article className="sm-stat gold">
          <div>
            <b>
              {money(
                expense.payers
                  ?.filter((p) => p.personId === self?.id)
                  .reduce((s, p) => s + p.paidAmountMinor, 0) ?? 0,
              )}
            </b>
            <p>You paid</p>
          </div>
        </article>
      </section>

      <div className="sm-wizard-grid">
        <section className="sm-form-card">
          <h2>Participants</h2>
          <div className="sm-breakdown">
            {(expense.participants ?? []).map((p, i) => (
              <div key={p.id}>
                <span className={`sm-avatar ${avatarTone(i)} small`}>
                  {initials(p.person?.fullName ?? "?")}
                </span>
                <b>{p.person?.fullName}</b>
                <span>{(p.sharePercentageBps / 100).toFixed(0)}%</span>
                <strong>{money(p.adjustedShareAmountMinor)}</strong>
                <em>{statusLabel(p.status)} · pending {money(p.pendingAmountMinor)}</em>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 24 }}>Record Payment</h2>
          <div className="sm-fields">
            <label>
              Person
              <select value={payParticipant} onChange={(e) => setPayParticipant(e.target.value)}>
                <option value="">Select participant</option>
                {(expense.participants ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.person?.fullName} (pending {money(p.pendingAmountMinor)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </label>
            <label>
              Method
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <button
            className="sm-primary"
            type="button"
            style={{ marginTop: 12 }}
            onClick={() => payMutation.mutate()}
          >
            Record Payment
          </button>

          <h2 style={{ marginTop: 24 }}>Adjustment / Waiver</h2>
          <div className="sm-fields">
            <label>
              Type
              <select value={adjType} onChange={(e) => setAdjType(e.target.value)}>
                <option value="discount">Discount</option>
                <option value="waived">Waived</option>
                <option value="correction">Correction</option>
                <option value="refund">Refund</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Amount to reduce
              <input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
            </label>
          </div>
          <button
            className="sm-outline"
            type="button"
            style={{ marginTop: 12 }}
            onClick={() => adjMutation.mutate()}
          >
            Apply Adjustment
          </button>
        </section>

        <aside className="sm-preview">
          <h2>Payment History</h2>
          {(expense.payments ?? []).length === 0 && <p>No payments yet.</p>}
          {(expense.payments ?? []).map((p) => (
            <div key={p.id} className="sm-callout" style={{ marginBottom: 8 }}>
              <Check size={16} />
              <div>
                <b>
                  {p.payer?.fullName ?? "Someone"} paid {money(p.amountMinor)} via{" "}
                  {p.method.replace("_", " ")}
                </b>
                <small>{p.paymentDate}</small>
              </div>
            </div>
          ))}
          <h2 style={{ marginTop: 18 }}>Activity Log</h2>
          {(expense.activities ?? []).map((a) => (
            <div key={a.id} style={{ marginBottom: 8, fontSize: 12 }}>
              <b>{statusLabel(a.action)}</b>
              <small style={{ display: "block", color: "var(--muted-foreground)" }}>
                {new Date(a.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
