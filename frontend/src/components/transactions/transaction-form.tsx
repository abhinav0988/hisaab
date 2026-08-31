"use client";
import type { Account, Category, Transaction } from "@hisaab/types";
import { Button, Field, Input, Select, Textarea } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api-client";
import {
  accountDisplayName,
  isPaymentMethodType,
  paymentMethodAccounts,
  uniqueCatalogAccounts,
} from "@/lib/accounts";
import { transactionService } from "@/services/transaction.service";

function localParts(iso: string) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function shiftDate(value: string, days: number) {
  const next = new Date(`${value}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function TransactionForm({
  accounts,
  categories,
  currency,
  initial,
  defaultType = "EXPENSE",
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  currency: string;
  initial?: Transaction;
  defaultType?: "INCOME" | "EXPENSE";
  onSaved: () => void;
}) {
  const options = useMemo(
    () => uniqueCatalogAccounts(accounts, initial?.accountId),
    [accounts, initial?.accountId],
  );
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : "");
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? options[0]?.id ?? "",
  );
  const relevant = categories.filter((item) => item.type === type);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? relevant[0]?.id ?? "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const initialStamp = localParts(initial?.transactionAt ?? new Date().toISOString());
  const [date, setDate] = useState(initialStamp.date);
  const [time, setTime] = useState(initialStamp.time);
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const methodOptions = paymentMethodAccounts(options);
  const selectedAccount = options.find((item) => item.id === accountId);
  const paymentMethod =
    selectedAccount && isPaymentMethodType(selectedAccount.type) ? selectedAccount.type : "";
  const setKind = (next: "INCOME" | "EXPENSE") => {
    setType(next);
    setCategoryId(categories.find((item) => item.type === next)?.id ?? "");
  };
  const pick = (nextType: "INCOME" | "EXPENSE", categoryName: string, merchantValue: string) => {
    setKind(nextType);
    const match = categories.find(
      (item) => item.type === nextType && item.name.toLowerCase().includes(categoryName.toLowerCase()),
    );
    if (match) setCategoryId(match.id);
    setMerchant(merchantValue);
  };
  const setDatePreset = (kind: "today" | "yesterday" | "tomorrow" | "salary") => {
    const now = new Date();
    const stamp = localParts(now.toISOString());
    if (kind === "today") {
      setDate(stamp.date);
      setTime(stamp.time);
    }
    if (kind === "yesterday") setDate(shiftDate(stamp.date, -1));
    if (kind === "tomorrow") setDate(shiftDate(stamp.date, 1));
    if (kind === "salary") {
      const salary = new Date(now.getFullYear(), now.getMonth(), 25);
      setDate(localParts(salary.toISOString()).date);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        type,
        amountMinor: majorToMinor(amount),
        currency,
        accountId,
        categoryId,
        merchant: merchant || null,
        notes: notes || null,
        transactionAt: new Date(`${date}T${time || "00:00"}`).toISOString(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      if (initial) await transactionService.update(initial.id, body);
      else await transactionService.create(body);
      onSaved();
    } catch (cause) {
      const details =
        cause instanceof ApiError
          ? Object.values(cause.fieldErrors ?? {})
              .flat()
              .join(" ")
          : "";
      setError(
        cause instanceof ApiError
          ? [cause.message, details].filter(Boolean).join(" ")
          : cause instanceof Error
            ? cause.message
            : "Unable to save transaction.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="transaction-form">
      {!initial ? (
        <div className="transaction-hero">
          <b>Add a new transaction</b>
          <p>
            Maintain every expense and income properly with a clean layout, better spacing, and a
            simple calendar section.
          </p>
        </div>
      ) : null}
      <div className="transaction-layout">
        <div className="transaction-main">
          <section className="tx-card">
            <div className="tx-card-head">
              <div>
                <h3>Transaction details</h3>
                <p>Fill the key information for this entry.</p>
              </div>
              <span className="tx-step">01</span>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--muted)] p-1 sm:max-w-[280px]">
              <button
                type="button"
                onClick={() => setKind("EXPENSE")}
                className={`rounded-lg py-2 text-sm font-semibold ${type === "EXPENSE" ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setKind("INCOME")}
                className={`rounded-lg py-2 text-sm font-semibold ${type === "INCOME" ? "bg-[var(--surface)] shadow-sm" : "text-[var(--muted-foreground)]"}`}
              >
                Income
              </button>
            </div>
            <div className="form-grid mt-4">
              <Field label={type === "EXPENSE" ? "Merchant" : "Source"}>
                <Input
                  maxLength={120}
                  value={merchant}
                  onChange={(event) => setMerchant(event.target.value)}
                  placeholder="e.g. Fresh Basket, Uber, Salary"
                />
              </Field>
              <Field label={`Amount (${currency})`}>
                <Input
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="1500"
                />
              </Field>
              <Field label="Category">
                <Select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  {categories
                    .filter((item) => item.type === type)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field
                label="Account"
                hint={
                  options.length
                    ? "Choose the payment account this money moved through."
                    : undefined
                }
              >
                {options.length ? (
                  <Select
                    required
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    aria-label="Account"
                  >
                    {!accountId ? (
                      <option value="" disabled>
                        Select an account
                      </option>
                    ) : null}
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {accountDisplayName(item)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="rounded-[15px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-3.5 text-[12px] font-medium leading-relaxed text-[var(--muted-foreground)]">
                    Hisaab assigns Cash, Bank, UPI, Wallet, and card accounts automatically.{" "}
                    <Link className="font-extrabold text-[var(--primary)]" href="/accounts">
                      View accounts
                    </Link>
                  </div>
                )}
              </Field>
              {methodOptions.length ? (
                <Field
                  label="Payment method"
                  hint="Quick select for UPI or credit card."
                >
                  <Select
                    aria-label="Payment method"
                    value={paymentMethod}
                    onChange={(event) => {
                      const match = options.find((item) => item.type === event.target.value);
                      if (match) setAccountId(match.id);
                    }}
                  >
                    <option value="">Select UPI or credit card</option>
                    {methodOptions.map((item) => (
                      <option key={item.id} value={item.type}>
                        {accountDisplayName(item)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field label="Tags (comma separated)">
                <Input value={tags} onChange={(event) => setTags(event.target.value)} />
              </Field>
            </div>
          </section>
          <section className="tx-card">
            <div className="tx-card-head">
              <div>
                <h3>Date, time & note</h3>
                <p>Keep the transaction date and note properly maintained.</p>
              </div>
              <span className="tx-step">02</span>
            </div>
            <div className="form-grid">
              <Field label="Date" hint="Choose the exact transaction date from the calendar.">
                <div className="date-shell">
                  <span className="calendar-icon" aria-hidden="true">
                    <Calendar size={13} />
                  </span>
                  <Input
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
              </Field>
              <Field label="Time" hint="Optional time for more accurate tracking.">
                <div className="date-shell">
                  <span className="calendar-icon" aria-hidden="true">
                    <Clock size={13} />
                  </span>
                  <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                </div>
              </Field>
              <div className="full">
                <p className="mb-2 text-[12px] font-extrabold">Quick calendar shortcuts</p>
                <div className="date-presets">
                  <button type="button" className="date-chip" onClick={() => setDatePreset("today")}>
                    Today
                  </button>
                  <button
                    type="button"
                    className="date-chip"
                    onClick={() => setDatePreset("yesterday")}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    className="date-chip"
                    onClick={() => setDatePreset("tomorrow")}
                  >
                    Tomorrow
                  </button>
                  <button type="button" className="date-chip" onClick={() => setDatePreset("salary")}>
                    Salary day
                  </button>
                </div>
              </div>
              <div className="full">
                <Field label="Notes">
                  <Textarea
                    maxLength={500}
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add extra details like why you spent, merchant details, who paid, or anything important"
                  />
                </Field>
              </div>
            </div>
          </section>
          <p className="tx-footer-note">
            <span className="dot" />
            <span>Clean entries help budgets, reports, analytics, and monthly planning stay accurate.</span>
          </p>
        </div>
        <aside className="transaction-side">
          <div className="tx-side-block">
            <h3>Quick picks</h3>
            <div className="quick-grid">
              <button type="button" className="quick-chip" onClick={() => pick("EXPENSE", "food", "Fresh Basket")}>
                Food
                <small>Groceries, snacks & dining</small>
              </button>
              <button
                type="button"
                className="quick-chip"
                onClick={() => pick("EXPENSE", "transport", "Metro recharge")}
              >
                Transport
                <small>Travel, cab & fuel</small>
              </button>
              <button
                type="button"
                className="quick-chip"
                onClick={() => pick("EXPENSE", "shop", "Urban Style")}
              >
                Shopping
                <small>Fashion, retail & online orders</small>
              </button>
              <button
                type="button"
                className="quick-chip"
                onClick={() => pick("INCOME", "salary", "Monthly salary")}
              >
                Income
                <small>Salary, credits & refunds</small>
              </button>
            </div>
          </div>
          <div className="tx-side-block">
            <h3>Helpful guidance</h3>
            <div className="meta-block">
              <div className="meta-item">
                <b>Calendar tip</b>
                <small>Use the correct date so weekly and monthly analytics remain accurate.</small>
              </div>
              <div className="meta-item">
                <b>Clean naming</b>
                <small>Use proper merchant names so search and reports look organized.</small>
              </div>
              <div className="meta-item">
                <b>Premium workflow</b>
                <small>Receipt scan can prefill details, then you can review here before saving.</small>
              </div>
            </div>
          </div>
        </aside>
      </div>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button disabled={saving || !accountId || !categoryId || !options.length}>
          {saving ? "Saving…" : initial ? "Save changes" : `Add ${type.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
