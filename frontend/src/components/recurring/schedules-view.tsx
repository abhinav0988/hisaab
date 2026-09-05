"use client";

import type { Account, Category, RecurringFrequency, TransactionType } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Clock3,
  Filter,
  Home,
  IndianRupee,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  Tv,
  Umbrella,
  Wallet,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { accountDisplayName, isPaymentMethodType, paymentMethodAccounts, uniqueCatalogAccounts } from "@/lib/accounts";
import { ApiError } from "@/lib/api-client";
import { dateTime, money } from "@/lib/format";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { profileService } from "@/services/profile.service";
import { recurringService } from "@/services/recurring.service";
import "../../app/schedules38.css";

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

type Tab = "all" | "expenses" | "income" | "active" | "paused" | "completed";
type Sort = "latest" | "amount" | "next";

const POPULAR_CATEGORIES = [
  { label: "Rent / Home", hint: "Housing payments", icon: Home, tone: "green", match: /rent|home|hous/i },
  { label: "Utilities", hint: "Power, water, gas", icon: Zap, tone: "blue", match: /util|electric|water|gas|bill/i },
  { label: "Subscriptions", hint: "OTT and apps", icon: Tv, tone: "purple", match: /subscr|ott|netflix|spotify|stream/i },
  { label: "Loans & EMIs", hint: "Loan repayments", icon: Wallet, tone: "orange", match: /loan|emi|credit/i },
  { label: "Insurance", hint: "Premiums due", icon: Umbrella, tone: "gold", match: /insur/i },
] as const;

const WHY_ITEMS = [
  { title: "Save time", text: "Set it once, automate the rest", icon: Clock3, tone: "green" },
  { title: "Get timely reminders", text: "Never miss a due date", icon: Bell, tone: "gold" },
  { title: "Better financial control", text: "See recurring cashflow clearly", icon: Shield, tone: "blue" },
  { title: "Stay organised", text: "All schedules in one workspace", icon: Settings2, tone: "purple" },
] as const;

const HERO_TAGS = [
  { label: "Rent", tone: "green" },
  { label: "Subscriptions", tone: "purple" },
  { label: "Utilities", tone: "blue" },
  { label: "Loans", tone: "orange" },
] as const;

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function isSameMonth(value: string | null | undefined, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function monthlyEquivalent(item: Recurring) {
  switch (item.frequency) {
    case "DAILY":
      return item.amountMinor * 30;
    case "WEEKLY":
      return item.amountMinor * 4;
    case "YEARLY":
      return Math.round(item.amountMinor / 12);
    default:
      return item.amountMinor;
  }
}

function scheduleTitle(item: Recurring) {
  return item.merchant || `${item.frequency.toLowerCase()} ${item.type.toLowerCase()}`;
}

function isCompleted(item: Recurring) {
  return Boolean(item.lastRunAt) && !item.isActive;
}

export function SchedulesView() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [deleting, setDeleting] = useState<Recurring | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("latest");
  const [draftMerchant, setDraftMerchant] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState<string | undefined>(undefined);

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
    onError: (error) => toast.error(failMessage(error)),
  });

  const list = rows.data ?? [];
  const activeCount = useMemo(() => list.filter((item) => item.isActive).length, [list]);
  const monthlyAmount = useMemo(
    () => list.filter((item) => item.isActive).reduce((sum, item) => sum + monthlyEquivalent(item), 0),
    [list],
  );
  const upcomingThisMonth = useMemo(
    () => list.filter((item) => item.isActive && isSameMonth(item.nextRunAt)).length,
    [list],
  );
  const completedThisMonth = useMemo(
    () => list.filter((item) => isSameMonth(item.lastRunAt)).length,
    [list],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let next = list.filter((item) => {
      if (tab === "expenses") return item.type === "EXPENSE";
      if (tab === "income") return item.type === "INCOME";
      if (tab === "active") return item.isActive;
      if (tab === "paused") return !item.isActive && !item.lastRunAt;
      if (tab === "completed") return isCompleted(item) || (!item.isActive && Boolean(item.lastRunAt));
      return true;
    });
    if (query) {
      next = next.filter((item) => {
        const haystack = `${item.merchant ?? ""} ${item.frequency} ${item.type} ${item.notes ?? ""}`.toLowerCase();
        return haystack.includes(query);
      });
    }
    next = next.slice().sort((a, b) => {
      if (sort === "amount") return b.amountMinor - a.amountMinor;
      if (sort === "next") return a.nextRunAt.localeCompare(b.nextRunAt);
      return b.startAt.localeCompare(a.startAt);
    });
    return next;
  }, [list, search, tab, sort]);

  if (rows.isLoading || accounts.isLoading || categories.isLoading || profile.isLoading) return <PageSkeleton />;
  if (rows.isError || !accounts.data || !categories.data || !profile.data) {
    return <ErrorState retry={() => void rows.refetch()} />;
  }

  const currency = profile.data.defaultCurrency ?? "INR";

  function openCreate(opts?: { merchant?: string; categoryId?: string }) {
    setDraftMerchant(opts?.merchant ?? "");
    setDraftCategoryId(opts?.categoryId);
    setOpen(true);
  }

  function resolveCategoryId(match: RegExp) {
    return categories.data?.find((item) => item.type === "EXPENSE" && match.test(item.name))?.id;
  }

  return (
    <div className="schedules38">
      <section className="s38-head">
        <div className="s38-head-left">
          <div className="s38-page-icon" aria-hidden="true">
            <CalendarCheck2 size={22} />
          </div>
          <div>
            <small className="s38-eyebrow">Workspace / Recurring</small>
            <h1>Recurring</h1>
            <p>Automate predictable income and expenses without duplicate entries.</p>
          </div>
        </div>
        <button type="button" className="s38-btn primary" onClick={() => openCreate()}>
          <Plus size={15} aria-hidden="true" />
          New schedule
        </button>
      </section>

      <section className="s38-kpis" aria-label="Recurring summary">
        <article className="s38-kpi green">
          <div className="s38-kpi-top">
            <span className="label">Total schedules</span>
            <span className="s38-kpi-icon">
              <CalendarClock size={18} />
            </span>
          </div>
          <strong>{activeCount}</strong>
          <small>Active recurring items</small>
        </article>
        <article className="s38-kpi blue">
          <div className="s38-kpi-top">
            <span className="label">Monthly amount</span>
            <span className="s38-kpi-icon">
              <IndianRupee size={18} />
            </span>
          </div>
          <strong>{money(monthlyAmount, currency)}</strong>
          <small>Across all schedules</small>
        </article>
        <article className="s38-kpi gold">
          <div className="s38-kpi-top">
            <span className="label">Upcoming this month</span>
            <span className="s38-kpi-icon">
              <Bell size={18} />
            </span>
          </div>
          <strong>{upcomingThisMonth}</strong>
          <small>Payments due</small>
        </article>
        <article className="s38-kpi purple">
          <div className="s38-kpi-top">
            <span className="label">Completed payments</span>
            <span className="s38-kpi-icon">
              <Sparkles size={18} />
            </span>
          </div>
          <strong>{completedThisMonth}</strong>
          <small>This month</small>
        </article>
      </section>

      <section className="s38-mid">
        <section className="s38-hero">
          <div className="s38-hero-copy">
            <h2>
              Set it once, <span>stay worry-free.</span>
            </h2>
            <p>Automate rent, subscriptions, salary and other predictable cashflow without duplicate entries.</p>
            <div className="s38-hero-actions">
              <button type="button" className="s38-btn primary" onClick={() => openCreate()}>
                <Plus size={15} aria-hidden="true" />
                Create schedule
              </button>
              <button
                type="button"
                className="s38-btn ghost"
                onClick={() =>
                  toast.info("Create a schedule once — Hisaab posts it on time and reminds you before due dates.")
                }
              >
                <Play size={14} aria-hidden="true" />
                How it works
              </button>
            </div>
          </div>
          <div className="s38-hero-visual" aria-hidden="true">
            <div className="s38-hero-glow" />
            <div className="s38-cal">
              <span className="s38-cal-bar" />
              <strong>31</strong>
              <small>Due</small>
            </div>
            <i className="s38-coin">₹</i>
            {HERO_TAGS.map((tag) => (
              <span key={tag.label} className={`s38-tag is-${tag.tone}`}>
                {tag.label}
              </span>
            ))}
          </div>
        </section>

        <Card className="s38-panel">
          <header>
            <div>
              <h2>Popular Recurring Categories</h2>
              <small>Quick-start common schedules</small>
            </div>
          </header>
          <ul className="s38-cats">
            {POPULAR_CATEGORIES.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <span className={`s38-cat-icon is-${item.tone}`}>
                    <Icon size={15} />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </div>
                  <button
                    type="button"
                    className="s38-plus"
                    aria-label={`Add ${item.label}`}
                    onClick={() =>
                      openCreate({
                        merchant: item.label,
                        categoryId: resolveCategoryId(item.match),
                      })
                    }
                  >
                    <Plus size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <Card className="s38-list">
        <div className="s38-list-toolbar">
          <div className="s38-tabs" role="tablist" aria-label="Schedule filters">
            {(
              [
                ["all", "All"],
                ["expenses", "Expenses"],
                ["income", "Income"],
                ["active", "Active"],
                ["paused", "Paused"],
                ["completed", "Completed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : undefined}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="s38-list-controls">
            <label className="s38-search">
              <Search size={15} aria-hidden="true" />
              <input
                aria-label="Search schedules"
                placeholder="Search schedules..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="s38-btn"
              onClick={() => toast.info("Use the tabs to filter by type or status.")}
            >
              <Filter size={14} aria-hidden="true" />
              Filter
            </button>
            <label className="s38-sort">
              <ArrowUpDown size={14} aria-hidden="true" />
              <select
                aria-label="Sort schedules"
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
              >
                <option value="latest">Latest first</option>
                <option value="amount">Highest amount</option>
                <option value="next">Next due</option>
              </select>
            </label>
          </div>
        </div>

        {filtered.length ? (
          <ul className="s38-rows">
            {filtered.map((item) => (
              <li key={item.id}>
                <div className="s38-row">
                  <span className="s38-row-icon" aria-hidden="true">
                    <CalendarClock size={18} />
                  </span>
                  <div className="min-w-0">
                    <strong>{scheduleTitle(item)}</strong>
                    <small>
                      {item.frequency.toLowerCase()} · {item.type.toLowerCase()}
                      {item.isActive ? "" : " · paused"}
                    </small>
                  </div>
                  <div className="s38-row-meta">
                    <b className={item.type === "INCOME" ? "is-income" : undefined}>
                      {money(item.amountMinor, item.currency)}
                    </b>
                    <small>Next {dateTime(item.nextRunAt)}</small>
                  </div>
                  <div className="s38-row-actions">
                    <button
                      type="button"
                      className="s38-btn"
                      onClick={() =>
                        action.mutate({ id: item.id, operation: item.isActive ? "pause" : "resume" })
                      }
                    >
                      {item.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button type="button" className="s38-btn" onClick={() => setEditing(item)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="s38-btn danger" onClick={() => setDeleting(item)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="s38-empty">
            <div className="s38-empty-icon" aria-hidden="true">
              <CalendarDays size={28} />
              <Plus size={14} className="s38-empty-plus" />
            </div>
            <h2>No recurring schedules yet</h2>
            <p>Automate rent, subscriptions, salary, and other predictable activity.</p>
            <button type="button" className="s38-btn primary" onClick={() => openCreate()}>
              <Plus size={15} aria-hidden="true" />
              Create schedule
            </button>
          </div>
        )}
      </Card>

      <section className="s38-why" aria-label="Why use recurring schedules">
        <ul>
          {WHY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className={`is-${item.tone}`}>
                <span>
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDraftMerchant("");
          setDraftCategoryId(undefined);
        }}
        title="New recurring transaction"
      >
        <ScheduleForm
          key={`new-${draftMerchant}-${draftCategoryId ?? "none"}`}
          currency={currency}
          accounts={accounts.data}
          categories={categories.data}
          draftMerchant={draftMerchant}
          draftCategoryId={draftCategoryId}
          onSaved={() => {
            setOpen(false);
            setDraftMerchant("");
            setDraftCategoryId(undefined);
            toast.success("Schedule created");
            void client.invalidateQueries({ queryKey: ["recurring"] });
          }}
        />
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit recurring transaction">
        {editing ? (
          <ScheduleForm
            key={editing.id}
            currency={currency}
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

function ScheduleForm({
  currency,
  accounts,
  categories,
  initial,
  draftMerchant = "",
  draftCategoryId,
  onSaved,
}: {
  currency: string;
  accounts: Account[];
  categories: Category[];
  initial?: Recurring;
  draftMerchant?: string;
  draftCategoryId?: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : "");
  const accountOptions = uniqueCatalogAccounts(accounts, initial?.accountId);
  const [accountId, setAccount] = useState(initial?.accountId ?? accountOptions[0]?.id ?? "");
  const [categoryId, setCategory] = useState(
    initial?.categoryId ??
      draftCategoryId ??
      categories.find((item) => item.type === "EXPENSE")?.id ??
      "",
  );
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? "MONTHLY");
  const [startAt, setStart] = useState(
    initial ? localDateTimeValue(initial.nextRunAt) : localDateTimeValue(new Date().toISOString()),
  );
  const [merchant, setMerchant] = useState(initial?.merchant ?? draftMerchant);

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
    onError: (error) => toast.error(failMessage(error)),
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
