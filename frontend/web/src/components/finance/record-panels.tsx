"use client";

import type { CreditFacility, LendRecord, OcrReceiptResult, RepaymentStatus, SplitExpense, SplitReceipt } from "@hisaab/types";
import { Button, Field, Input, Select } from "@hisaab/ui";
import { cardDueAmount, majorToMinor, normalizeTagName } from "@hisaab/validation";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/layout/modal";
import { API_URL } from "@/lib/api-client";
import { errorCode, fileKind, friendlyError, isScannable } from "@/lib/api-errors";
import { isoToday } from "@/lib/finance-modules";
import { money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
import { splitMoneyService } from "@/services/split-money.service";
import { transactionService } from "@/services/transaction.service";

const muted = "text-xs leading-relaxed text-[var(--muted-foreground)]";
const danger = "text-xs text-[var(--danger)]";
const heading = "text-sm font-black text-[var(--foreground)]";
const rowCls = "flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] px-3 py-2";

const repaymentLabels: Record<RepaymentStatus, string> = {
  PENDING: "Pending",
  PARTIALLY_REPAID: "Partially repaid",
  REPAID: "Repaid",
  OVERPAID: "Overpaid",
};
export const repaymentLabel = (status?: RepaymentStatus) => (status ? repaymentLabels[status] : "Pending");

function useOnce() {
  const busy = useRef(false);
  return {
    run(action: () => Promise<unknown>) {
      if (busy.current) return;
      busy.current = true;
      void action().finally(() => {
        busy.current = false;
      });
    },
  };
}

export function LendRepaymentPanel({ record }: { record: LendRecord }) {
  const client = useQueryClient();
  const history = useQuery({ queryKey: ["lend-records", record.id, "repayments"], queryFn: () => financeService.listLendRepayments(record.id) });
  const live = history.data?.record ?? record;
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(isoToday());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const key = useRef(crypto.randomUUID());
  const once = useOnce();

  const submit = () => {
    if (!(Number(amount) > 0)) return setError("Enter a repayment amount greater than 0.");
    if (!paidAt || paidAt > isoToday()) return setError("Paid date cannot be in the future.");
    setError("");
    once.run(async () => {
      setSaving(true);
      try {
        const result = await financeService.recordLendRepayment(record.id, { amountMinor: majorToMinor(amount), paidAt, note: note.trim() || null }, key.current);
        key.current = crypto.randomUUID();
        setAmount("");
        setNote("");
        setStatus(`Recorded ${money(majorToMinor(amount), record.currency)}. ${repaymentLabel(result.record.repaymentStatus)}.`);
        await Promise.all([client.invalidateQueries({ queryKey: ["lend-records"] }), client.invalidateQueries({ queryKey: ["dashboard"] })]);
      } catch (e) {
        setError(friendlyError(e, "Could not record repayment."));
      } finally {
        setSaving(false);
      }
    });
  };

  const items = [...(history.data?.items ?? [])].sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));
  const remaining = live.remainingMinor ?? live.amountMinor;
  return (
    <section className="grid gap-3" aria-label="Repayments">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Principal" value={money(live.amountMinor, live.currency)} />
        <Stat label="Repaid" value={money(live.totalRepaidMinor ?? 0, live.currency)} />
        <Stat label={remaining < 0 ? "Overpaid" : "Remaining"} value={money(Math.abs(remaining), live.currency)} />
      </div>
      <p className={muted}>Status: <strong>{repaymentLabel(live.repaymentStatus)}</strong></p>
      <h3 className={heading}>Record repayment</h3>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Amount">
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Paid date">
          <Input type="date" max={isoToday()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI, cash, etc." />
        </Field>
        <div className="flex items-center justify-end gap-3 sm:col-span-3">
          {error ? <span className={danger} role="alert">{error}</span> : status ? <span className={muted} role="status">{status}</span> : null}
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Record repayment"}</Button>
        </div>
      </form>
      <h3 className={heading}>Repayment history</h3>
      <HistoryState query={history} empty="No repayments recorded yet." count={items.length} />
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id} className={rowCls}>
            <span>
              <strong className="text-sm">{item.paidAt}</strong>
              <span className={`block ${muted}`}>{item.note ?? "No note"}</span>
            </span>
            <strong className="text-sm">{money(item.amountMinor, live.currency)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

const frequencies = [
  { value: "ONCE", label: "Once" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BEFORE_DUE", label: "Day before due" },
] as const;
type Frequency = (typeof frequencies)[number]["value"];
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function LendReminderPanel({ record }: { record: LendRecord }) {
  const client = useQueryClient();
  const queryKey = ["lend-records", record.id, "reminder"];
  const reminder = useQuery({ queryKey, queryFn: () => financeService.getLendReminder(record.id) });
  const current = reminder.data?.reminder ?? null;
  const initial = current ? new Date(current.remindAt) : null;
  const [enabled, setEnabled] = useState(current?.enabled ?? true);
  const [date, setDate] = useState(initial ? stamp(current!.remindAt).slice(0, 10) : isoToday());
  const [time, setTime] = useState(initial ? stamp(current!.remindAt).slice(11) : "09:00");
  const [frequency, setFrequency] = useState<Frequency>((current?.frequency as Frequency) ?? "ONCE");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOff, setConfirmOff] = useState(false);
  const once = useOnce();
  const settled = record.status === "settled" || record.repaymentStatus === "REPAID" || record.repaymentStatus === "OVERPAID";

  const save = () =>
    once.run(async () => {
      const at = new Date(`${date}T${time}:00`);
      if (Number.isNaN(at.getTime())) return setError("Choose a valid reminder time.");
      setBusy(true);
      setError("");
      try {
        await financeService.putLendReminder(record.id, { enabled, remindAt: at.toISOString(), frequency });
        await client.invalidateQueries({ queryKey });
        setMessage(enabled ? "Reminder saved." : "Reminder saved as off.");
      } catch (e) {
        setError(friendlyError(e, "Could not save reminder."));
      } finally {
        setBusy(false);
      }
    });

  const turnOff = () =>
    once.run(async () => {
      setBusy(true);
      try {
        await financeService.deleteLendReminder(record.id);
        await client.invalidateQueries({ queryKey });
        setMessage("Reminder turned off.");
        setConfirmOff(false);
      } catch (e) {
        setError(friendlyError(e, "Could not turn off reminder."));
      } finally {
        setBusy(false);
      }
    });

  const notice = reminder.data?.notices[0];
  return (
    <section className="grid gap-3" aria-label="Reminder">
      <h3 className={heading}>Reminder</h3>
      {reminder.isLoading ? <p className={muted}>Loading reminder…</p> : null}
      {reminder.isError ? <p className={danger}>{friendlyError(reminder.error, "Could not load reminder.")}</p> : null}
      <p className={muted}>
        {current ? (current.enabled ? `On · ${frequencies.find((f) => f.value === current.frequency)?.label ?? current.frequency} · next ${stamp(current.nextRunAt)}` : "Off") : "No reminder set."}
        {notice ? ` · Last shown in the app ${stamp(notice.createdAt)}` : ""}
      </p>
      {settled ? (
        <p className={muted}>This record is fully repaid, so reminders are not available.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Enabled">
            <Select value={enabled ? "on" : "off"} onChange={(e) => setEnabled(e.target.value === "on")}>
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Frequency">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-4">
            {error ? <span className={danger} role="alert">{error}</span> : message ? <span className={muted} role="status">{message}</span> : null}
            {current ? <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmOff(true)}>Turn off reminder</Button> : null}
            <Button type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : current ? "Update reminder" : "Save reminder"}</Button>
          </div>
        </div>
      )}
      <p className={muted}>Reminders appear inside Hisaab only. Email and push delivery are not available yet.</p>
      <ConfirmDialog open={confirmOff} title="Turn off reminder?" description="No further reminders will be created for this record." confirmLabel="Turn off" busy={busy} onClose={() => setConfirmOff(false)} onConfirm={turnOff} />
    </section>
  );
}

export type HistoryRow = { id: string; paidAt: string; createdAt: string; title: string; detail: string; amount: string };
export function PaymentHistoryList({ query, rows, empty }: { query: UseQueryResult<unknown>; rows: HistoryRow[]; empty: string }) {
  const sorted = [...rows].sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="grid gap-2" aria-label="Payment history">
      <h3 className={heading}>Payment history</h3>
      <HistoryState query={query} empty={empty} count={sorted.length} />
      <ul className="grid gap-2">
        {sorted.map((row) => (
          <li key={row.id} className={rowCls}>
            <span>
              <strong className="text-sm">{row.title}</strong>
              <span className={`block ${muted}`}>{row.detail}</span>
            </span>
            <strong className="text-sm">{row.amount}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LoanPaymentHistory({ loanId, currency }: { loanId: string; currency: string }) {
  const query = useQuery({ queryKey: ["loans", loanId, "payments"], queryFn: () => financeService.listLoanPayments(loanId) });
  return (
    <PaymentHistoryList
      query={query}
      empty="No EMI payments recorded yet."
      rows={(query.data ?? []).map((item) => ({ id: item.id, paidAt: item.paidAt, createdAt: item.createdAt, title: `Installment ${item.installmentNumber ?? "—"}`, detail: `${item.paidAt.slice(0, 10)} · ${item.paymentType}`, amount: money(item.amountMinor, currency) }))}
    />
  );
}

export function FacilityPaymentHistory({ facilityId, currency }: { facilityId: string; currency: string }) {
  const query = useQuery({ queryKey: ["credit-facilities", facilityId, "payments"], queryFn: () => financeService.listFacilityPayments(facilityId) });
  return (
    <PaymentHistoryList
      query={query}
      empty="No payments recorded yet."
      rows={(query.data ?? []).map((item) => ({ id: item.id, paidAt: item.paidAt, createdAt: item.createdAt, title: item.paidAt.slice(0, 10), detail: `${item.kind === "UPI" ? "UPI credit" : "Card"} payment · ${item.statementPeriod ? `statement ${item.statementPeriod}` : "no statement period"}`, amount: money(item.amountMinor, currency) }))}
    />
  );
}

export function FacilityPayPanel({ facility }: { facility: CreditFacility }) {
  const client = useQueryClient();
  const live = useQuery({ queryKey: ["credit-facilities", facility.id], queryFn: () => financeService.getCreditFacility(facility.id), initialData: facility });
  const x = live.data ?? facility;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const once = useOnce();
  const due = cardDueAmount(x);
  const pay = () =>
    once.run(async () => {
      setBusy(true);
      try {
        await financeService.payCreditFacility(x.id);
        await Promise.all([
          client.invalidateQueries({ queryKey: ["credit-facilities"] }),
          client.invalidateQueries({ queryKey: ["credit-dashboard"] }),
          client.invalidateQueries({ queryKey: ["dashboard"] }),
        ]);
        setMessage("Payment recorded.");
        setConfirming(false);
      } catch (e) {
        setMessage(friendlyError(e, "Could not record payment."));
        setConfirming(false);
      } finally {
        setBusy(false);
      }
    });
  return (
    <section className="grid gap-3" aria-label="Payment">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Used balance" value={money(x.usedMinor, x.currency)} />
        <Stat label={x.overdueMinor > 0 ? "Overdue" : "Due amount"} value={money(due, x.currency)} />
        <Stat label="Due date" value={x.dueOn ?? "Not set"} />
      </div>
      <div className="flex items-center justify-end gap-3">
        {message ? <span className={muted} role="status">{message}</span> : null}
        <Button type="button" disabled={busy || due <= 0} onClick={() => setConfirming(true)}>{busy ? "Paying…" : "Record payment"}</Button>
      </div>
      {due <= 0 ? <p className={muted}>Nothing is due. Set a minimum due or overdue amount first.</p> : null}
      <FacilityPaymentHistory facilityId={x.id} currency={x.currency} />
      <ConfirmDialog open={confirming} title="Confirm payment" description={`Pay ${money(due, x.currency)} ${x.overdueMinor > 0 ? "overdue" : "minimum due"} on ${x.name}? Used balance ${money(x.usedMinor, x.currency)}, due ${x.dueOn ?? "not set"}.`} confirmLabel="Pay" busy={busy} onClose={() => setConfirming(false)} onConfirm={pay} />
    </section>
  );
}

function HistoryState({ query, empty, count }: { query: UseQueryResult<unknown>; empty: string; count: number }) {
  if (query.isLoading) return <p className={muted}>Loading history…</p>;
  if (query.isError) return <p className={danger}>{friendlyError(query.error, "Could not load history.")}</p>;
  if (query.isSuccess && !count) return <p className={muted}>{empty}</p>;
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--border)] px-2 py-2">
      <span className={`block ${muted}`}>{label}</span>
      <strong className="text-sm">{value}</strong>
    </div>
  );
}

export function TagSelector({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const client = useQueryClient();
  const tags = useQuery({ queryKey: ["tags"], queryFn: transactionService.listTags });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const once = useOnce();
  const selected = new Set(value.map(normalizeTagName));
  const toggle = (name: string) =>
    onChange(selected.has(normalizeTagName(name)) ? value.filter((v) => normalizeTagName(v) !== normalizeTagName(name)) : [...value, name]);

  const create = () =>
    once.run(async () => {
      const name = draft.trim();
      if (!name) return setError("Enter a tag name.");
      const existing = tags.data?.find((t) => normalizeTagName(t.name) === normalizeTagName(name));
      if (existing) {
        if (!selected.has(normalizeTagName(existing.name))) onChange([...value, existing.name]);
        setDraft("");
        return setError("This tag already exists. It has been selected.");
      }
      setCreating(true);
      setError("");
      try {
        const tag = await transactionService.createTag(name);
        await client.invalidateQueries({ queryKey: ["tags"] });
        onChange([...value, tag.name]);
        setDraft("");
      } catch (e) {
        setError(friendlyError(e, "Could not create tag."));
        if (errorCode(e) === "TAG_EXISTS") void tags.refetch();
      } finally {
        setCreating(false);
      }
    });

  return (
    <div className="grid gap-2">
      <span className="text-[13px] font-extrabold">Tags</span>
      <div className="flex flex-wrap gap-2">
        {tags.isLoading ? <span className={muted}>Loading tags…</span> : null}
        {tags.data?.map((tag) => {
          const on = selected.has(normalizeTagName(tag.name));
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(tag.name)}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${on ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}
            >
              #{tag.name}
            </button>
          );
        })}
        {tags.isSuccess && !tags.data.length ? <span className={muted}>No tags yet.</span> : null}
      </div>
      <div className="flex gap-2">
        <Input
          aria-label="New tag"
          placeholder="New tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
        />
        <Button type="button" variant="secondary" disabled={creating} onClick={create}>{creating ? "Creating…" : "Create tag"}</Button>
      </div>
      {error ? <span className={danger} role="alert">{error}</span> : null}
    </div>
  );
}

export function TransactionAttachmentsPanel({ transactionId }: { transactionId: string }) {
  const client = useQueryClient();
  const key = ["transaction", transactionId, "attachments"];
  const attachments = useQuery({ queryKey: key, queryFn: () => transactionService.listAttachments(transactionId) });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const once = useOnce();

  const upload = (file: File) =>
    once.run(async () => {
      setBusy("attach");
      setMessage(`Uploading ${file.name}…`);
      try {
        const stored = await splitMoneyService.uploadFile(file);
        setMessage("Attaching…");
        await transactionService.attach(transactionId, stored.id);
        await client.invalidateQueries({ queryKey: key });
        setMessage(`Attached ${stored.originalName}`);
      } catch (e) {
        setMessage(friendlyError(e, "Could not attach this file."));
      } finally {
        setBusy(null);
        if (input.current) input.current.value = "";
      }
    });

  const remove = () =>
    once.run(async () => {
      if (!removing) return;
      setBusy(`remove:${removing.id}`);
      try {
        await transactionService.removeAttachment(transactionId, removing.id);
        await client.invalidateQueries({ queryKey: key });
        setMessage("Attachment removed");
        setRemoving(null);
      } catch (e) {
        setMessage(friendlyError(e, "Could not remove attachment."));
      } finally {
        setBusy(null);
      }
    });

  return (
    <section className="grid gap-2" aria-label="Attachments">
      <h3 className={heading}>Attachments</h3>
      {attachments.isLoading ? <p className={muted}>Loading attachments…</p> : null}
      {attachments.isError ? <p className={danger}>{friendlyError(attachments.error, "Could not load attachments.")}</p> : null}
      {attachments.isSuccess && !attachments.data.length ? <p className={muted}>No attachments yet. Add a JPEG, PNG, or PDF up to 8 MB.</p> : null}
      <ul className="grid gap-2">
        {attachments.data?.map((item) => (
          <li key={item.id} className={rowCls}>
            <a className="min-w-0 truncate text-sm font-bold text-[var(--primary)]" href={`${API_URL}/api/v1/files/${item.fileId}`} target="_blank" rel="noopener noreferrer">
              {item.originalName}
              <span className={`block ${muted}`}>{fileKind(item.mimeType)} · Open</span>
            </a>
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setRemoving({ id: item.id, name: item.originalName })}>Remove</Button>
          </li>
        ))}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
      <div className="flex items-center justify-end gap-3">
        {message ? <span className={muted} role="status">{message}</span> : null}
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => input.current?.click()}>{busy === "attach" ? "Attaching…" : "Add attachment"}</Button>
      </div>
      <ConfirmDialog open={Boolean(removing)} title="Remove attachment?" description={`${removing?.name ?? "This file"} will be unlinked from this transaction.`} confirmLabel="Remove" busy={busy !== null} onClose={() => setRemoving(null)} onConfirm={remove} />
    </section>
  );
}

const minorText = (v: number | null) => (v == null ? "" : (v / 100).toFixed(2));

export function SplitReceiptsPanel({ expense, onChanged }: { expense: SplitExpense; onChanged: () => Promise<unknown> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [removing, setRemoving] = useState<SplitReceipt | null>(null);
  const [scan, setScan] = useState<OcrReceiptResult | null>(null);
  const [fields, setFields] = useState({ merchant: "", date: "", total: "", currency: "", tax: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState("");
  const once = useOnce();
  const receipts = expense.receipts ?? [];

  const upload = (file: File) =>
    once.run(async () => {
      setBusy("upload");
      setStatus(`Uploading ${file.name}…`);
      try {
        const stored = await splitMoneyService.uploadFile(file);
        setStatus(`Attaching ${stored.originalName}…`);
        try {
          await splitMoneyService.attachReceipt(expense.id, stored.id);
        } catch (e) {
          setStatus(`${stored.originalName} uploaded but could not be attached. ${friendlyError(e)}`);
          return;
        }
        await onChanged();
        setStatus(`Attached ${stored.originalName}`);
      } catch (e) {
        setStatus(friendlyError(e, "Could not upload this receipt."));
      } finally {
        setBusy(null);
        if (input.current) input.current.value = "";
      }
    });

  const remove = () =>
    once.run(async () => {
      if (!removing) return;
      setBusy(`remove:${removing.id}`);
      try {
        await splitMoneyService.deleteReceipt(expense.id, removing.id);
        await onChanged();
        setStatus("Receipt removed");
        setRemoving(null);
      } catch (e) {
        setStatus(friendlyError(e, "Could not remove receipt."));
      } finally {
        setBusy(null);
      }
    });

  const runScan = (receipt: SplitReceipt) =>
    once.run(async () => {
      if (!receipt.fileId) return;
      setBusy(`scan:${receipt.id}`);
      setConfirmed(false);
      setFormError("");
      setStatus("Scanning receipt…");
      try {
        const result = await splitMoneyService.scanReceipt(receipt.fileId);
        setScan(result);
        setFields({ merchant: result.merchant ?? "", date: result.date ?? "", total: minorText(result.totalMinor), currency: result.currency ?? "", tax: minorText(result.taxMinor) });
        setStatus(result.detected ? "Review the suggestion. Nothing is saved until you confirm." : "No receipt text was detected. Enter the details manually.");
      } catch (e) {
        setScan(null);
        setStatus(friendlyError(e, "Could not scan this receipt. You can enter the details manually."));
      } finally {
        setBusy(null);
      }
    });

  const confirm = () => {
    const amount = /^\d+(\.\d{1,2})?$/;
    if ((fields.total && !amount.test(fields.total)) || (fields.tax && !amount.test(fields.tax))) return setFormError("Total and tax must be amounts like 125.50.");
    if (fields.date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) return setFormError("Date must be YYYY-MM-DD.");
    if (fields.currency && !/^[A-Za-z]{3}$/.test(fields.currency)) return setFormError("Currency must be a 3-letter code like INR.");
    setFormError("");
    setConfirmed(true);
    setStatus("Values confirmed. No transaction has been created.");
  };
  const set = (name: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [name]: e.target.value }));
    setConfirmed(false);
  };

  return (
    <section className="grid gap-3" aria-label="Receipts">
      <h3 className={heading}>Receipts</h3>
      {receipts.length ? (
        <ul className="grid gap-2">
          {receipts.map((receipt) => (
            <li key={receipt.id} className={rowCls}>
              <span className="min-w-0">
                <strong className="block truncate text-sm">{receipt.fileName ?? "Receipt"}</strong>
                <span className={muted}>{fileKind(receipt.mimeType)} · Uploaded</span>
              </span>
              <span className="flex gap-2">
                {isScannable(receipt.mimeType) && receipt.fileId ? (
                  <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => runScan(receipt)}>{busy === `scan:${receipt.id}` ? "Scanning…" : "Scan"}</Button>
                ) : <span className={muted}>PDF · not scannable</span>}
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setRemoving(receipt)}>Remove</Button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={muted}>No receipts yet. Add an image or PDF up to 8 MB.</p>}
      <input ref={input} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
      <div className="flex items-center justify-end gap-3">
        {status ? <span className={muted} role="status">{status}</span> : null}
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => input.current?.click()}>{busy === "upload" ? "Uploading…" : "Add receipt"}</Button>
      </div>
      {scan ? (
        <div className="grid gap-3 rounded-[16px] border border-[var(--border)] p-3 sm:grid-cols-5">
          <p className={`${muted} sm:col-span-5`}>Scanned suggestion · {scan.detected ? `confidence ${Math.round((scan.confidence ?? 0) * 100)}%` : "nothing detected"}</p>
          <Field label="Merchant"><Input placeholder="Not detected" value={fields.merchant} onChange={set("merchant")} /></Field>
          <Field label="Date"><Input placeholder="YYYY-MM-DD" value={fields.date} onChange={set("date")} /></Field>
          <Field label="Total"><Input placeholder="Not detected" inputMode="decimal" value={fields.total} onChange={set("total")} /></Field>
          <Field label="Currency"><Input placeholder="Not detected" value={fields.currency} onChange={set("currency")} /></Field>
          <Field label="Tax"><Input placeholder="Not detected" inputMode="decimal" value={fields.tax} onChange={set("tax")} /></Field>
          <div className="sm:col-span-5">
            <span className={muted}>Items: </span>
            {scan.items.length ? scan.items.map((line, i) => <span key={`${line.name}-${i}`} className={muted}>{i ? ", " : ""}{line.name}{line.quantity != null ? ` × ${line.quantity}` : ""}{line.amountMinor != null ? ` (${minorText(line.amountMinor)})` : ""}</span>) : <span className={muted}>No line items detected.</span>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-5">
            {formError ? <span className={danger} role="alert">{formError}</span> : null}
            <Button type="button" variant="ghost" onClick={() => { setScan(null); setConfirmed(false); setStatus("Suggestion discarded. Nothing was saved."); }}>Discard</Button>
            <Button type="button" disabled={confirmed} onClick={confirm}>{confirmed ? "Confirmed" : "Confirm values"}</Button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog open={Boolean(removing)} title="Remove receipt?" description={`${removing?.fileName ?? "This receipt"} will be unlinked from this expense. The uploaded file is kept.`} confirmLabel="Remove" busy={busy !== null} onClose={() => setRemoving(null)} onConfirm={remove} />
    </section>
  );
}
