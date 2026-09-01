"use client";

import type { Loan, LoanScheduleEntry } from "@hisaab/types";
import { Badge, Button, Card, Field, Input } from "@hisaab/ui";
import {
  LOAN_TYPES,
  emiDueCopy,
  loanSchedule,
  loanSummary,
  majorToMinor,
  ordinal,
  type EmiInstallmentStatus,
  type LoanTypeName,
} from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  Home,
  IndianRupee,
  Landmark,
  MoreVertical,
  Percent,
  Smartphone,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { displayDateLong, isoToday } from "@/lib/finance-modules";
import { money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";

const LOAN_TYPE_META: Array<{ name: LoanTypeName; icon: LucideIcon }> = [
  { name: "Home Loan", icon: Home },
  { name: "Personal Loan", icon: UserRound },
  { name: "Gadget EMI", icon: Smartphone },
  { name: "Two Wheeler", icon: Bike },
  { name: "Other", icon: Landmark },
];

type Draft = {
  name: string;
  lender: string;
  rate: string;
  principal: string;
  totalEmis: string;
  remainingEmis: string;
  emi: string;
  emiDay: number;
  emiDate: string;
};

type FieldErrors = Partial<Record<keyof Draft, string>>;

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function todayEmiDay() {
  return Math.min(31, Math.max(1, new Date().getDate()));
}

function emptyDraft(): Draft {
  const emiDate = isoToday();
  return {
    name: "Home Loan",
    lender: "",
    rate: "",
    principal: "",
    totalEmis: "",
    remainingEmis: "",
    emi: "",
    emiDay: Number(emiDate.slice(8, 10)),
    emiDate,
  };
}

function draftFromLoan(loan: Loan): Draft {
  const emiDay = loan.emiDay || todayEmiDay();
  return {
    name: loan.name,
    lender: loan.lender,
    rate: loan.rate,
    principal: loan.principalMinor
      ? String(loan.principalMinor / 100)
      : loan.outstandingMinor
        ? String(loan.outstandingMinor / 100)
        : "",
    totalEmis: loan.totalEmis ? String(loan.totalEmis) : loan.remainingEmis ? String(loan.remainingEmis) : "",
    remainingEmis: String(loan.remainingEmis ?? ""),
    emi: loan.emiMinor ? String(loan.emiMinor / 100) : "",
    emiDay,
    emiDate: loan.dueOn || isoToday(),
  };
}

function parseAmountMinor(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  try {
    return majorToMinor(cleaned);
  } catch {
    return Number.NaN;
  }
}

function parseCount(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return Number.NaN;
  return value;
}

function typeMeta(name: string) {
  return LOAN_TYPE_META.find((item) => item.name === name) ?? { name: "Other" as const, icon: Landmark };
}

function isLoanTypeSelected(name: string, type: LoanTypeName) {
  if (type === "Other") return !LOAN_TYPES.slice(0, 4).includes(name as Exclude<LoanTypeName, "Other">);
  return name === type;
}

function formatPct(value: number) {
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function loanCode(id: string) {
  return `LN${id.replace(/-/g, "").slice(-10).toUpperCase()}`;
}

function typeTone(name: string) {
  if (name === "Home Loan") return "home";
  if (name === "Personal Loan") return "personal";
  if (name === "Gadget EMI") return "gadget";
  if (name === "Two Wheeler") return "wheeler";
  return "other";
}

function typeAccent(name: string) {
  const tone = typeTone(name);
  if (tone === "personal") return "#2aa8a0";
  if (tone === "gadget") return "var(--warning)";
  if (tone === "wheeler") return "#4d8ec8";
  if (tone === "other") return "#8b7cc9";
  return "var(--primary)";
}

function rateLabel(rate: string) {
  const trimmed = rate.trim();
  if (!trimmed) return "—";
  return /%/.test(trimmed) ? trimmed : `${trimmed}% p.a.`;
}

function loanFigures(loan: Loan) {
  return loanSummary({
    principalMinor: loan.principalMinor,
    emiMinor: loan.emiMinor,
    totalEmis: loan.totalEmis || loan.remainingEmis,
    remainingEmis: loan.remainingEmis,
    emiDay: loan.emiDay || 1,
  });
}

const IconInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }>(
  function IconInput({ icon: Icon, className, ...props }, ref) {
    return (
      <div className="loan-input-icon">
        <Icon className="loan-input-icon-mark" size={16} aria-hidden="true" />
        <Input ref={ref} className={className} {...props} />
      </div>
    );
  },
);

const DateInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function DateInput(props, ref) {
    return (
      <div className="date-shell">
        <span className="calendar-icon" aria-hidden="true">
          <Calendar size={13} />
        </span>
        <Input ref={ref} type="date" {...props} />
      </div>
    );
  },
);

export function LoansView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const loans = useQuery({ queryKey: ["loans"], queryFn: () => financeService.listLoans(), retry: false });
  const [screen, setScreen] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Loan | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleting, setDeleting] = useState<Loan | null>(null);
  const [details, setDetails] = useState<Loan | null>(null);
  const [scheduleLoan, setScheduleLoan] = useState<Loan | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [paying, setPaying] = useState<Loan | null>(null);

  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createLoan(body),
    onError: (error) => toast.error(failMessage(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => financeService.updateLoan(id, body),
    onError: (error) => toast.error(failMessage(error)),
  });
  const pay = useMutation({
    mutationFn: (id: string) => financeService.payLoanEmi(id),
    onSuccess: async (loan) => {
      await client.invalidateQueries({ queryKey: ["loans"] });
      await client.invalidateQueries({ queryKey: ["loans", loan.id, "schedule"] });
      toast.success("EMI marked as paid");
      setPaying(null);
      setDetails((current) => (current?.id === loan.id ? loan : current));
      setScheduleLoan((current) => (current?.id === loan.id ? loan : current));
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => financeService.deleteLoan(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Loan removed");
      setDeleting(null);
      if (editing && deleting && editing.id === deleting.id) {
        setScreen("list");
        setEditing(null);
      }
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  if (profile.isLoading || loans.isLoading) return <PageSkeleton />;
  if (loans.isError) return <ErrorState retry={() => void loans.refetch()} />;

  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = loans.data ?? [];
  const figures = list.map((item) => ({ loan: item, summary: loanFigures(item) }));
  const outstanding = figures.reduce((sum, item) => sum + item.loan.outstandingMinor, 0);
  const paidMinor = figures.reduce((sum, item) => sum + item.summary.paidMinor, 0);
  const emi = figures.reduce((sum, item) => sum + item.loan.emiMinor, 0);
  const principal = figures.reduce(
    (sum, item) => sum + (item.loan.principalMinor || item.loan.outstandingMinor),
    0,
  );
  const remainingEmis = figures.reduce((sum, item) => sum + item.loan.remainingEmis, 0);
  const active = list.filter((item) => item.remainingEmis > 0);
  const nextDue = [...active].map((item) => item.dueOn).filter(Boolean).sort()[0];
  const nextDueCopy = nextDue ? emiDueCopy(nextDue) : null;
  const upcoming = list
    .flatMap((loan) =>
      loanSchedule({
        emiMinor: loan.emiMinor,
        totalEmis: loan.totalEmis || loan.remainingEmis,
        remainingEmis: loan.remainingEmis,
        dueOn: loan.dueOn,
      })
        .filter((item) => item.status !== "paid")
        .map((item) => ({ loan, item })),
    )
    .sort((left, right) => left.item.dueOn.localeCompare(right.item.dueOn))
    .slice(0, 3);
  const upcomingAll = list
    .flatMap((loan) =>
      loanSchedule({
        emiMinor: loan.emiMinor,
        totalEmis: loan.totalEmis || loan.remainingEmis,
        remainingEmis: loan.remainingEmis,
        dueOn: loan.dueOn,
      })
        .filter((item) => item.status !== "paid")
        .map((item) => ({ loan, item })),
    )
    .sort((left, right) => left.item.dueOn.localeCompare(right.item.dueOn))
    .slice(0, 24);
  const pending = create.isPending || update.isPending;

  function openAdd() {
    setEditing(null);
    setFormKey((value) => value + 1);
    setScreen("form");
  }
  function openEdit(loan: Loan) {
    setEditing(loan);
    setFormKey((value) => value + 1);
    setScreen("form");
  }

  async function handleSaved() {
    await client.invalidateQueries({ queryKey: ["loans"] });
    toast.success(editing ? "Loan updated" : "Loan saved");
    setScreen("list");
    setEditing(null);
  }

  return (
    <div>
      {screen === "list" ? (
        <>
          <PageHeader
            title="EMI & Loans"
            description="Track outstanding principal, EMI dates and progress."
            actions={<Button onClick={openAdd}>Add Loan</Button>}
          />
          <div className="loans-kpis">
            {(
              [
                { label: "Total Outstanding", value: money(outstanding, currency), icon: IndianRupee, tone: "green" },
                {
                  label: "Monthly EMI",
                  value: money(emi, currency),
                  note: `Across ${list.length} loan${list.length === 1 ? "" : "s"}`,
                  icon: Calendar,
                  tone: "blue",
                },
                {
                  label: "Next Due",
                  value: displayDateLong(nextDue),
                  note: nextDueCopy?.label,
                  noteTone: nextDueCopy?.tone,
                  icon: CalendarClock,
                  tone: "purple",
                },
                { label: "Active Loans", value: String(active.length), icon: FolderOpen, tone: "gold" },
                { label: "Paid Amount", value: money(paidMinor, currency), icon: CheckCircle2, tone: "green" },
                { label: "Pending Amount", value: money(outstanding, currency), icon: Clock, tone: "orange" },
              ] as Array<{
                label: string;
                value: string;
                note?: string;
                noteTone?: string;
                icon: LucideIcon;
                tone: string;
              }>
            ).map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} className="loans-kpi">
                  <span className={`loans-kpi-icon is-${item.tone}`}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    {item.note ? <span className={item.noteTone ? `is-${item.noteTone}` : undefined}>{item.note}</span> : null}
                  </div>
                </Card>
              );
            })}
          </div>
          {list.length ? (
            <div className="loans-board">
              <div className="loans-board-main">
                {list.map((item) => (
                  <LoanCard
                    key={item.id}
                    loan={item}
                    currency={currency}
                    onDetails={() => setDetails(item)}
                    onSchedule={() => setScheduleLoan(item)}
                    onPay={() => setPaying(item)}
                    onEdit={() => openEdit(item)}
                    onDelete={() => setDeleting(item)}
                  />
                ))}
              </div>
              <aside className="loans-board-side">
                <UpcomingEmis
                  items={upcoming}
                  currency={currency}
                  onViewAll={() => setShowUpcoming(true)}
                  onPay={(loan) => setPaying(loan)}
                />
                <EmiCalendar loans={list} />
                <Card className="loans-totals">
                  <h2>Summary across all loans</h2>
                  <dl>
                    <div>
                      <dt>Total Loan Amount</dt>
                      <dd>{money(principal, currency)}</dd>
                    </div>
                    <div>
                      <dt>Total Paid Amount</dt>
                      <dd className="is-paid">{money(paidMinor, currency)}</dd>
                    </div>
                    <div>
                      <dt>Total Pending Amount</dt>
                      <dd className="is-pending">{money(outstanding, currency)}</dd>
                    </div>
                    <div>
                      <dt>Total Remaining EMIs</dt>
                      <dd>{remainingEmis}</dd>
                    </div>
                    <div>
                      <dt>Monthly EMI (Total)</dt>
                      <dd>{money(emi, currency)}</dd>
                    </div>
                  </dl>
                </Card>
              </aside>
            </div>
          ) : (
            <EmptyState
              title="No loans yet"
              description="Add a home, personal, gadget or two-wheeler EMI and we will calculate the rest."
              action={<Button onClick={openAdd}>Add Loan</Button>}
            />
          )}
        </>
      ) : (
        <LoanComposer
          key={formKey}
          currency={currency}
          existing={editing}
          pending={pending}
          onClose={() => {
            setScreen("list");
            setEditing(null);
          }}
          onSave={async (body) => {
            if (editing) {
              await update.mutateAsync({ id: editing.id, body });
            } else {
              await create.mutateAsync(body);
            }
            await handleSaved();
          }}
        />
      )}
      <Modal
        open={Boolean(details)}
        onClose={() => setDetails(null)}
        title={details ? details.name : "Loan"}
        description={details ? `${details.lender} · ${loanCode(details.id)}` : undefined}
        size="lg"
      >
        {details ? (
          <LoanDetails
            loan={details}
            currency={currency}
            onEdit={() => {
              const loan = details;
              setDetails(null);
              openEdit(loan);
            }}
            onDelete={() => {
              const loan = details;
              setDetails(null);
              setDeleting(loan);
            }}
            onSchedule={() => {
              const loan = details;
              setDetails(null);
              setScheduleLoan(loan);
            }}
            onPay={() => setPaying(details)}
          />
        ) : null}
      </Modal>
      <Modal
        open={Boolean(scheduleLoan)}
        onClose={() => setScheduleLoan(null)}
        title={scheduleLoan ? `${scheduleLoan.name} EMI schedule` : "EMI schedule"}
        description={scheduleLoan ? scheduleLoan.lender : undefined}
        size="lg"
      >
        {scheduleLoan ? <SchedulePanel loan={scheduleLoan} currency={currency} onPay={() => setPaying(scheduleLoan)} /> : null}
      </Modal>
      <Modal
        open={showUpcoming}
        onClose={() => setShowUpcoming(false)}
        title="Upcoming EMIs"
        description="Remaining installments across all loans."
        size="lg"
      >
        <UpcomingEmis items={upcomingAll} currency={currency} onPay={(loan) => setPaying(loan)} />
      </Modal>
      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title="Mark EMI as paid"
        description={
          paying
            ? `Mark the ${money(paying.emiMinor, currency)} EMI for ${paying.name} (${paying.lender}) as paid? Remaining EMIs will become ${Math.max(0, paying.remainingEmis - 1)}.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPaying(null)}>
            Cancel
          </Button>
          <Button disabled={pay.isPending} onClick={() => paying && pay.mutate(paying.id)}>
            {pay.isPending ? "Saving…" : "Mark done"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove loan"
        description={deleting ? `Remove ${deleting.name} from ${deleting.lender}? This cannot be undone.` : undefined}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => deleting && remove.mutate(deleting.id)}
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function LoanComposer({
  currency,
  existing,
  pending,
  onClose,
  onSave,
}: {
  currency: string;
  existing: Loan | null;
  pending: boolean;
  onClose: () => void;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => (existing ? draftFromLoan(existing) : emptyDraft()));
  const [errors, setErrors] = useState<FieldErrors>({});
  const TypeIcon = typeMeta(draft.name).icon;
  const principalMinor = parseAmountMinor(draft.principal) || 0;
  const emiMinor = parseAmountMinor(draft.emi) || 0;

  const summary = useMemo(() => {
    const totalEmis = parseCount(draft.totalEmis);
    const remainingEmis = parseCount(draft.remainingEmis);
    return loanSummary({
      principalMinor: Number.isFinite(principalMinor) ? principalMinor : 0,
      emiMinor: Number.isFinite(emiMinor) ? emiMinor : 0,
      totalEmis: Number.isFinite(totalEmis) && totalEmis ? totalEmis : 0,
      remainingEmis: Number.isFinite(remainingEmis) && remainingEmis ? remainingEmis : 0,
      emiDay: draft.emiDay,
    });
  }, [draft.emiDay, draft.remainingEmis, draft.totalEmis, emiMinor, principalMinor]);

  async function submit() {
    const nextPrincipal = parseAmountMinor(draft.principal);
    const nextEmi = parseAmountMinor(draft.emi);
    const totalEmis = parseCount(draft.totalEmis);
    const remainingEmis = parseCount(draft.remainingEmis);
    const nextErrors: FieldErrors = {};
    if (!draft.lender.trim()) nextErrors.lender = "Enter the lender or bank name.";
    if (!nextPrincipal || Number.isNaN(nextPrincipal)) nextErrors.principal = "Enter the total loan amount.";
    if (!nextEmi || Number.isNaN(nextEmi)) nextErrors.emi = "Enter the monthly EMI.";
    if (!totalEmis || Number.isNaN(totalEmis) || totalEmis < 1) nextErrors.totalEmis = "Enter total EMIs.";
    if (remainingEmis === null || Number.isNaN(remainingEmis) || remainingEmis < 0) {
      nextErrors.remainingEmis = "Enter remaining EMIs.";
    } else if (totalEmis && remainingEmis > totalEmis) {
      nextErrors.remainingEmis = "Remaining EMIs cannot exceed total EMIs.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await onSave({
        name: draft.name,
        lender: draft.lender.trim(),
        rate: draft.rate.trim(),
        principalMinor: nextPrincipal,
        emiMinor: nextEmi,
        totalEmis,
        remainingEmis,
        emiDay: draft.emiDay,
        currency,
      });
    } catch {
      /* mutation onError already surfaced a toast */
    }
  }

  return (
    <div>
      <div className="loan-composer">
        <form
          className="loan-composer-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <header className="loan-composer-head">
            <div>
              <h1>{existing ? "Edit Loan / EMI" : "Add Loan / EMI"}</h1>
              <p>Enter loan details and we&apos;ll calculate everything for you.</p>
            </div>
            <Button type="button" variant="secondary" className="loan-composer-close" onClick={onClose}>
              <X size={16} />
              Close
            </Button>
          </header>

          <section className="loan-section">
            <div className="loan-section-head">
              <span className="loan-section-num">1</span>
              <h2>Loan Details</h2>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2 text-[13px] font-extrabold">
                <span>Loan Type</span>
                <div role="radiogroup" aria-label="Loan Type" className="loan-types">
                  {LOAN_TYPE_META.map((item) => {
                    const Icon = item.icon;
                    const isActive = isLoanTypeSelected(draft.name, item.name);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={isActive ? "loan-type is-active" : "loan-type"}
                        onClick={() => setDraft((current) => ({ ...current, name: item.name }))}
                      >
                        <Icon size={18} strokeWidth={1.9} />
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Lender / Bank" hint="e.g. HDFC Bank, Bajaj Finance, ICICI Bank." error={errors.lender}>
                <IconInput
                  icon={Landmark}
                  value={draft.lender}
                  placeholder="Enter lender / bank name"
                  onChange={(event) => setDraft((current) => ({ ...current, lender: event.target.value }))}
                />
              </Field>
              <Field label="Interest Rate (% p.a.)" hint="Optional">
                <IconInput
                  icon={Percent}
                  inputMode="decimal"
                  value={draft.rate}
                  placeholder="e.g. 8.5"
                  onChange={(event) => setDraft((current) => ({ ...current, rate: event.target.value }))}
                />
              </Field>
            </div>
          </section>

          <section className="loan-section">
            <div className="loan-section-head">
              <span className="loan-section-num">2</span>
              <h2>EMI &amp; Loan Details</h2>
            </div>
            <div className="loan-fields-grid">
              <Field label="Total Loan Amount (₹)" error={errors.principal}>
                <IconInput
                  icon={IndianRupee}
                  inputMode="decimal"
                  value={draft.principal}
                  placeholder="10,00,000"
                  onChange={(event) => setDraft((current) => ({ ...current, principal: event.target.value }))}
                />
              </Field>
              <Field label="Total EMIs" error={errors.totalEmis}>
                <IconInput
                  icon={Calendar}
                  inputMode="numeric"
                  value={draft.totalEmis}
                  placeholder="60"
                  onChange={(event) => setDraft((current) => ({ ...current, totalEmis: event.target.value }))}
                />
              </Field>
              <Field label="Remaining EMIs" error={errors.remainingEmis}>
                <IconInput
                  icon={Clock}
                  inputMode="numeric"
                  value={draft.remainingEmis}
                  placeholder="41"
                  onChange={(event) => setDraft((current) => ({ ...current, remainingEmis: event.target.value }))}
                />
              </Field>
              <Field label="Monthly EMI (₹)" error={errors.emi}>
                <IconInput
                  icon={IndianRupee}
                  inputMode="decimal"
                  value={draft.emi}
                  placeholder="18,500"
                  onChange={(event) => setDraft((current) => ({ ...current, emi: event.target.value }))}
                />
              </Field>
              <Field
                label="EMI Date (Monthly)"
                hint={`EMI will be generated on the ${ordinal(draft.emiDay)} of each month.`}
              >
                <DateInput
                  value={draft.emiDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    const day = Number(value.slice(8, 10));
                    if (!value || !Number.isInteger(day) || day < 1 || day > 31) return;
                    setDraft((current) => ({ ...current, emiDate: value, emiDay: day }));
                  }}
                />
              </Field>
            </div>
          </section>

          <section className="loan-section">
            <div className="loan-section-head">
              <span className="loan-section-num">3</span>
              <h2>Live Summary (Calculated)</h2>
            </div>
            <div className="loan-summary">
              <SummaryCard
                label="Paid EMIs"
                value={`${summary.paidEmis} / ${Number.isFinite(parseCount(draft.totalEmis)) ? parseCount(draft.totalEmis) || 0 : 0}`}
              />
              <SummaryCard label="Paid Amount" value={money(summary.paidMinor, currency)} tone="success" />
              <SummaryCard label="Remaining EMIs" value={String(summary.remainingEmis)} />
              <SummaryCard
                label="Remaining Payable"
                value={money(summary.remainingPayableMinor, currency)}
                tone="warning"
              />
              <SummaryCard label="Total EMI Payable" value={money(summary.totalPayableMinor, currency)} />
              <SummaryCard label="Estimated Interest" value={money(summary.interestMinor, currency)} tone="danger" />
              <SummaryCard label="Next EMI Date" value={displayDateLong(summary.nextDue)} />
              <SummaryCard label="Completion" value={formatPct(summary.completionPct)}>
                <CompletionRing pct={summary.completionPct} size={54} />
              </SummaryCard>
            </div>
            {summary.remainingEmis > 0 ? (
              <p className="loan-banner">
                Schedule of {summary.remainingEmis} EMIs will be created starting from{" "}
                {displayDateLong(summary.nextDue)}.
              </p>
            ) : null}
          </section>

          <div className="loan-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (existing ? "Updating…" : "Saving…") : existing ? "Update Loan" : "Save Loan"}
            </Button>
          </div>
        </form>

        <aside className="loan-preview" aria-label="Loan preview">
          <small>Loan Preview</small>
          <div className="loan-art">
            <TypeIcon size={56} strokeWidth={1.6} />
          </div>
          <dl className="loan-preview-list">
            <PreviewRow label="Loan Type" value={draft.name} />
            <PreviewRow label="Lender / Bank" value={draft.lender || "—"} />
            <PreviewRow
              label="Total Loan Amount"
              value={money(Number.isFinite(principalMinor) ? principalMinor : 0, currency)}
            />
            <PreviewRow label="Monthly EMI" value={money(Number.isFinite(emiMinor) ? emiMinor : 0, currency)} />
            <PreviewRow label="Total EMIs" value={draft.totalEmis || "—"} />
            <PreviewRow label="Remaining EMIs" value={draft.remainingEmis || "—"} />
            <PreviewRow label="Paid Amount" value={money(summary.paidMinor, currency)} tone="success" />
            <PreviewRow
              label="Remaining Payable"
              value={money(summary.remainingPayableMinor, currency)}
              tone="warning"
            />
            <PreviewRow label="Next Payment Due" value={displayDateLong(summary.nextDue)} tone="success" />
          </dl>
          <div className="loan-preview-ring">
            <CompletionRing
              pct={summary.completionPct}
              size={168}
              label={`${formatPct(summary.completionPct)} Completed`}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function LoanCard({
  loan,
  currency,
  onDetails,
  onSchedule,
  onPay,
  onEdit,
  onDelete,
}: {
  loan: Loan;
  currency: string;
  onDetails: () => void;
  onSchedule: () => void;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const Icon = typeMeta(loan.name).icon;
  const summary = loanFigures(loan);
  const due = emiDueCopy(loan.dueOn);
  const totalEmis = loan.totalEmis || loan.remainingEmis;
  const active = loan.remainingEmis > 0;
  useEffect(() => {
    if (!menu) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);
  return (
    <article className={`loan-card is-${typeTone(loan.name)}`}>
      <header className="loan-card-head">
        <span className={`loan-card-icon is-${typeTone(loan.name)}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <div className="loan-card-title">
            <h3>{loan.name}</h3>
            <Badge tone={active ? "success" : "neutral"}>{active ? "Active" : "Completed"}</Badge>
          </div>
          <small>
            {loan.lender} · {loanCode(loan.id)}
          </small>
        </div>
        <div className="loan-row-menu" ref={menuRef}>
          <Button
            type="button"
            variant="ghost"
            className="px-2"
            aria-label={`Actions for ${loan.name}`}
            aria-expanded={menu}
            onClick={() => setMenu((value) => !value)}
          >
            <MoreVertical size={16} />
          </Button>
          {menu ? (
            <div className="loan-row-menu-panel" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  onEdit();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setMenu(false);
                  onDelete();
                }}
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div className="loan-card-body">
        <div className="loan-card-grid">
          <LoanStat label="Total Amount" value={money(loan.principalMinor || loan.outstandingMinor, currency)} />
          <LoanStat label="Monthly EMI" value={money(loan.emiMinor, currency)} />
          <LoanStat label="Remaining EMIs" value={`${loan.remainingEmis}${totalEmis ? ` / ${totalEmis}` : ""}`} />
          <div className="loan-stat">
            <small>Next Due</small>
            <b>{displayDateLong(loan.dueOn)}</b>
            <em className={`loan-due is-${due.tone}`}>{due.label}</em>
          </div>
          <LoanStat label="Paid Amount" value={money(summary.paidMinor, currency)} tone="success" />
          <LoanStat label="Pending Amount" value={money(loan.outstandingMinor, currency)} tone="warning" />
          <LoanStat label="Interest Rate" value={rateLabel(loan.rate)} />
        </div>
        <div className="loan-card-ring">
          <CompletionRing
            pct={summary.completionPct}
            size={118}
            accent={typeAccent(loan.name)}
            label={`${formatPct(summary.completionPct)} Completed`}
          />
        </div>
      </div>
      <div className="loan-card-actions">
        <Button type="button" variant="secondary" onClick={onDetails}>
          View Details
        </Button>
        <Button type="button" variant="secondary" onClick={onSchedule}>
          EMI Schedule
        </Button>
        {loan.remainingEmis > 0 ? (
          <Button type="button" onClick={onPay}>
            <Check size={16} />
            Mark done
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function UpcomingEmis({
  items,
  currency,
  onViewAll,
  onPay,
}: {
  items: Array<{ loan: Loan; item: LoanScheduleEntry }>;
  currency: string;
  onViewAll?: () => void;
  onPay?: (loan: Loan) => void;
}) {
  return (
    <Card className="loans-upcoming">
      <header>
        <div>
          <h2>Upcoming EMIs</h2>
          <small>Next 7 days</small>
        </div>
        {onViewAll ? (
          <button type="button" className="loans-view-all" onClick={onViewAll}>
            View all
          </button>
        ) : null}
      </header>
      {items.length ? (
        <ul>
          {items.map(({ loan, item }) => {
            const Icon = typeMeta(loan.name).icon;
            const due = emiDueCopy(item.dueOn);
            return (
              <li key={`${loan.id}-${item.installment}`}>
                <span className={`loan-card-icon is-${due.tone} is-${typeTone(loan.name)}`}>
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{loan.name}</strong>
                  <small>
                    {loan.lender} · {displayDateLong(item.dueOn)}
                  </small>
                </div>
                <div className="loans-upcoming-amt">
                  <b>{money(item.amountMinor, currency)}</b>
                  <em className={`loan-due is-${due.tone}`}>{due.label}</em>
                  {onPay && item.status !== "paid" && item.dueOn === loan.dueOn ? (
                    <button type="button" className="loans-mark-done" onClick={() => onPay(loan)}>
                      Mark done
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No EMIs due in the next 7 days.</p>
      )}
    </Card>
  );
}

function EmiCalendar({ loans }: { loans: Loan[] }) {
  const today = isoToday();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const marks = new Map<string, EmiInstallmentStatus>();
  for (const loan of loans) {
    for (const item of loanSchedule({
      emiMinor: loan.emiMinor,
      totalEmis: loan.totalEmis || loan.remainingEmis,
      remainingEmis: loan.remainingEmis,
      dueOn: loan.dueOn,
    })) {
      const key = item.dueOn;
      const current = marks.get(key);
      const rank: Record<EmiInstallmentStatus, number> = { overdue: 4, pending: 3, upcoming: 2, paid: 1 };
      if (!current || rank[item.status] > rank[current]) marks.set(key, item.status);
    }
  }
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; iso: string } | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return { day, iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }),
  ];
  const title = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(cursor);
  return (
    <Card className="loans-cal">
      <header>
        <h2>EMI Calendar</h2>
        <div className="loans-cal-nav">
          <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={16} />
          </button>
          <strong>{title}</strong>
          <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </header>
      <div className="loans-cal-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
          <span key={`${label}-${index}`} className="loans-cal-dow">
            {label}
          </span>
        ))}
        {cells.map((cell, index) =>
          cell ? (
            <span
              key={cell.iso}
              className={[
                "loans-cal-day",
                cell.iso === today ? "is-today" : "",
                marks.get(cell.iso) === "overdue" ? "is-overdue" : "",
              ].join(" ")}
            >
              <span className="loans-cal-num">{cell.day}</span>
              {marks.get(cell.iso) ? <i className={`loans-cal-dot is-${marks.get(cell.iso)}`} /> : <i className="loans-cal-dot is-empty" />}
            </span>
          ) : (
            <span key={`empty-${index}`} />
          ),
        )}
      </div>
      <ul className="loans-cal-legend">
        <li className="is-paid">Paid</li>
        <li className="is-pending">Pending</li>
        <li className="is-overdue">Overdue</li>
        <li className="is-upcoming">Upcoming</li>
      </ul>
    </Card>
  );
}

function LoanDetails({
  loan,
  currency,
  onEdit,
  onDelete,
  onSchedule,
  onPay,
}: {
  loan: Loan;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  onSchedule: () => void;
  onPay: () => void;
}) {
  const summary = loanFigures(loan);
  const totalEmis = loan.totalEmis || loan.remainingEmis;
  return (
    <div className="loan-details">
      <div className="loan-card-grid">
        <LoanStat label="Total Amount" value={money(loan.principalMinor || loan.outstandingMinor, currency)} />
        <LoanStat label="Monthly EMI" value={money(loan.emiMinor, currency)} />
        <LoanStat label="Remaining EMIs" value={`${loan.remainingEmis}${totalEmis ? ` / ${totalEmis}` : ""}`} />
        <LoanStat label="Next Due" value={displayDateLong(loan.dueOn)} />
        <LoanStat label="Paid Amount" value={money(summary.paidMinor, currency)} tone="success" />
        <LoanStat label="Pending Amount" value={money(loan.outstandingMinor, currency)} tone="warning" />
        <LoanStat label="Interest Rate" value={rateLabel(loan.rate)} />
        <LoanStat label="Completion" value={formatPct(summary.completionPct)} />
      </div>
      <div className="loan-card-actions">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="danger" onClick={onDelete}>
          Remove
        </Button>
        <Button type="button" variant="secondary" onClick={onSchedule}>
          EMI Schedule
        </Button>
        {loan.remainingEmis > 0 ? (
          <Button type="button" onClick={onPay}>
            <Check size={16} />
            Mark done
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SchedulePanel({ loan, currency, onPay }: { loan: Loan; currency: string; onPay: () => void }) {
  const schedule = useQuery({
    queryKey: ["loans", loan.id, "schedule"],
    queryFn: () => financeService.getLoanSchedule(loan.id),
  });
  if (schedule.isLoading) return <p>Loading schedule…</p>;
  if (schedule.isError) return <p>Could not load this EMI schedule.</p>;
  const items = schedule.data?.items ?? [];
  return (
    <div className="loan-schedule">
      <table>
        <thead>
          <tr>
            <th>EMI</th>
            <th>Due</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.installment}>
              <td>{item.installment}</td>
              <td>{displayDateLong(item.dueOn)}</td>
              <td>{money(item.amountMinor, currency)}</td>
              <td>
                <em className={`loan-due is-${item.status}`}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </em>
              </td>
              <td>
                {item.status !== "paid" && item.dueOn === loan.dueOn ? (
                  <button type="button" className="loans-mark-done" onClick={onPay}>
                    Mark done
                  </button>
                ) : item.status === "paid" ? (
                  <span className="loan-due is-paid">Done</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoanStat({ label, value, tone }: { label: string; value: string; tone?: "warning" | "success" }) {
  return (
    <div className="loan-stat">
      <small>{label}</small>
      <b
        className={
          tone === "warning" ? "text-[var(--warning)]" : tone === "success" ? "text-[var(--primary)]" : undefined
        }
      >
        {value}
      </b>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
  children?: ReactNode;
}) {
  return (
    <div className="loan-summary-card">
      <small>{label}</small>
      <div className="loan-summary-value">
        {children}
        <strong
          className={
            tone === "success"
              ? "text-[var(--primary)]"
              : tone === "warning"
                ? "text-[var(--warning)]"
                : tone === "danger"
                  ? "text-[var(--danger)]"
                  : undefined
          }
        >
          {value}
        </strong>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd
        className={
          tone === "success" ? "text-[var(--primary)]" : tone === "warning" ? "text-[var(--warning)]" : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CompletionRing({
  pct,
  size,
  label,
  accent,
}: {
  pct: number;
  size: number;
  label?: string;
  accent?: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(100, Math.max(0, pct));
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className="loan-ring"
      role="img"
      aria-label={label ?? formatPct(filled)}
    >
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={accent ?? "var(--primary)"}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - filled / 100)}
        transform="rotate(-90 60 60)"
      />
      {label ? (
        <text x="60" y="58" textAnchor="middle" className="loan-ring-pct">
          {formatPct(filled)}
        </text>
      ) : (
        <text x="60" y="64" textAnchor="middle" className="loan-ring-pct">
          {formatPct(filled)}
        </text>
      )}
      {label ? (
        <text x="60" y="76" textAnchor="middle" className="loan-ring-label">
          Completed
        </text>
      ) : null}
    </svg>
  );
}
