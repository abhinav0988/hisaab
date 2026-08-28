"use client";
import type { Account, Category, Transaction } from "@hisaab/types";
import { Button, Field, Input, Select, Textarea } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { transactionService } from "@/services/transaction.service";

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
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const relevant = categories.filter((item) => item.type === type);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? relevant[0]?.id ?? "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [transactionAt, setTransactionAt] = useState(
    (initial?.transactionAt ?? new Date().toISOString()).slice(0, 16),
  );
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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
        transactionAt: new Date(transactionAt).toISOString(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      if (initial) await transactionService.update(initial.id, body);
      else await transactionService.create(body);
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Unable to save transaction.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      {!initial ? (
        <div className="rounded-[18px] border border-[color-mix(in_srgb,var(--primary)_12%,var(--border))] bg-gradient-to-br from-[color-mix(in_srgb,var(--mint)_90%,white)] to-[var(--surface)] p-4">
          <b className="block text-[13px]">Create a new money entry</b>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Add an expense or income with the right category, payment account, date, and note so
            your analytics, budgets, and goals stay accurate.
          </p>
        </div>
      ) : null}
      <div className="grid gap-3.5 lg:grid-cols-[1.3fr_.7fr]">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--muted)] p-1">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={type === "EXPENSE" ? "Merchant" : "Source"}>
              <Input
                maxLength={120}
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
                placeholder="e.g. Fresh Basket, Salary, Uber"
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
            <Field label="Account">
              <Select required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {accounts
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Date and time">
              <Input
                type="datetime-local"
                required
                value={transactionAt}
                onChange={(event) => setTransactionAt(event.target.value)}
              />
            </Field>
            <Field label="Tags (comma separated)">
              <Input value={tags} onChange={(event) => setTags(event.target.value)} />
            </Field>
            <Field label="Notes">
              <Textarea
                maxLength={500}
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional note, receipt details, bill info, or reminder"
              />
            </Field>
          </div>
        </div>
        <aside className="rounded-[18px] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[var(--muted)] p-3.5">
          <h3 className="mb-2.5 text-xs font-semibold">Quick picks</h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickPick onClick={() => pick("EXPENSE", "food", "Fresh Basket")}>
              Food<small>Groceries & dining</small>
            </QuickPick>
            <QuickPick onClick={() => pick("EXPENSE", "transport", "Metro recharge")}>
              Transport<small>Travel & fuel</small>
            </QuickPick>
            <QuickPick onClick={() => pick("EXPENSE", "shop", "Urban Style")}>
              Shopping<small>Fashion & retail</small>
            </QuickPick>
            <QuickPick onClick={() => pick("INCOME", "salary", "Monthly salary")}>
              Income<small>Salary & credits</small>
            </QuickPick>
          </div>
          <div className="mt-3 grid gap-2">
            <div className="rounded-xl border border-dashed bg-[var(--surface)] p-2.5">
              <b className="block text-[10px]">Tip</b>
              <small className="mt-1 block text-[9px] leading-snug text-[var(--muted-foreground)]">
                Use clear merchant names to get better insights and cleaner reports.
              </small>
            </div>
            <div className="rounded-xl border border-dashed bg-[var(--surface)] p-2.5">
              <b className="block text-[10px]">Premium workflow</b>
              <small className="mt-1 block text-[9px] leading-snug text-[var(--muted-foreground)]">
                You can also scan a receipt from the dashboard and prefill this form automatically.
              </small>
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
        <Button disabled={saving || !accountId || !categoryId}>
          {saving ? "Saving…" : initial ? "Save changes" : `Add ${type.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}

function QuickPick({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-[var(--surface)] p-2.5 text-left text-[11px] font-extrabold hover:border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] hover:text-[var(--primary)] [&_small]:mt-1 [&_small]:block [&_small]:text-[9px] [&_small]:font-bold [&_small]:text-[var(--muted-foreground)]"
    >
      {children}
    </button>
  );
}
