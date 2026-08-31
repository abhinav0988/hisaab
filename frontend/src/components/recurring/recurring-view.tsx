"use client";
import type { Account, Category, RecurringFrequency, TransactionType } from "@hisaab/types";
import { Badge, Button, Card, Field, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { dateTime, money } from "@/lib/format";
import { uniqueCatalogAccounts, accountDisplayName, isPaymentMethodType, paymentMethodAccounts } from "@/lib/accounts";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { profileService } from "@/services/profile.service";
import { recurringService } from "@/services/recurring.service";
type Recurring = {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  merchant: string | null;
  notes: string | null;
  frequency: RecurringFrequency;
  startAt: string;
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
};
export function RecurringView() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [deleting, setDeleting] = useState<Recurring | null>(null);
  const rows = useQuery({
    queryKey: ["recurring"],
    queryFn: () => recurringService.list<Recurring>(),
  });
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list(),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.get(),
  });
  const action = useMutation({
    mutationFn: ({ id, operation }: { id: string; operation: "pause" | "resume" | "delete" }) =>
      operation === "delete"
        ? recurringService.remove(id)
        : operation === "pause"
          ? recurringService.pause(id)
          : recurringService.resume(id),
    onSuccess: (_, variables) => {
      toast.success(variables.operation === "delete" ? "Schedule deleted" : "Schedule updated");
      if (variables.operation === "delete") setDeleting(null);
      void client.invalidateQueries({ queryKey: ["recurring"] });
    },
  });
  if (rows.isLoading || accounts.isLoading || categories.isLoading || profile.isLoading)
    return <PageSkeleton />;
  if (!rows.data || !accounts.data || !categories.data || !profile.data)
    return <ErrorState retry={() => void rows.refetch()} />;
  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Recurring"
        description="Automate predictable income and expenses without duplicate entries."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} />
            New schedule
          </Button>
        }
      />
      <div className="mt-7">
        {rows.data.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.data.map((item) => (
              <Card key={item.id} className="interactive-card p-5">
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-[var(--mint)] text-[var(--primary)]">
                    <CalendarClock size={21} />
                  </span>
                  <Badge tone={item.isActive ? "success" : "neutral"}>
                    {item.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>
                <p className="mt-5 font-semibold">
                  {item.merchant || `${item.frequency.toLowerCase()} ${item.type.toLowerCase()}`}
                </p>
                <p
                  className={`mt-2 text-2xl font-bold ${item.type === "INCOME" ? "text-[var(--success)]" : ""}`}
                >
                  {money(item.amountMinor, item.currency)}
                </p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Runs {item.frequency.toLowerCase()} · Next {dateTime(item.nextRunAt)}
                </p>
                <div className="mt-5 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() =>
                      action.mutate({ id: item.id, operation: item.isActive ? "pause" : "resume" })
                    }
                  >
                    {item.isActive ? <Pause size={16} /> : <Play size={16} />}{" "}
                    {item.isActive ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3"
                    onClick={() => setEditing(item)}
                    aria-label={`Edit ${item.merchant || "schedule"}`}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3 hover:text-[var(--danger)]"
                    onClick={() => setDeleting(item)}
                    aria-label={`Delete ${item.merchant || "schedule"}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No recurring schedules"
            description="Automate rent, subscriptions, salary, and other predictable activity."
            action={<Button onClick={() => setOpen(true)}>Create schedule</Button>}
          />
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New recurring transaction">
        <RecurringForm
          currency={profile.data.defaultCurrency}
          accounts={accounts.data}
          categories={categories.data}
          onSaved={() => {
            setOpen(false);
            toast.success("Schedule created");
            void client.invalidateQueries({ queryKey: ["recurring"] });
          }}
        />
      </Modal>
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit recurring transaction"
      >
        {editing ? (
          <RecurringForm
            key={editing.id}
            currency={profile.data.defaultCurrency}
            accounts={accounts.data}
            categories={categories.data}
            initial={editing}
            onSaved={() => {
              setEditing(null);
              toast.success("Schedule updated");
              void client.invalidateQueries({ queryKey: ["recurring"] });
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete recurring schedule?"
        description="Future automatic entries will stop. Transactions already created by this schedule will remain in your history."
        busy={action.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && action.mutate({ id: deleting.id, operation: "delete" })}
      />
    </div>
  );
}
function RecurringForm({
  currency,
  accounts,
  categories,
  initial,
  onSaved,
}: {
  currency: string;
  accounts: Account[];
  categories: Category[];
  initial?: Recurring;
  onSaved: () => void;
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : "");
  const accountOptions = uniqueCatalogAccounts(accounts, initial?.accountId);
  const [accountId, setAccount] = useState(
    initial?.accountId ?? accountOptions[0]?.id ?? "",
  );
  const [categoryId, setCategory] = useState(
    initial?.categoryId ?? categories.find((item) => item.type === "EXPENSE")?.id ?? "",
  );
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? "MONTHLY");
  const [startAt, setStart] = useState(
    initial ? localDateTimeValue(initial.nextRunAt) : localDateTimeValue(new Date().toISOString()),
  );
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        type,
        amountMinor: Math.round(Number(amount) * 100),
        currency,
        accountId,
        categoryId,
        frequency,
        startAt: new Date(startAt).toISOString(),
        merchant: merchant || null,
        notes: null,
      };
      return initial ? recurringService.update(initial.id, body) : recurringService.create(body);
    },
    onSuccess: onSaved,
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <Select
            value={type}
            onChange={(event) => {
              const value = event.target.value as TransactionType;
              setType(value);
              setCategory(categories.find((item) => item.type === value)?.id ?? "");
            }}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </Select>
        </Field>
        <Field label="Frequency">
          <Select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as RecurringFrequency)}
          >
            {["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Amount (${currency})`}>
          <Input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="First occurrence">
          <Input
            required
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account">
          <Select
            required
            aria-label="Account"
            value={accountId}
            onChange={(event) => setAccount(event.target.value)}
          >
            {!accountId ? (
              <option value="" disabled>
                Select an account
              </option>
            ) : null}
            {accountOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {accountDisplayName(item)}
              </option>
            ))}
          </Select>
        </Field>
        {paymentMethodAccounts(accountOptions).length ? (
          <Field label="Payment method" hint="Quick select for UPI or credit card.">
            <Select
              aria-label="Payment method"
              value={
                isPaymentMethodType(accountOptions.find((item) => item.id === accountId)?.type ?? "")
                  ? accountOptions.find((item) => item.id === accountId)?.type
                  : ""
              }
              onChange={(event) => {
                const match = accountOptions.find((item) => item.type === event.target.value);
                if (match) setAccount(match.id);
              }}
            >
              <option value="">Select UPI or credit card</option>
              {paymentMethodAccounts(accountOptions).map((item) => (
                <option key={item.id} value={item.type}>
                  {accountDisplayName(item)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Category">
          <Select value={categoryId} onChange={(event) => setCategory(event.target.value)}>
            {categories
              .filter((item) => item.type === type)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <Field label={type === "EXPENSE" ? "Merchant" : "Source"}>
        <Input value={merchant} onChange={(event) => setMerchant(event.target.value)} />
      </Field>
      {mutation.error ? (
        <p className="text-sm text-[var(--danger)]">{mutation.error.message}</p>
      ) : null}
      <Button disabled={mutation.isPending || !accountId || !categoryId}>
        {mutation.isPending ? "Saving…" : initial ? "Save schedule" : "Create schedule"}
      </Button>
    </form>
  );
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
