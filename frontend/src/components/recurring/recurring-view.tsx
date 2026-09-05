"use client";

import type { Account, Category, RecurringFrequency, TransactionType } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Home,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Shield,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import "../../app/recurring38.css";

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

const POPULAR_CATEGORIES = [
  { label: "Rent / Home", hint: "Housing & rent", icon: Home, tone: "green", match: /rent|home|hous/i },
  { label: "Utilities", hint: "Electricity, water, gas", icon: Zap, tone: "gold", match: /util|electric|water|gas|bill/i },
  { label: "Subscriptions", hint: "OTT, apps, software", icon: Play, tone: "purple", match: /subscr|ott|netflix|spotify|stream/i },
  { label: "Insurance", hint: "Health, life, vehicle", icon: Shield, tone: "blue", match: /insur/i },
  { label: "Loans & EMIs", hint: "EMI and loan payments", icon: CreditCard, tone: "orange", match: /loan|emi|credit/i },
  { label: "Investments", hint: "SIPs and deposits", icon: BarChart3, tone: "teal", match: /invest|sip|mutual/i },
] as const;

const WHY_ITEMS = [
  { title: "Save time", text: "Set it once, we'll remind you", icon: Clock3, tone: "green" },
  { title: "Stay organised", text: "All your bills in one place", icon: Settings2, tone: "orange" },
  { title: "Avoid late fees", text: "Get timely reminders", icon: Shield, tone: "blue" },
  { title: "Better insights", text: "Track recurring spends easily", icon: BarChart3, tone: "purple" },
] as const;

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
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

function RecurringThemeButton() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && theme === "dark";
  return (
    <button
      type="button"
      className="r38-btn icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

function RecurringNotifyButton({ notices }: { notices: Array<{ title: string; body: string }> }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="r38-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="r38-btn icon r38-notify"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
        {notices.length ? <span className="r38-notify-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="r38-notify-panel" role="dialog" aria-label="Recurring notifications">
          <header>
            <div>
              <h2>Notifications</h2>
              <p>{notices.length ? `${notices.length} alert${notices.length === 1 ? "" : "s"}` : "You're all caught up"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              Mark read
            </button>
          </header>
          {notices.length ? (
            <ul>
              {notices.map((item) => (
                <li key={`${item.title}-${item.body}`}>
                  <span />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="r38-notify-empty">No bill reminders yet. Upcoming schedules will show here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function RecurringView() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [deleting, setDeleting] = useState<Recurring | null>(null);
  const [search, setSearch] = useState("");
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
      toast.success(variables.operation === "delete" ? "Reminder deleted" : "Reminder updated");
      if (variables.operation === "delete") setDeleting(null);
      void client.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  const list = rows.data ?? [];
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return list;
    return list.filter((item) => {
      const haystack = `${item.merchant ?? ""} ${item.frequency} ${item.type} ${item.notes ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [list, query]);

  const activeCount = useMemo(() => list.filter((item) => item.isActive).length, [list]);
  const monthlyAmount = useMemo(
    () => list.filter((item) => item.isActive).reduce((sum, item) => sum + monthlyEquivalent(item), 0),
    [list],
  );
  const upcomingThisMonth = useMemo(
    () => list.filter((item) => item.isActive && isSameMonth(item.nextRunAt)),
    [list],
  );
  const completedThisMonth = useMemo(
    () => list.filter((item) => isSameMonth(item.lastRunAt)).length,
    [list],
  );
  const notices = useMemo(
    () =>
      upcomingThisMonth.slice(0, 4).map((item) => ({
        title: `${scheduleTitle(item)} due soon`,
        body: `Next run ${dateTime(item.nextRunAt)} · ${money(item.amountMinor, item.currency)}`,
      })),
    [upcomingThisMonth],
  );

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
    <div className="recurring38">
      <section className="r38-head">
        <div className="r38-head-left">
          <div className="r38-page-icon" aria-hidden="true">
            <CalendarCheck2 size={24} />
          </div>
          <div>
            <h1>Bills & Reminders</h1>
            <p>Track due dates and automate predictable payments without duplicate entries.</p>
          </div>
        </div>
        <div className="r38-head-actions">
          <label className="r38-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search bills and reminders"
              placeholder="Search bills, reminders..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="r38-btn" aria-label="Current month">
            <CalendarDays size={15} aria-hidden="true" />
            {monthLabel()}
          </button>
          <RecurringNotifyButton notices={notices} />
          <RecurringThemeButton />
          <button type="button" className="r38-btn primary" onClick={() => openCreate()}>
            <Plus size={15} aria-hidden="true" />
            New Reminder
          </button>
        </div>
      </section>

      <section className="r38-kpis" aria-label="Bills and reminders summary">
        <article className="r38-kpi green">
          <div className="r38-kpi-top">
            <span className="label">Total Bills</span>
            <span className="r38-kpi-icon">
              <CalendarDays size={18} />
            </span>
          </div>
          <strong>{activeCount}</strong>
          <small>Active bill{activeCount === 1 ? "" : "s"}</small>
        </article>
        <article className="r38-kpi blue">
          <div className="r38-kpi-top">
            <span className="label">Monthly Amount</span>
            <span className="r38-kpi-icon">
              <Clock3 size={18} />
            </span>
          </div>
          <strong>{money(monthlyAmount, currency)}</strong>
          <small>Across all bills</small>
        </article>
        <article className="r38-kpi gold">
          <div className="r38-kpi-top">
            <span className="label">Upcoming This Month</span>
            <span className="r38-kpi-icon">
              <BarChart3 size={18} />
            </span>
          </div>
          <strong>{upcomingThisMonth.length}</strong>
          <small>Payment{upcomingThisMonth.length === 1 ? "" : "s"} due</small>
        </article>
        <article className="r38-kpi purple">
          <div className="r38-kpi-top">
            <span className="label">Completed Payments</span>
            <span className="r38-kpi-icon">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <strong>{completedThisMonth}</strong>
          <small>This month</small>
        </article>
      </section>

      <section className="r38-board">
        <div className="r38-board-main">
          <section className="r38-hero">
            <div className="r38-hero-copy">
              <h2>
                Never miss a payment. <span>Set it once, stay stress-free.</span>
              </h2>
              <p>Automate rent, subscriptions, salary and other predictable cashflow with reminders that keep you ahead.</p>
              <div className="r38-hero-actions">
                <button type="button" className="r38-btn primary" onClick={() => openCreate()}>
                  <Plus size={15} aria-hidden="true" />
                  New Reminder
                </button>
                <button
                  type="button"
                  className="r38-btn ghost"
                  onClick={() =>
                    toast.info("Add a bill once — Hisaab reminds you before due dates so nothing slips.")
                  }
                >
                  <Play size={14} aria-hidden="true" />
                  Watch how it works
                </button>
              </div>
            </div>
            <div className="r38-hero-visual" aria-hidden="true">
              <div className="r38-hero-glow" />
              <img src="/images/recurring-hero-bills.png" alt="" />
            </div>
          </section>

          {filtered.length ? (
            <div className="r38-lines">
              {filtered.map((item) => (
                <Card key={item.id} className="r38-line">
                  <header>
                    <span className="r38-line-icon" aria-hidden="true">
                      <CalendarClock size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3>{scheduleTitle(item)}</h3>
                      <small>
                        {item.frequency.toLowerCase()} · {item.type.toLowerCase()}
                        {item.isActive ? "" : " · paused"}
                      </small>
                    </div>
                    <span className={`r38-pill ${item.isActive ? "is-active" : "is-paused"}`}>
                      {item.isActive ? "Active" : "Paused"}
                    </span>
                  </header>
                  <div className="r38-line-stats">
                    <div>
                      <small>Amount</small>
                      <b className={item.type === "INCOME" ? "is-income" : undefined}>
                        {money(item.amountMinor, item.currency)}
                      </b>
                    </div>
                    <div>
                      <small>Next run</small>
                      <b>{dateTime(item.nextRunAt)}</b>
                    </div>
                    <div>
                      <small>Last run</small>
                      <b>{item.lastRunAt ? dateTime(item.lastRunAt) : "—"}</b>
                    </div>
                  </div>
                  <div className="r38-line-actions">
                    <button
                      type="button"
                      className="r38-btn"
                      onClick={() =>
                        action.mutate({ id: item.id, operation: item.isActive ? "pause" : "resume" })
                      }
                    >
                      {item.isActive ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                      {item.isActive ? "Pause" : "Resume"}
                    </button>
                    <button type="button" className="r38-btn" onClick={() => setEditing(item)} aria-label="Edit schedule">
                      <Pencil size={14} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="r38-btn danger"
                      onClick={() => setDeleting(item)}
                      aria-label="Delete schedule"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="r38-empty">
              <div className="r38-empty-icon" aria-hidden="true">
                <CalendarDays size={28} />
                <Plus size={14} className="r38-empty-plus" />
              </div>
              <h2>No bills or reminders yet</h2>
              <p>Track rent, subscriptions, salary, and other predictable due dates.</p>
              <button type="button" className="r38-btn primary" onClick={() => openCreate()}>
                <Plus size={15} aria-hidden="true" />
                Add your first bill
              </button>
            </Card>
          )}

          <section className="r38-why" aria-label="Why use bills and reminders">
            <h2>Why use Bills & Reminders?</h2>
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
        </div>

        <aside className="r38-board-side">
          <Card className="r38-panel">
            <header>
              <div>
                <h2>Popular Categories</h2>
                <small>Quick-add common bills</small>
              </div>
              <button type="button" className="r38-text-link" onClick={() => openCreate()}>
                View all
              </button>
            </header>
            <ul className="r38-cats">
              {POPULAR_CATEGORIES.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <span className={`r38-cat-icon is-${item.tone}`}>
                      <Icon size={15} />
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </div>
                    <button
                      type="button"
                      className="r38-plus"
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

          <Card className="r38-panel">
            <header>
              <div>
                <h2>Upcoming Reminders</h2>
                <small>{monthLabel()}</small>
              </div>
            </header>
            {upcomingThisMonth.length ? (
              <ul className="r38-upcoming">
                {upcomingThisMonth.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <span>
                      <CalendarDays size={14} />
                    </span>
                    <div>
                      <strong>{scheduleTitle(item)}</strong>
                      <small>
                        {dateTime(item.nextRunAt)} · {money(item.amountMinor, item.currency)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="r38-upcoming-empty">
                <span aria-hidden="true">
                  <CalendarDays size={18} />
                </span>
                <p>No upcoming payments. Your scheduled payments for this month will appear here.</p>
              </div>
            )}
          </Card>

          <Card className="r38-panel r38-quick">
            <header>
              <div>
                <h2>Quick Actions</h2>
                <small>Common next steps</small>
              </div>
            </header>
            <button type="button" className="r38-action" onClick={() => openCreate()}>
              <span className="r38-action-icon">
                <CalendarCheck2 size={16} />
              </span>
              <div>
                <strong>Add bill</strong>
                <small>Create a new reminder</small>
              </div>
            </button>
            <button
              type="button"
              className="r38-action"
              onClick={() => toast.info("Import from bank is coming soon. Add bills manually for now.")}
            >
              <span className="r38-action-icon is-alt">
                <ArrowLeftRight size={16} />
              </span>
              <div>
                <strong>Import from bank</strong>
                <small>Auto-detect recurring transactions</small>
              </div>
            </button>
          </Card>
        </aside>
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
        <RecurringForm
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
            toast.success("Reminder created");
            void client.invalidateQueries({ queryKey: ["recurring"] });
          }}
        />
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit recurring transaction">
        {editing ? (
          <RecurringForm
            key={editing.id}
            currency={currency}
            accounts={accounts.data}
            categories={categories.data}
            initial={editing}
            onSaved={() => {
              setEditing(null);
              toast.success("Reminder updated");
              void client.invalidateQueries({ queryKey: ["recurring"] });
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this bill reminder?"
        description="Future reminders will stop. Transactions already created will remain in your history."
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
        {mutation.isPending ? "Saving…" : initial ? "Save reminder" : "Create reminder"}
      </Button>
    </form>
  );
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
