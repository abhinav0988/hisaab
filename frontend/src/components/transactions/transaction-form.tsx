"use client";
import type { Account, Category, CreditSpendImpact, Transaction } from "@hisaab/types";
import { Button, Field, Input, Select, Textarea } from "@hisaab/ui";
import { creditSpendDelta, majorToMinor, nextCreditBalances } from "@hisaab/validation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api-client";
import {
  accountDisplayName,
  creditKindForAccount,
  isPaymentMethodType,
  paymentMethodAccounts,
  uniqueCatalogAccounts,
} from "@/lib/accounts";
import { bankAccountLabel, bankSpendCopy } from "@/lib/bank";
import { creditFacilityLabel, displayDateLong } from "@/lib/finance-modules";
import { money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
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
  bankAccounts,
  categories,
  currency,
  initial,
  defaultType = "EXPENSE",
  onSaved,
}: {
  accounts: Account[];
  bankAccounts: Account[];
  categories: Category[];
  currency: string;
  initial?: Transaction;
  defaultType?: "INCOME" | "EXPENSE";
  onSaved: (credit?: CreditSpendImpact | null, bankMessage?: string) => void;
}) {
  const options = useMemo(
    () => uniqueCatalogAccounts(accounts, initial?.accountId),
    [accounts, initial?.accountId],
  );
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : "");
  const [channelAccountId, setChannelAccountId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories.find((item) => item.type === (initial?.type ?? defaultType))?.id ?? "",
  );
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const initialStamp = localParts(initial?.transactionAt ?? new Date().toISOString());
  const [date, setDate] = useState(initialStamp.date);
  const [time, setTime] = useState(initialStamp.time);
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creditFacilityId, setCreditFacilityId] = useState("");

  useEffect(() => {
    if (channelAccountId) return;
    if (initial) {
      const hit =
        accounts.find((item) => item.id === initial.accountId) ??
        bankAccounts.find((item) => item.id === initial.accountId);
      if (hit?.type === "BANK") {
        setChannelAccountId(options.find((item) => item.type === "BANK")?.id ?? hit.id);
        setBankAccountId(hit.id);
        return;
      }
      setChannelAccountId(initial.accountId);
      return;
    }
    setChannelAccountId(options[0]?.id ?? "");
  }, [channelAccountId, initial, accounts, bankAccounts, options]);

  const methodOptions = paymentMethodAccounts(options);
  const selectedChannel = options.find((item) => item.id === channelAccountId);
  const isBankChannel = selectedChannel?.type === "BANK";
  const activeBankId = isBankChannel
    ? bankAccountId || bankAccounts[0]?.id || ""
    : "";
  const accountId = isBankChannel ? activeBankId : channelAccountId;
  const paymentMethod =
    selectedChannel && isPaymentMethodType(selectedChannel.type) ? selectedChannel.type : "";
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
    retry: false,
  });
  const creditKind = selectedChannel ? creditKindForAccount(selectedChannel.type) : null;
  const creditOptions = (facilities.data ?? []).filter((item) => item.kind === creditKind);
  const selectedBank = isBankChannel
    ? bankAccounts.find((item) => item.id === activeBankId)
    : undefined;
  const bankPreview = useMemo(() => {
    if (!selectedBank) return null;
    try {
      const deltaMinor =
        type === "EXPENSE" ? -majorToMinor(amount || "0") : majorToMinor(amount || "0");
      return {
        deltaMinor,
        nextBalanceMinor: selectedBank.currentBalanceMinor + deltaMinor,
      };
    } catch {
      return {
        deltaMinor: 0,
        nextBalanceMinor: selectedBank.currentBalanceMinor,
      };
    }
  }, [amount, selectedBank, type]);
  const selectedFacility =
    creditKind === "CARD"
      ? (creditOptions.find((item) => item.id === creditFacilityId) ??
        creditOptions.find((item) => item.accountId === accountId) ??
        creditOptions[0])
      : creditKind === "UPI"
        ? creditOptions.find((item) => item.id === creditFacilityId)
        : undefined;
  const creditPreview = useMemo(() => {
    if (!selectedFacility) return null;
    try {
      const deltaMinor = creditSpendDelta(type, majorToMinor(amount || "0"));
      const next = nextCreditBalances({
        usedMinor: selectedFacility.usedMinor,
        holdMinor: selectedFacility.holdMinor,
        limitMinor: selectedFacility.limitMinor,
        todaySpendMinor: selectedFacility.todaySpendMinor,
        overdueMinor: selectedFacility.overdueMinor,
        minDueMinor: selectedFacility.minDueMinor,
        deltaMinor,
      });
      return { ...next, name: selectedFacility.name, dueOn: selectedFacility.dueOn, deltaMinor };
    } catch {
      return {
        spentMinor: 0,
        usedMinor: selectedFacility.usedMinor,
        availableMinor: Math.max(
          0,
          selectedFacility.limitMinor - selectedFacility.usedMinor - (selectedFacility.holdMinor ?? 0),
        ),
        pendingMinor:
          selectedFacility.overdueMinor > 0
            ? selectedFacility.overdueMinor
            : selectedFacility.minDueMinor || selectedFacility.usedMinor,
        name: selectedFacility.name,
        dueOn: selectedFacility.dueOn,
        deltaMinor: 0,
      };
    }
  }, [amount, selectedFacility, type]);
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
        ...(selectedFacility ? { creditFacilityId: selectedFacility.id } : {}),
      };
      const saved = initial
        ? await transactionService.update(initial.id, body)
        : await transactionService.create(body);
      const bankMessage =
        selectedBank && bankPreview && !selectedFacility
          ? bankSpendCopy(
              selectedBank,
              bankPreview.deltaMinor,
              bankPreview.nextBalanceMinor,
              currency,
            )
          : undefined;
      onSaved(saved.credit, bankMessage);
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
                    value={channelAccountId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setChannelAccountId(nextId);
                      setCreditFacilityId("");
                      const next = options.find((item) => item.id === nextId);
                      if (next?.type === "BANK" && bankAccounts[0]) {
                        setBankAccountId(bankAccounts[0].id);
                      } else {
                        setBankAccountId("");
                      }
                    }}
                    aria-label="Account"
                  >
                    {!channelAccountId ? (
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
                  hint="Bank, UPI and credit card let you pick a saved account or card."
                >
                  <Select
                    aria-label="Payment method"
                    value={paymentMethod}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        const fallback =
                          options.find((item) => item.type === "CASH") ??
                          options.find((item) => item.type === "DEBIT_CARD") ??
                          options.find((item) => !isPaymentMethodType(item.type));
                        if (fallback) {
                          setChannelAccountId(fallback.id);
                          setBankAccountId("");
                        }
                        setCreditFacilityId("");
                        return;
                      }
                      const match = options.find((item) => item.type === value);
                      if (match) {
                        setChannelAccountId(match.id);
                        setCreditFacilityId("");
                        if (match.type === "BANK" && bankAccounts[0]) {
                          setBankAccountId(bankAccounts[0].id);
                        } else {
                          setBankAccountId("");
                        }
                      }
                    }}
                  >
                    <option value="">Normal payment (cash, debit)</option>
                    {methodOptions.map((item) => (
                      <option key={item.id} value={item.type}>
                        {item.type === "CREDIT_CARD"
                          ? "Credit card"
                          : item.type === "BANK"
                            ? "Bank"
                            : "UPI"}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {isBankChannel && !bankAccounts.length ? (
                <div className="full credit-spend-note">
                  <b>Add a bank account first</b>
                  <p>
                    Save your bank accounts on the Bank page, then pick which one this transaction
                    affects.{" "}
                    <Link className="font-extrabold text-[var(--primary)]" href="/bank">
                      Open Bank
                    </Link>
                  </p>
                </div>
              ) : null}
              {isBankChannel && bankAccounts.length ? (
                <div className="full">
                  <Field
                    label="Bank account"
                    hint="Pick the saved bank account. Expense reduces balance; income increases it."
                  >
                    <Select
                      aria-label="Bank account"
                      required
                      value={activeBankId}
                      onChange={(event) => setBankAccountId(event.target.value)}
                    >
                      {bankAccounts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {bankAccountLabel(item, currency)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {selectedBank && bankPreview ? (
                    <div className="credit-spend-note">
                      <b>{bankAccountLabel(selectedBank, currency)}</b>
                      <p>
                        {type === "EXPENSE" && bankPreview.deltaMinor < 0
                          ? `${money(Math.abs(bankPreview.deltaMinor), currency)} will be deducted from this account. `
                          : type === "INCOME" && bankPreview.deltaMinor > 0
                            ? `${money(bankPreview.deltaMinor, currency)} will be added to this account. `
                            : null}
                        Available balance will be {money(bankPreview.nextBalanceMinor, currency)}.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {creditKind === "CARD" && !creditOptions.length ? (
                <div className="full credit-spend-note">
                  <b>Choose a saved credit card</b>
                  <p>
                    Add a card under Credit Cards first. Then this payment will show last 4 digits
                    and reduce that card’s available limit.
                  </p>
                </div>
              ) : null}
              {creditKind === "CARD" && creditOptions.length ? (
                <div className="full">
                  <Field
                    label="Credit card"
                    hint="Pick the saved card. Last 4 digits identify it, and this amount comes off that card’s available limit."
                  >
                    <Select
                      aria-label="Credit card"
                      required
                      value={selectedFacility?.id ?? ""}
                      onChange={(event) => setCreditFacilityId(event.target.value)}
                    >
                      {creditOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {creditFacilityLabel(item, currency)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {creditPreview ? (
                    <div className="credit-spend-note">
                      <b>
                        {selectedFacility?.mask
                          ? `${creditPreview.name} · ${selectedFacility.mask}`
                          : creditPreview.name}
                      </b>
                      <p>
                        {type === "EXPENSE" && creditPreview.deltaMinor > 0
                          ? `${money(creditPreview.deltaMinor, currency)} will be deducted from this card. `
                          : type === "INCOME" && creditPreview.deltaMinor < 0
                            ? `${money(Math.abs(creditPreview.deltaMinor), currency)} will reduce used credit on this card. `
                            : null}
                        Available will be {money(creditPreview.availableMinor, currency)}. Pending{" "}
                        {money(creditPreview.pendingMinor, currency)}
                        {creditPreview.dueOn
                          ? ` · due ${displayDateLong(creditPreview.dueOn)}`
                          : ""}
                        .
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {creditKind === "UPI" && creditOptions.length ? (
                <div className="full">
                  <Field
                    label="UPI credit line"
                    hint="Only UPI Credit is deducted. Regular UPI stays a normal payment."
                  >
                    <Select
                      aria-label="UPI credit line"
                      value={selectedFacility?.id ?? ""}
                      onChange={(event) => setCreditFacilityId(event.target.value)}
                    >
                      <option value="">Regular UPI — do not use credit</option>
                      {creditOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {creditFacilityLabel(item, currency)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {selectedFacility && creditPreview ? (
                    <div className="credit-spend-note">
                      <b>
                        {selectedFacility.mask
                          ? `${creditPreview.name} · ${selectedFacility.mask}`
                          : creditPreview.name}
                      </b>
                      <p>
                        {type === "EXPENSE" && creditPreview.deltaMinor > 0
                          ? `${money(creditPreview.deltaMinor, currency)} will be deducted from this UPI credit line. `
                          : null}
                        Available will be {money(creditPreview.availableMinor, currency)}.
                      </p>
                    </div>
                  ) : null}
                </div>
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
        <Button
          disabled={
            saving ||
            !accountId ||
            !categoryId ||
            !options.length ||
            (isBankChannel && !bankAccounts.length)
          }
        >
          {saving ? "Saving…" : initial ? "Save changes" : `Add ${type.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
