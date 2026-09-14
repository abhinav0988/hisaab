"use client";

import type { LendKind, LendRecord } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  Filter,
  Handshake,
  Moon,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import {
  displayDate,
  isoPlusDays,
  isoToday,
  openLends,
  sumMinor,
} from "@/lib/finance-modules";
import { money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";
import "../../app/lend38.css";

type Tab = "all" | "lent" | "borrowed" | "settled";

const WHY_ITEMS = [
  { title: "Stay organised", text: "Track all lend and borrow records", icon: ShieldCheck, tone: "green" },
  { title: "Never miss a due date", text: "Get timely reminders", icon: CalendarCheck2, tone: "gold" },
  { title: "Better financial control", text: "Understand your cash flow", icon: BarChart3, tone: "blue" },
  { title: "Manage people easily", text: "Keep friends and family in one place", icon: Users, tone: "purple" },
] as const;

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function isOverdue(item: LendRecord, today = isoToday()) {
  if (item.status === "settled") return false;
  if (item.status === "due") return true;
  return item.dueOn < today;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function LendThemeButton() {
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
      className="l38-btn icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

function LendNotifyButton({ notices }: { notices: Array<{ title: string; body: string }> }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
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
    <div className="l38-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="l38-btn icon l38-notify"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
        {notices.length ? <span className="l38-notify-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="l38-notify-panel" role="dialog" aria-label="Borrow and lend notifications">
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
            <p className="l38-notify-empty">No due reminders yet. Overdue and upcoming records will show here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function LendView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const lends = useQuery({
    queryKey: ["lend-records"],
    queryFn: () => financeService.listLendRecords(),
    retry: false,
  });

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [open, setOpen] = useState<"lend" | "borrow" | null>(null);
  const [editing, setEditing] = useState<LendRecord | null>(null);
  const [deleting, setDeleting] = useState<LendRecord | null>(null);

  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createLendRecord(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["lend-records"] });
      setOpen(null);
      toast.success("Record saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => financeService.patchLendRecord(id, body),
    onSuccess: async (_, variables) => {
      await client.invalidateQueries({ queryKey: ["lend-records"] });
      const settled =
        variables.body &&
        typeof variables.body === "object" &&
        "status" in variables.body &&
        (variables.body as { status?: string }).status === "settled";
      setEditing(null);
      toast.success(settled ? "Marked as settled" : "Record updated");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => financeService.deleteLendRecord(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["lend-records"] });
      setDeleting(null);
      setEditing(null);
      toast.success("Record deleted");
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  const list = lends.data ?? [];
  const today = isoToday();

  const globalQuery = search.trim().toLowerCase();
  const scoped = useMemo(() => {
    if (!globalQuery) return list;
    return list.filter((item) => {
      const haystack = `${item.person} ${item.relation ?? ""} ${item.kind} ${item.status}`.toLowerCase();
      return haystack.includes(globalQuery);
    });
  }, [list, globalQuery]);

  const tabRows = useMemo(() => {
    return scoped.filter((item) => {
      if (tab === "all") return true;
      if (tab === "settled") return item.status === "settled";
      if (tab === "lent") return item.kind === "lent" && item.status !== "settled";
      return item.kind === "borrowed" && item.status !== "settled";
    });
  }, [scoped, tab]);

  const listQuery = listSearch.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!listQuery) return tabRows;
    return tabRows.filter((item) => {
      const haystack = `${item.person} ${item.relation ?? ""} ${item.kind} ${item.status}`.toLowerCase();
      return haystack.includes(listQuery);
    });
  }, [tabRows, listQuery]);

  const openList = useMemo(() => openLends(list), [list]);
  const lentMinor = useMemo(
    () => sumMinor(
      openList.filter((item) => item.kind === "lent"),
      (item) => item.amountMinor,
    ),
    [openList],
  );
  const borrowedMinor = useMemo(
    () => sumMinor(
      openList.filter((item) => item.kind === "borrowed"),
      (item) => item.amountMinor,
    ),
    [openList],
  );
  const overdueList = useMemo(() => openList.filter((item) => isOverdue(item, today)), [openList, today]);
  const overdueMinor = useMemo(
    () => sumMinor(overdueList, (item) => item.amountMinor),
    [overdueList],
  );
  const upcoming = useMemo(() => {
    return openList
      .filter((item) => !isOverdue(item, today))
      .slice()
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
      .slice(0, 5);
  }, [openList, today]);

  const notices = useMemo(
    () =>
      overdueList.slice(0, 4).map((item) => ({
        title: `${item.person} · overdue`,
        body: `${money(item.amountMinor, item.currency)} due ${displayDate(item.dueOn)}`,
      })),
    [overdueList],
  );

  if (profile.isLoading || lends.isLoading) return <PageSkeleton />;
  if (lends.isError) return <ErrorState retry={() => void lends.refetch()} />;

  const currency = profile.data?.defaultCurrency ?? "INR";

  function openAdd(kind: "lend" | "borrow" = "lend") {
    setOpen(kind);
  }

  return (
    <div className="lend38">
      <section className="l38-head">
        <div className="l38-head-left">
          <div className="l38-page-icon" aria-hidden="true">
            <Handshake size={24} />
          </div>
          <div>
            <h1>Borrow / Lend</h1>
            <p>Track money you gave or borrowed, due dates and settlements.</p>
          </div>
        </div>
        <div className="l38-head-actions">
          <label className="l38-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search people and contacts"
              placeholder="Search people, contacts..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="l38-btn" aria-label="Current month">
            <CalendarDays size={15} aria-hidden="true" />
            {monthLabel()}
          </button>
          <LendNotifyButton notices={notices} />
          <LendThemeButton />
          <button type="button" className="l38-btn primary" onClick={() => openAdd("lend")}>
            <Plus size={15} aria-hidden="true" />
            Add Record
          </button>
        </div>
      </section>

      <section className="l38-kpis" aria-label="Borrow and lend summary">
        <article className="l38-kpi green">
          <div className="l38-kpi-top">
            <span className="label">Money Lent</span>
            <span className="l38-kpi-icon">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <strong>{money(lentMinor, currency)}</strong>
          <small>Total amount lent</small>
        </article>
        <article className="l38-kpi blue">
          <div className="l38-kpi-top">
            <span className="label">Money Borrowed</span>
            <span className="l38-kpi-icon">
              <ArrowDownLeft size={18} />
            </span>
          </div>
          <strong>{money(borrowedMinor, currency)}</strong>
          <small>Total amount borrowed</small>
        </article>
        <article className="l38-kpi gold">
          <div className="l38-kpi-top">
            <span className="label">Due to Receive</span>
            <span className="l38-kpi-icon">
              <CalendarDays size={18} />
            </span>
          </div>
          <strong>{money(lentMinor, currency)}</strong>
          <small>Expected inflow</small>
        </article>
        <article className="l38-kpi red">
          <div className="l38-kpi-top">
            <span className="label">Overdue Records</span>
            <span className="l38-kpi-icon">
              <AlarmClock size={18} />
            </span>
          </div>
          <strong>{overdueList.length}</strong>
          <small>Needs attention</small>
        </article>
      </section>

      <section className="l38-board">
        <div className="l38-board-main">
          <section className="l38-hero">
            <div className="l38-hero-copy">
              <h2>
                Manage your <span>Borrowed &amp; Lent Money</span>
              </h2>
              <p>Keep track of what you owe and what others owe you. Never miss a due date or settlement.</p>
              <div className="l38-hero-actions">
                <button type="button" className="l38-btn primary" onClick={() => openAdd("lend")}>
                  <Plus size={15} aria-hidden="true" />
                  Add Record
                </button>
                <button
                  type="button"
                  className="l38-btn ghost"
                  onClick={() =>
                    toast.info("Add a lend or borrow record with a due date — Hisaab keeps settlements and reminders in one place.")
                  }
                >
                  <Play size={14} aria-hidden="true" />
                  How it works
                </button>
              </div>
            </div>
            <div className="l38-hero-visual" aria-hidden="true">
              <div className="l38-hero-glow" />
              <img src="/images/lend-hero-wallet.png" alt="" />
            </div>
          </section>

          <Card className="l38-list">
            <div className="l38-list-toolbar">
              <div className="l38-tabs" role="tablist" aria-label="Record filters">
                {([
                  ["all", "All"],
                  ["lent", "Lent"],
                  ["borrowed", "Borrowed"],
                  ["settled", "Settled"],
                ] as const).map(([value, label]) => (
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
              <div className="l38-list-controls">
                <label className="l38-search is-compact">
                  <Search size={15} aria-hidden="true" />
                  <input
                    aria-label="Search records"
                    placeholder="Search records..."
                    value={listSearch}
                    onChange={(event) => setListSearch(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="l38-btn"
                  onClick={() => toast.info("Use the tabs above to filter by Lent, Borrowed, or Settled.")}
                >
                  <Filter size={14} aria-hidden="true" />
                  Filter
                </button>
              </div>
            </div>

            {rows.length ? (
              <ul className="l38-rows">
                {rows.map((item) => {
                  const overdue = isOverdue(item, today);
                  return (
                    <li key={item.id}>
                      <button type="button" className="l38-row" onClick={() => setEditing(item)}>
                        <span className={`l38-avatar is-${item.kind}`}>{initials(item.person)}</span>
                        <div className="min-w-0">
                          <strong>{item.person}</strong>
                          <small>
                            {item.relation || "Contact"} · {item.kind === "lent" ? "Lent" : "Borrowed"} · Due{" "}
                            {displayDate(item.dueOn)}
                          </small>
                        </div>
                        <div className="l38-row-meta">
                          <b>{money(item.amountMinor, item.currency)}</b>
                          <span
                            className={`l38-status is-${item.status === "settled" ? "settled" : overdue ? "due" : "pending"}`}
                          >
                            {item.status === "settled" ? "settled" : overdue ? "due" : item.status}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="l38-empty">
                <div className="l38-empty-icon" aria-hidden="true">
                  <Handshake size={28} />
                  <Plus size={14} className="l38-empty-plus" />
                </div>
                <h2>No records in this tab</h2>
                <p>Add money you lent or borrowed to keep due dates, settlements and reminders in one place.</p>
                <button type="button" className="l38-btn primary" onClick={() => openAdd("lend")}>
                  <Plus size={15} aria-hidden="true" />
                  Add your first record
                </button>
              </div>
            )}
          </Card>

          <section className="l38-why" aria-label="Why track borrow and lend">
            <h2>Why track borrow / lend?</h2>
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

        <aside className="l38-board-side">
          <Card className="l38-panel">
            <header>
              <div>
                <h2>Quick Actions</h2>
                <small>Common next steps</small>
              </div>
            </header>
            <div className="l38-quick-grid">
              <button type="button" className="l38-quick" onClick={() => openAdd("lend")}>
                <span>
                  <Plus size={16} />
                </span>
                Add Record
              </button>
              <button
                type="button"
                className="l38-quick"
                onClick={() => toast.info("Reminders follow due dates on your records. Add a due date when you create one.")}
              >
                <span>
                  <Bell size={16} />
                </span>
                Set Reminder
              </button>
              <button type="button" className="l38-quick" onClick={() => openAdd("lend")}>
                <span>
                  <UserPlus size={16} />
                </span>
                Add Person
              </button>
              <button
                type="button"
                className="l38-quick"
                onClick={() => toast.info("Upcoming due dates appear in the panel below.")}
              >
                <span>
                  <CalendarDays size={16} />
                </span>
                View Calendar
              </button>
            </div>
          </Card>

          <Card className="l38-panel">
            <header>
              <div>
                <h2>Upcoming Due Dates</h2>
                <small>{monthLabel()}</small>
              </div>
              <button type="button" className="l38-text-link" onClick={() => setTab("all")}>
                View all
              </button>
            </header>
            {upcoming.length ? (
              <ul className="l38-upcoming">
                {upcoming.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setEditing(item)}>
                      <span className={`l38-avatar is-${item.kind}`}>{initials(item.person)}</span>
                      <div>
                        <strong>{item.person}</strong>
                        <small>
                          {displayDate(item.dueOn)} · {money(item.amountMinor, item.currency)}
                        </small>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="l38-upcoming-empty">
                <span aria-hidden="true">
                  <CalendarDays size={18} />
                </span>
                <p>No upcoming dues</p>
                <button type="button" className="l38-btn primary" onClick={() => openAdd("lend")}>
                  <Plus size={14} aria-hidden="true" />
                  Add Record
                </button>
              </div>
            )}
          </Card>

          <Card className="l38-panel">
            <header>
              <div>
                <h2>Summary</h2>
                <small>Open balances</small>
              </div>
              <span className="l38-chip">This month</span>
            </header>
            <ul className="l38-summary">
              <li>
                <span className="is-green">
                  <ArrowUp size={14} />
                </span>
                <div>
                  <strong>Total Lent</strong>
                  <small>Open lend balance</small>
                </div>
                <b>{money(lentMinor, currency)}</b>
              </li>
              <li>
                <span className="is-red">
                  <ArrowDown size={14} />
                </span>
                <div>
                  <strong>Total Borrowed</strong>
                  <small>Open borrow balance</small>
                </div>
                <b>{money(borrowedMinor, currency)}</b>
              </li>
              <li>
                <span className="is-blue">
                  <Clock3 size={14} />
                </span>
                <div>
                  <strong>Due to Receive</strong>
                  <small>Expected inflow</small>
                </div>
                <b>{money(lentMinor, currency)}</b>
              </li>
              <li>
                <span className="is-gold">
                  <AlarmClock size={14} />
                </span>
                <div>
                  <strong>Overdue Amount</strong>
                  <small>Needs attention</small>
                </div>
                <b>{money(overdueMinor, currency)}</b>
              </li>
            </ul>
          </Card>
        </aside>
      </section>

      <Modal
        open={open === "lend" || open === "borrow"}
        onClose={() => setOpen(null)}
        title={open === "borrow" ? "Record borrowed money" : "Record lent money"}
      >
        <LendForm
          kind={open === "borrow" ? "borrowed" : "lent"}
          currency={currency}
          pending={create.isPending}
          onSave={(body) => create.mutate(body)}
          onSwitchKind={(kind) => setOpen(kind === "borrowed" ? "borrow" : "lend")}
        />
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? editing.person : "Record"}>
        {editing ? (
          <LendDetailForm
            key={editing.id}
            record={editing}
            currency={currency}
            pending={update.isPending}
            onSave={(body) => update.mutate({ id: editing.id, body })}
            onSettle={() => update.mutate({ id: editing.id, body: { status: "settled" } })}
            onDelete={() => {
              const item = editing;
              setEditing(null);
              setDeleting(item);
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete record for ${deleting?.person ?? "this person"}?`}
        description="This permanently removes the borrow/lend record from your account."
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function LendForm({
  kind,
  currency,
  pending,
  onSave,
  onSwitchKind,
}: {
  kind: LendKind;
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
  onSwitchKind: (kind: LendKind) => void;
}) {
  const [person, setPerson] = useState("");
  const [relation, setRelation] = useState("Friend");
  const [amount, setAmount] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          person: person || "Someone",
          relation,
          kind,
          amountMinor: majorToMinor(amount || "1"),
          givenOn: isoToday(),
          dueOn: isoPlusDays(10),
          status: "pending",
          currency,
        });
      }}
    >
      <Field label="Type">
        <Select value={kind} onChange={(event) => onSwitchKind(event.target.value as LendKind)}>
          <option value="lent">Lent money</option>
          <option value="borrowed">Borrowed money</option>
        </Select>
      </Field>
      <Field label="Person name">
        <Input value={person} onChange={(event) => setPerson(event.target.value)} required />
      </Field>
      <Field label="Relation">
        <Input value={relation} onChange={(event) => setRelation(event.target.value)} />
      </Field>
      <Field label="Amount">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function LendDetailForm({
  record,
  currency,
  pending,
  onSave,
  onSettle,
  onDelete,
}: {
  record: LendRecord;
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
  onSettle: () => void;
  onDelete: () => void;
}) {
  const [person, setPerson] = useState(record.person);
  const [relation, setRelation] = useState(record.relation ?? "");
  const [amount, setAmount] = useState(String(record.amountMinor / 100));
  const [givenOn, setGivenOn] = useState(record.givenOn);
  const [dueOn, setDueOn] = useState(record.dueOn);
  const [status, setStatus] = useState(record.status);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          person: person || record.person,
          relation: relation || null,
          kind: record.kind,
          amountMinor: majorToMinor(amount || "1"),
          givenOn,
          dueOn,
          status,
          currency,
        });
      }}
    >
      <Field label="Person name">
        <Input value={person} onChange={(event) => setPerson(event.target.value)} required />
      </Field>
      <Field label="Relation">
        <Input value={relation} onChange={(event) => setRelation(event.target.value)} />
      </Field>
      <Field label="Amount">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </Field>
      <Field label="Status">
        <Select value={status} onChange={(event) => setStatus(event.target.value as LendRecord["status"])}>
          <option value="pending">pending</option>
          <option value="due">due</option>
          <option value="settled">settled</option>
        </Select>
      </Field>
      <Field label="Given on">
        <Input type="date" value={givenOn} onChange={(event) => setGivenOn(event.target.value)} required />
      </Field>
      <Field label="Due on">
        <Input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} required />
      </Field>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="danger" onClick={onDelete}>
          <Trash2 size={16} /> Delete
        </Button>
        {record.status !== "settled" ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={onSettle}>
            Settle
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
