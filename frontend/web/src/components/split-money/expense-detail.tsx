"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import type { SplitObligation, SplitPaymentMethod } from "@hisaab/types";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { SplitReceiptsPanel } from "@/components/finance/record-panels";
import { avatarTone, initials, statusLabel } from "./split-format";

function obligationKey(edge: SplitObligation) {
  return `${edge.debtorPersonId}:${edge.creditorPersonId}`;
}

export function ExpenseDetail({
  expenseId,
  onBack,
}: {
  expenseId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const payKey = useRef(crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const adjKey = useRef(crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const settleKey = useRef(crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const [payAmount, setPayAmount] = useState("");
  const [obligationId, setObligationId] = useState("");
  const [method, setMethod] = useState<SplitPaymentMethod>("upi");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState("discount");
  const [adjParticipant, setAdjParticipant] = useState("");
  const [adjDirection, setAdjDirection] = useState<"reduce" | "increase">("reduce");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ title: "", category: "", description: "", dueDate: "" });
  const editKey = useRef(crypto.randomUUID().replace(/-/g, "").slice(0, 24));

  const query = useQuery({
    queryKey: ["split-expense", expenseId],
    queryFn: () => splitMoneyService.getExpense(expenseId),
  });
  const expense = query.data;
  const obligations = useMemo(() => expense?.obligations ?? [], [expense?.obligations]);
  const selected = useMemo(
    () => obligations.find((edge) => obligationKey(edge) === obligationId) ?? obligations[0],
    [obligations, obligationId],
  );

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["split-expense", expenseId] }),
      qc.invalidateQueries({ queryKey: ["split-money"] }),
      qc.invalidateQueries({ queryKey: ["split-history"] }),
      qc.invalidateQueries({ queryKey: ["split-groups"] }),
    ]);
  };

  const payMutation = useMutation({
    mutationFn: () => {
      if (!expense || !selected) throw new Error("Choose who is paying whom.");
      const amountMinor = Math.round(Number(payAmount.replace(/,/g, "")) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error("Enter a valid amount.");
      if (amountMinor > selected.amountMinor) {
        throw new Error(`Only ${money(selected.amountMinor, expense.currency)} is still owed on this edge.`);
      }
      return splitMoneyService.recordPayment(
        expenseId,
        {
          payerPersonId: selected.debtorPersonId,
          receiverPersonId: selected.creditorPersonId,
          amountMinor,
          method,
          paymentDate: new Date().toISOString().slice(0, 10),
        },
        payKey.current,
      );
    },
    onSuccess: async () => {
      toast.success("Repayment recorded. This is a manual settlement record, not an automatic transfer.");
      setPayAmount("");
      payKey.current = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjMutation = useMutation({
    mutationFn: () => {
      const participant =
        expense?.participants?.find((p) => p.id === adjParticipant) ?? expense?.participants?.[0];
      if (!participant) throw new Error("Select a participant");
      const amountMinor = Math.round(Number(adjAmount.replace(/,/g, "")) * 100);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error("Enter a valid amount.");
      return splitMoneyService.createAdjustment(
        expenseId,
        {
          participantId: participant.id,
          amountMinor,
          type: adjType,
          direction: adjType === "correction" || adjType === "other" ? adjDirection : undefined,
          reason: `${adjType} adjustment`,
        },
        adjKey.current,
      );
    },
    onSuccess: async () => {
      toast.success("Balance adjusted.");
      setAdjAmount("");
      adjKey.current = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settleMutation = useMutation({
    mutationFn: () => {
      if (!window.confirm("Record a full settlement for every remaining obligation? This does not send money.")) {
        throw new Error("Cancelled");
      }
      return splitMoneyService.settleExpense(expenseId, { method: "other" }, settleKey.current);
    },
    onSuccess: async () => {
      toast.success("All remaining obligations recorded as settled.");
      settleKey.current = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      await refresh();
    },
    onError: (e: Error) => {
      if (e.message !== "Cancelled") toast.error(e.message);
    },
  });

  const reminderMutation = useMutation({
    mutationFn: () =>
      splitMoneyService.scheduleReminder(expenseId, {
        channel: "in_app",
        scheduledAt: new Date().toISOString(),
        message: `Reminder for ${expense?.title ?? "expense"}`,
      }),
    onSuccess: async () => {
      toast.success("In-app reminder scheduled. The scheduler delivers it within ~15 minutes; it will show as “sent” below.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelReminderMutation = useMutation({
    mutationFn: (reminderId: string) => splitMoneyService.cancelReminder(expenseId, reminderId),
    onSuccess: async () => {
      toast.success("Reminder cancelled.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string | null }) =>
      splitMoneyService.voidPayment(expenseId, paymentId, reason),
    onSuccess: async () => {
      toast.success("Repayment reversed. The original record is kept in history as voided.");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: () => {
      const title = edit.title.trim();
      const category = edit.category.trim();
      if (!title) throw new Error("Title is required.");
      if (!category) throw new Error("Category is required.");
      if (edit.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(edit.dueDate)) {
        throw new Error("Due date must be YYYY-MM-DD.");
      }
      return splitMoneyService.patchExpense(
        expenseId,
        {
          title,
          category,
          description: edit.description.trim() || null,
          dueDate: edit.dueDate || null,
        },
        editKey.current,
      );
    },
    onSuccess: async () => {
      toast.success("Expense details saved.");
      editKey.current = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      setEditing(false);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (next: "cancelled" | "pending" | "publish") => {
      const prompt =
        next === "cancelled"
          ? "Cancel this expense? It will be excluded from balances. History is kept and you can reopen it later."
          : next === "pending"
            ? "Reopen this expense and include it in balances again?"
            : "Publish this draft? It will start counting towards balances.";
      if (!window.confirm(prompt)) throw new Error("Cancelled");
      return splitMoneyService.patchExpense(
        expenseId,
        next === "publish" ? { isDraft: false } : { status: next },
      );
    },
    onSuccess: async (_, next) => {
      toast.success(
        next === "cancelled" ? "Expense cancelled." : next === "pending" ? "Expense reopened." : "Draft published.",
      );
      await refresh();
    },
    onError: (e: Error) => {
      if (e.message !== "Cancelled") toast.error(e.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (
        !window.confirm(
          "Permanently delete this expense? This is only allowed when no repayments or adjustments were recorded.",
        )
      ) {
        throw new Error("Cancelled");
      }
      return splitMoneyService.deleteExpense(expenseId);
    },
    onSuccess: async () => {
      toast.success("Expense deleted.");
      await refresh();
      onBack();
    },
    onError: (e: Error) => {
      if (e.message !== "Cancelled") toast.error(e.message);
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => splitMoneyService.convertToLend(expenseId),
    onSuccess: (result) => {
      toast.message(
        result.created
          ? "Borrow/Lend records created."
          : `${result.suggestions.length} Borrow/Lend suggestion${result.suggestions.length === 1 ? "" : "s"} ready (not created automatically).`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <main className="sm-page"><p>Loading expense…</p></main>;
  if (!expense) return <main className="sm-page"><p>Expense not found.</p></main>;

  const ledger = expense.ledger;
  const collectible = ledger?.collectibleMinor ?? expense.collectibleMinor ?? 0;
  const collected = ledger?.collectedMinor ?? expense.collectedMinor ?? 0;
  const remaining = ledger?.remainingMinor ?? expense.pendingMinor ?? 0;
  const settledPct = ledger?.settledPercent ?? expense.settledPercent ?? 0;
  const upfront = ledger?.upfrontPaidMinor ?? expense.totalAmountMinor;
  const currency = expense.currency;
  const busy =
    payMutation.isPending ||
    adjMutation.isPending ||
    settleMutation.isPending ||
    reminderMutation.isPending ||
    convertMutation.isPending ||
    cancelReminderMutation.isPending ||
    voidMutation.isPending ||
    editMutation.isPending ||
    statusMutation.isPending ||
    deleteMutation.isPending;
  const cancelled = expense.status === "cancelled";
  const hasActiveRepayments = (expense.payments ?? []).some((p) => p.status === "completed");
  const hasMoneyHistory =
    (expense.payments?.length ?? 0) > 0 || (expense.adjustments?.length ?? 0) > 0;
  const startEditing = () => {
    setEdit({
      title: expense.title,
      category: expense.category,
      description: expense.description ?? "",
      dueDate: expense.dueDate ?? "",
    });
    setEditing(true);
  };

  return (
    <main className="sm-page">
      <header className="sm-create-head">
        <button className="sm-back-title" type="button" onClick={onBack}>
          <ArrowLeft size={18} /> Split Money
        </button>
        <div className="sm-tools">
          <button className="sm-outline" type="button" disabled={busy || cancelled} onClick={startEditing}>
            Edit details
          </button>
          {expense.isDraft ? (
            <button className="sm-outline" type="button" disabled={busy} onClick={() => statusMutation.mutate("publish")}>
              Publish draft
            </button>
          ) : null}
          {cancelled ? (
            <button className="sm-outline" type="button" disabled={busy} onClick={() => statusMutation.mutate("pending")}>
              Reopen expense
            </button>
          ) : (
            <button
              className="sm-outline"
              type="button"
              disabled={busy}
              title={hasActiveRepayments ? "Reverse repayments before cancelling" : undefined}
              onClick={() => statusMutation.mutate("cancelled")}
            >
              Cancel expense
            </button>
          )}
          {!hasMoneyHistory ? (
            <button className="sm-outline" type="button" disabled={busy} onClick={() => deleteMutation.mutate()}>
              Delete
            </button>
          ) : null}
          <button
            className="sm-outline"
            type="button"
            disabled={busy || cancelled || reminderMutation.isPending}
            onClick={() => reminderMutation.mutate()}
          >
            {reminderMutation.isPending ? "Scheduling…" : "Schedule Reminder"}
          </button>
          <button
            className="sm-outline"
            type="button"
            disabled={busy}
            onClick={() => convertMutation.mutate()}
          >
            Convert to Borrow/Lend
          </button>
          <button
            className="sm-primary"
            type="button"
            disabled={busy || remaining <= 0 || settleMutation.isPending}
            onClick={() => settleMutation.mutate()}
          >
            {settleMutation.isPending ? "Settling…" : "Mark Settled"}
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
          {expense.isDraft ? " · draft" : ""}
          {expense.group ? ` · ${expense.group.name}` : ""}
          {expense.dueDate ? ` · due ${expense.dueDate}` : ""}
        </p>
        {expense.description ? <p>{expense.description}</p> : null}
      </section>

      {editing ? (
        <section className="sm-form-card" style={{ marginBottom: 16 }} aria-label="Edit expense details">
          <h2>Edit details</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>
            Amount, payers and shares are financial history. Use adjustments to change a share.
          </p>
          <div className="sm-fields">
            <label>
              Expense title
              <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </label>
            <label>
              Category
              <input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
            </label>
            <label>
              Description
              <input
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </label>
            <label>
              Settlement due date
              <input
                type="date"
                value={edit.dueDate}
                onChange={(e) => setEdit({ ...edit, dueDate: e.target.value })}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              className="sm-primary"
              type="button"
              disabled={editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "Saving…" : "Save details"}
            </button>
            <button
              className="sm-outline"
              type="button"
              disabled={editMutation.isPending}
              onClick={() => setEditing(false)}
            >
              Discard
            </button>
          </div>
        </section>
      ) : null}

      <section className="sm-stat-grid" aria-label="Expense summary">
        <article className="sm-stat green">
          <div>
            <b>{money(expense.totalAmountMinor, currency)}</b>
            <p>Total expense</p>
          </div>
        </article>
        <article className="sm-stat blue">
          <div>
            <b>{money(upfront, currency)}</b>
            <p>Paid upfront (bill)</p>
          </div>
        </article>
        <article className="sm-stat gold">
          <div>
            <b>{money(collected, currency)}</b>
            <p>Repayments received</p>
          </div>
        </article>
        <article className="sm-stat">
          <div>
            <b>{money(remaining, currency)}</b>
            <p>Repayment remaining</p>
          </div>
        </article>
      </section>

      <section className="sm-form-card" style={{ marginBottom: 16 }} aria-label="Settlement progress">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <strong>Settlement progress</strong>
          <span>
            {money(collected, currency)} of {money(collectible, currency)} collectible · {settledPct}%
          </span>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, settledPct))}%`,
              height: "100%",
              background: "var(--green, #55e7a0)",
            }}
          />
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
          Your share {money(expense.yourShareMinor ?? 0, currency)} · You paid upfront{" "}
          {money(expense.youPaidMinor ?? 0, currency)} · You owe{" "}
          {money(expense.youOweMinor ?? 0, currency)} · You are owed{" "}
          {money(expense.youAreOwedMinor ?? 0, currency)}
        </p>
        <p style={{ marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
          Upfront bill payments are separate from repayments. Recording a repayment does not transfer money.
        </p>
      </section>

      {(expense.obligations?.length ?? 0) > 0 ? (
        <section className="sm-form-card" style={{ marginBottom: 16 }} aria-label="Who owes whom">
          <h2>Who owes whom</h2>
          <div className="sm-breakdown">
            {expense.obligations!.map((edge) => (
              <div key={obligationKey(edge)}>
                <b>{edge.debtor?.fullName ?? "Someone"}</b>
                <span>owes</span>
                <strong>{money(edge.amountMinor, currency)}</strong>
                <em>to {edge.creditor?.fullName ?? "someone"}</em>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sm-wizard-grid">
        <section className="sm-form-card">
          <h2>Individual balances</h2>
          <div className="sm-breakdown">
            {(expense.balances ?? expense.participants ?? []).map((row, i) => {
              const person =
                "person" in row
                  ? row.person
                  : (expense.participants?.find((p) => p.personId === ("personId" in row ? row.personId : ""))
                      ?.person ?? null);
              const name =
                person && "fullName" in person
                  ? person.fullName
                  : ("personId" in row ? String(row.personId) : "?");
              const share =
                "adjustedShareMinor" in row
                  ? row.adjustedShareMinor
                  : "adjustedShareAmountMinor" in row
                    ? row.adjustedShareAmountMinor
                    : 0;
              const upfrontPaid =
                "upfrontPaidMinor" in row ? (row.upfrontPaidMinor ?? 0) : 0;
              const repaid =
                "repaymentSentMinor" in row
                  ? row.repaymentSentMinor
                  : "paidAmountMinor" in row
                    ? row.paidAmountMinor
                    : 0;
              const owed =
                "owedMinor" in row
                  ? row.owedMinor
                  : "pendingAmountMinor" in row
                    ? row.pendingAmountMinor
                    : 0;
              const receivable = "receivableMinor" in row ? (row.receivableMinor ?? 0) : 0;
              const status = "status" in row ? row.status : "pending";
              const last =
                "lastPaymentDate" in row && row.lastPaymentDate ? ` · last ${row.lastPaymentDate}` : "";
              return (
                <div key={"personId" in row ? row.personId : i}>
                  <span className={`sm-avatar ${avatarTone(i)} small`}>{initials(name)}</span>
                  <b>{name}</b>
                  <span>share {money(share, currency)}</span>
                  <strong>
                    {owed > 0
                      ? `owes ${money(owed, currency)}`
                      : receivable > 0
                        ? `owed ${money(receivable, currency)}`
                        : "settled"}
                  </strong>
                  <em>
                    upfront {money(upfrontPaid, currency)} · repaid {money(repaid, currency)} ·{" "}
                    {statusLabel(status)}
                    {last}
                  </em>
                </div>
              );
            })}
          </div>

          <h2 style={{ marginTop: 24 }}>Record repayment</h2>
          {obligations.length === 0 ? (
            <p>Nothing is outstanding on this expense.</p>
          ) : (
            <>
              <div className="sm-fields">
                <label>
                  Who pays whom
                  <select
                    value={obligationId || (selected ? obligationKey(selected) : "")}
                    onChange={(e) => setObligationId(e.target.value)}
                  >
                    {obligations.map((edge) => (
                      <option key={obligationKey(edge)} value={obligationKey(edge)}>
                        {edge.debtor?.fullName ?? "Debtor"} → {edge.creditor?.fullName ?? "Creditor"} (
                        {money(edge.amountMinor, currency)} left)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={selected ? String(selected.amountMinor / 100) : "0.00"}
                    inputMode="decimal"
                  />
                </label>
                <label>
                  Method
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as SplitPaymentMethod)}
                  >
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              {selected ? (
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
                  Remaining on this edge: {money(selected.amountMinor, currency)}
                  {payAmount
                    ? ` · After this: ${money(
                        Math.max(
                          0,
                          selected.amountMinor - Math.round(Number(payAmount.replace(/,/g, "")) * 100 || 0),
                        ),
                        currency,
                      )}`
                    : ""}
                </p>
              ) : null}
              <button
                className="sm-primary"
                type="button"
                style={{ marginTop: 12 }}
                disabled={busy || payMutation.isPending}
                onClick={() => payMutation.mutate()}
              >
                {payMutation.isPending ? "Recording…" : "Record repayment"}
              </button>
            </>
          )}

          <h2 style={{ marginTop: 24 }}>Adjustment / Waiver</h2>
          <div className="sm-fields">
            <label>
              Person
              <select value={adjParticipant} onChange={(e) => setAdjParticipant(e.target.value)}>
                <option value="">Select participant</option>
                {(expense.participants ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.person?.fullName} (share {money(p.adjustedShareAmountMinor, currency)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={adjType} onChange={(e) => setAdjType(e.target.value)}>
                <option value="discount">Discount (reduce)</option>
                <option value="waived">Waived (reduce)</option>
                <option value="refund">Refund (reduce)</option>
                <option value="correction">Correction</option>
                <option value="other">Other</option>
              </select>
            </label>
            {(adjType === "correction" || adjType === "other") && (
              <label>
                Direction
                <select
                  value={adjDirection}
                  onChange={(e) => setAdjDirection(e.target.value as "reduce" | "increase")}
                >
                  <option value="reduce">Reduce share</option>
                  <option value="increase">Increase share</option>
                </select>
              </label>
            )}
            <label>
              Amount
              <input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} inputMode="decimal" />
            </label>
          </div>
          <button
            className="sm-outline"
            type="button"
            style={{ marginTop: 12 }}
            disabled={busy || adjMutation.isPending}
            onClick={() => adjMutation.mutate()}
          >
            {adjMutation.isPending ? "Applying…" : "Apply adjustment"}
          </button>
          <div style={{ marginTop: 18 }}>
            <SplitReceiptsPanel expense={expense} onChanged={refresh} />
          </div>
        </section>

        <aside className="sm-preview">
          <h2>Payment history</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 8 }}>
            Manual settlement records. Hisaab does not send UPI/bank transfers.
          </p>
          {(expense.payments ?? []).length === 0 && <p>No repayments yet.</p>}
          {(expense.payments ?? []).map((p) => (
            <div key={p.id} className="sm-callout" style={{ marginBottom: 8, opacity: p.status === "voided" ? 0.55 : 1 }}>
              <Check size={16} />
              <div style={{ flex: 1 }}>
                <b>
                  {p.payer?.fullName ?? "Someone"} → {p.receiver?.fullName ?? "Someone"} ·{" "}
                  {money(p.amountMinor, currency)} via {p.method.replace("_", " ")}
                  {p.status === "voided" ? " (voided)" : ""}
                </b>
                <small>
                  {p.paymentDate}
                  {p.referenceId ? ` · ${p.referenceId}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                  {p.status === "voided" && p.voidReason ? ` · reversed: ${p.voidReason}` : ""}
                  {" · recorded "}
                  {new Date(p.createdAt).toLocaleString()}
                </small>
              </div>
              {p.status === "completed" && !cancelled ? (
                <button
                  type="button"
                  className="sm-icon-btn"
                  aria-label={`Reverse repayment of ${money(p.amountMinor, currency)}`}
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Reverse this ${money(p.amountMinor, currency)} repayment? The record stays in history as voided.`)) return;
                    const reason = window.prompt("Reason (optional)", "") ?? null;
                    voidMutation.mutate({ paymentId: p.id, reason: reason?.trim() || null });
                  }}
                >
                  Void
                </button>
              ) : null}
            </div>
          ))}
          <h2 style={{ marginTop: 18 }}>Activity log</h2>
          {(expense.activities ?? []).map((a) => (
            <div key={a.id} style={{ marginBottom: 8, fontSize: 12 }}>
              <b>{statusLabel(a.action)}</b>
              <small style={{ display: "block", color: "var(--muted-foreground)" }}>
                {new Date(a.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
          {(expense.reminders?.length ?? 0) > 0 ? (
            <>
              <h2 style={{ marginTop: 18 }}>Reminders</h2>
              {expense.reminders!.map((r) => (
                <div key={r.id} style={{ marginBottom: 8, fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <b>
                      {r.channel.replace("_", "-")} ·{" "}
                      {r.status === "sent"
                        ? "delivered in-app"
                        : r.status === "failed"
                          ? "not delivered (channel not connected)"
                          : r.status}
                    </b>
                    <small style={{ display: "block", color: "var(--muted-foreground)" }}>
                      Scheduled {new Date(r.scheduledAt).toLocaleString()}
                      {r.sentAt ? ` · delivered ${new Date(r.sentAt).toLocaleString()}` : ""}
                      {r.status === "scheduled" && r.deliveryAvailable === false
                        ? " · this channel is not connected; it will be marked failed"
                        : ""}
                    </small>
                  </div>
                  {r.status === "scheduled" ? (
                    <button
                      type="button"
                      className="sm-icon-btn"
                      disabled={busy}
                      aria-label="Cancel reminder"
                      onClick={() => cancelReminderMutation.mutate(r.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
