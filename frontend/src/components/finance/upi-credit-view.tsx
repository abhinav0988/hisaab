"use client";

import type { CreditFacility } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { creditOverview, majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleHelp,
  IndianRupee,
  Moon,
  Play,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Sun,
  Wallet,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { sumMinor } from "@/lib/finance-modules";
import { money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";
import "../../app/upi38.css";

const PROVIDERS = ["Paytm UPI Credit", "PhonePe UPI Credit", "Google Pay UPI Credit"] as const;

const SUPPORTED_APPS = [
  { name: "Google Pay", tone: "gpay", hint: "Link and track credit line" },
  { name: "PhonePe", tone: "phonepe", hint: "Link and track credit line" },
  { name: "Paytm", tone: "paytm", hint: "Link and track credit line" },
] as const;

const BENEFITS = [
  { title: "Unified view", text: "See every UPI credit line in one place.", icon: Wallet },
  { title: "Smart tracking", text: "Watch used vs available limit in real time.", icon: Zap },
  { title: "Timely reminders", text: "Stay ahead of bill due dates.", icon: Bell },
  { title: "Better financial control", text: "Spot overspend before it piles up.", icon: Sparkles },
] as const;

const FEATURES = [
  { title: "Track total limit and usage", icon: Wallet },
  { title: "Get bill due date reminders", icon: Bell },
  { title: "Monitor spending and categories", icon: IndianRupee },
  { title: "Stay informed with smart alerts", icon: Sparkles },
] as const;

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function formatPct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value * 10) / 10))}%`;
}

function meterWidth(pct: number) {
  return `${Math.max(0, Math.min(100, pct))}%`;
}

function UpiThemeButton() {
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
      className="u38-btn icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

function UpiNotifyButton({ notices }: { notices: Array<{ title: string; body: string }> }) {
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
    <div className="u38-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="u38-btn icon u38-notify"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
        {notices.length ? <span className="u38-notify-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="u38-notify-panel" role="dialog" aria-label="UPI credit notifications">
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
            <p className="u38-notify-empty">No UPI credit alerts yet. Usage and due reminders will show here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function UpiCreditView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
    retry: false,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditFacility | null>(null);
  const [deleting, setDeleting] = useState<CreditFacility | null>(null);
  const [search, setSearch] = useState("");

  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createCreditFacility(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["credit-facilities"] });
      setOpen(false);
      toast.success("UPI credit saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => financeService.updateCreditFacility(id, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["credit-facilities"] });
      setEditing(null);
      toast.success("UPI credit updated");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => financeService.deleteCreditFacility(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["credit-facilities"] });
      setDeleting(null);
      setEditing(null);
      toast.success("UPI credit removed");
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  const list = useMemo(
    () => (facilities.data ?? []).filter((item) => item.kind === "UPI"),
    [facilities.data],
  );
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return list;
    return list.filter((item) => {
      const haystack = `${item.name} ${item.provider ?? ""} ${item.mask ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [list, query]);

  if (profile.isLoading || facilities.isLoading) return <PageSkeleton />;
  if (facilities.isError) return <ErrorState retry={() => void facilities.refetch()} />;

  const currency = profile.data?.defaultCurrency ?? "INR";
  const overview = creditOverview({
    limitMinor: sumMinor(list, (item) => item.limitMinor),
    usedMinor: sumMinor(list, (item) => item.usedMinor),
    overdueMinor: sumMinor(list, (item) => item.overdueMinor),
    holdMinor: sumMinor(list, (item) => item.holdMinor ?? 0),
  });
  const todaySpend = sumMinor(list, (item) => item.todaySpendMinor);
  const notices = list
    .filter((item) => item.limitMinor > 0 && item.usedMinor / item.limitMinor >= 0.7)
    .slice(0, 4)
    .map((item) => ({
      title: `${item.name} · high usage`,
      body: `${money(item.usedMinor, currency)} of ${money(item.limitMinor, currency)} used.`,
    }));

  function openAdd() {
    setOpen(true);
  }

  return (
    <div className="upi38">
      <section className="u38-head">
        <div className="u38-head-left">
          <div className="u38-page-icon" aria-hidden="true">
            <Wallet size={24} />
          </div>
          <div>
            <h1>UPI Credit</h1>
            <p>Track UPI-linked credit lines, usage and remaining limit — all in one place.</p>
          </div>
        </div>
        <div className="u38-head-actions">
          <label className="u38-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search UPI credit"
              placeholder="Search UPI credit, banks..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="u38-btn" aria-label="Current month">
            <CalendarDays size={15} aria-hidden="true" />
            {monthLabel()}
          </button>
          <UpiNotifyButton notices={notices} />
          <UpiThemeButton />
          <button type="button" className="u38-btn primary" onClick={openAdd}>
            <Plus size={15} aria-hidden="true" />
            Add UPI Credit
          </button>
        </div>
      </section>

      <section className="u38-kpis" aria-label="UPI credit summary">
        <article className="u38-kpi green">
          <div className="u38-kpi-top">
            <span className="label">Total UPI Credit Limit</span>
            <span className="u38-kpi-icon">
              <Wallet size={18} />
            </span>
          </div>
          <strong>{money(overview.limitMinor, currency)}</strong>
          <small>
            Across {list.length} account{list.length === 1 ? "" : "s"}
          </small>
        </article>
        <article className="u38-kpi blue">
          <div className="u38-kpi-top">
            <span className="label">Total Used</span>
            <span className="u38-kpi-icon">
              <Zap size={18} />
            </span>
          </div>
          <strong>{money(overview.usedMinor, currency)}</strong>
          <div className="u38-meter" aria-hidden="true">
            <i style={{ width: meterWidth(overview.usedPct) }} />
          </div>
          <small>{formatPct(overview.usedPct)} of total limit</small>
        </article>
        <article className="u38-kpi purple">
          <div className="u38-kpi-top">
            <span className="label">Available Limit</span>
            <span className="u38-kpi-icon">
              <IndianRupee size={18} />
            </span>
          </div>
          <strong>{money(overview.availableMinor, currency)}</strong>
          <div className="u38-meter" aria-hidden="true">
            <i style={{ width: meterWidth(overview.availablePct) }} />
          </div>
          <small>{formatPct(overview.availablePct)} remaining</small>
        </article>
        <article className="u38-kpi gold">
          <div className="u38-kpi-top">
            <span className="label">Today&apos;s Spend</span>
            <span className="u38-kpi-icon">
              <Smartphone size={18} />
            </span>
          </div>
          <strong>{money(todaySpend, currency)}</strong>
          <small>Across all UPI credit</small>
        </article>
      </section>

      <section className="u38-board">
        <div className="u38-board-main">
          <section className="u38-hero">
            <div className="u38-hero-copy">
              <h2>
                Track your <span>UPI credit lines</span>
              </h2>
              <p>Add Paytm, PhonePe or Google Pay credit lines to monitor limits, usage and remaining balance.</p>
              <div className="u38-hero-actions">
                <button type="button" className="u38-btn primary" onClick={openAdd}>
                  <Plus size={15} aria-hidden="true" />
                  Add UPI Credit
                </button>
                <button
                  type="button"
                  className="u38-btn ghost"
                  onClick={() => toast.info("Add a UPI credit line, set limit and used amount, then track it here.")}
                >
                  <Play size={14} aria-hidden="true" />
                  How it works
                </button>
              </div>
            </div>
            <div className="u38-hero-visual" aria-hidden="true">
              <div className="u38-hero-glow" />
              <div className="u38-phone">
                <span className="u38-phone-notch" />
                <strong>UPI</strong>
                <small>Credit</small>
              </div>
              <i className="u38-float is-gpay">G</i>
              <i className="u38-float is-phonepe">Pe</i>
              <i className="u38-float is-paytm">Pay</i>
            </div>
          </section>

          {filtered.length ? (
            <div className="u38-lines">
              {filtered.map((line) => {
                const pct = line.limitMinor ? (line.usedMinor / line.limitMinor) * 100 : 0;
                return (
                  <Card key={line.id} className="u38-line">
                    <header>
                      <span className="u38-line-icon" aria-hidden="true">
                        <Wallet size={18} />
                      </span>
                      <div className="min-w-0">
                        <h3>{line.name}</h3>
                        <small>
                          {line.provider || "Credit line"}
                          {line.mask ? ` · ${line.mask}` : ""}
                        </small>
                      </div>
                      <div className="u38-line-actions">
                        <button type="button" className="u38-btn" onClick={() => setEditing(line)}>
                          Edit
                        </button>
                        <button type="button" className="u38-btn danger" onClick={() => setDeleting(line)}>
                          Remove
                        </button>
                      </div>
                    </header>
                    <div className="u38-line-stats">
                      <div>
                        <small>Used</small>
                        <b>{money(line.usedMinor, currency)}</b>
                      </div>
                      <div>
                        <small>Limit</small>
                        <b>{money(line.limitMinor, currency)}</b>
                      </div>
                      <div>
                        <small>Available</small>
                        <b>{money(Math.max(0, line.limitMinor - line.usedMinor), currency)}</b>
                      </div>
                    </div>
                    <div className="u38-meter" aria-hidden="true">
                      <i style={{ width: meterWidth(pct) }} />
                    </div>
                    <small className="u38-line-note">{formatPct(pct)} used</small>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="u38-empty">
              <div className="u38-empty-icon" aria-hidden="true">
                <Wallet size={28} />
                <Plus size={14} className="u38-empty-plus" />
              </div>
              <h2>No UPI credit lines added</h2>
              <p>Add a Paytm, PhonePe or Google Pay credit line to start tracking usage and remaining limit.</p>
              <button type="button" className="u38-btn primary" onClick={openAdd}>
                <Plus size={15} aria-hidden="true" />
                Add UPI Credit
              </button>
              <ul className="u38-features">
                {FEATURES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title}>
                      <span>
                        <Icon size={16} />
                      </span>
                      <b>{item.title}</b>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <aside className="u38-board-side">
          <Card className="u38-panel">
            <header>
              <div>
                <h2>Supported Apps</h2>
                <small>Popular UPI credit providers</small>
              </div>
              <button type="button" className="u38-text-link" onClick={openAdd}>
                View all
              </button>
            </header>
            <ul className="u38-apps">
              {SUPPORTED_APPS.map((app) => (
                <li key={app.name}>
                  <span className={`u38-app-logo is-${app.tone}`}>{app.name.slice(0, 1)}</span>
                  <div>
                    <strong>{app.name}</strong>
                    <small>{app.hint}</small>
                  </div>
                  <button type="button" className="u38-text-link" onClick={openAdd}>
                    Link
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="u38-panel">
            <header>
              <div>
                <h2>Benefits of UPI Credit</h2>
                <small>Why track these lines here</small>
              </div>
              <span className="u38-diamond" aria-hidden="true">
                ◆
              </span>
            </header>
            <ul className="u38-benefits">
              {BENEFITS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title}>
                    <span>
                      <Icon size={15} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.text}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="u38-help">
            <span className="u38-help-icon" aria-hidden="true">
              <CircleHelp size={18} />
            </span>
            <div>
              <h2>Need help?</h2>
              <p>Learn how to set up and manage UPI credit lines.</p>
            </div>
            <button
              type="button"
              className="u38-btn ghost"
              onClick={() => toast.info("Add your provider, set the total limit, then update used amount as you spend.")}
            >
              <BookOpen size={14} aria-hidden="true" />
              View Help Guide
            </button>
          </Card>
        </aside>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Add UPI credit line">
        <UpiForm currency={currency} pending={create.isPending} onSave={(body) => create.mutate(body)} />
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit UPI credit line">
        {editing ? (
          <UpiForm
            key={editing.id}
            currency={currency}
            initial={editing}
            pending={update.isPending}
            onSave={(body) => update.mutate({ id: editing.id, body })}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? "UPI credit"}?`}
        description="This removes the credit line from your account. Card and transaction history are not changed."
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function UpiForm({
  currency,
  initial,
  pending,
  onSave,
}: {
  currency: string;
  initial?: CreditFacility;
  pending: boolean;
  onSave: (body: unknown) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "Paytm UPI Credit");
  const [limit, setLimit] = useState(initial ? String(initial.limitMinor / 100) : "");
  const [used, setUsed] = useState(initial ? String(initial.usedMinor / 100) : "");
  const providerLabel = name.replace(/\s+UPI Credit$/i, "") || "Credit line";
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (initial) {
          onSave({
            name,
            provider: providerLabel,
            mask: initial.mask,
            limitMinor: majorToMinor(limit || "0"),
            usedMinor: used ? majorToMinor(used) : 0,
          });
          return;
        }
        onSave({
          kind: "UPI",
          name,
          provider: providerLabel,
          mask: null,
          limitMinor: majorToMinor(limit || "0"),
          usedMinor: used ? majorToMinor(used) : 0,
          todaySpendMinor: 0,
          overdueMinor: 0,
          dueOn: null,
          currency,
        });
      }}
    >
      <Field label="Provider">
        <Select value={name} onChange={(event) => setName(event.target.value)}>
          {PROVIDERS.map((item) => (
            <option key={item}>{item}</option>
          ))}
          {initial && !PROVIDERS.includes(initial.name as (typeof PROVIDERS)[number]) ? (
            <option value={initial.name}>{initial.name}</option>
          ) : null}
        </Select>
      </Field>
      <Field label="Total limit">
        <Input type="number" min="0" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} required />
      </Field>
      <Field label="Used amount">
        <Input type="number" min="0" step="0.01" value={used} onChange={(event) => setUsed(event.target.value)} />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
