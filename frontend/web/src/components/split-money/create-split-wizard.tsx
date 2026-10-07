"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  allocateByPercentage,
  allocateByShares,
  allocateEqual,
  allocateExact,
  computeParticipantShares,
} from "@hisaab/validation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  FileText,
  FolderPlus,
  HandCoins,
  History,
  IndianRupee,
  Info,
  Mail,
  MessageCircle,
  Percent,
  Plus,
  ReceiptText,
  Repeat,
  Scale,
  Search,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import {
  avatarTone,
  clearDraft,
  defaultDraft,
  initials,
  loadDraft,
  majorStringToMinor,
  saveDraft,
  type SplitWizardDraft,
} from "./split-format";

const STEPS = [
  ["Expense Details", "Basic information"],
  ["Who Paid", "Select payer"],
  ["Split With", "Add people or groups"],
  ["Split Method", "Choose how to split"],
  ["Due Date & Reminder", "Set payment details"],
  ["Review", "Confirm and create"],
] as const;

function Avatar({ name, tone, small }: { name: string; tone: string; small?: boolean }) {
  return <span className={`sm-avatar ${tone} ${small ? "small" : ""}`}>{initials(name)}</span>;
}

function Head({ h, p }: { h: string; p: string }) {
  return (
    <div className="sm-section-heading">
      <h2>{h}</h2>
      <p>{p}</p>
    </div>
  );
}

const METHOD_LABELS: Record<SplitWizardDraft["method"], string> = {
  equal: "Equal Split",
  exact: "Exact Amount",
  percentage: "Percentage",
  shares: "Shares",
  itemwise: "Item-wise",
};

const TIPS: Record<number, { title: string; items: Array<[string, string]> }> = {
  1: {
    title: "How split works?",
    items: [
      ["Add total expense", "Enter amount, category, date and add a receipt (optional)."],
      ["Choose payer and participants", "Select who paid and who should split the expense."],
      ["Track partial settlements", "See who has paid, who owes and mark as settled."],
    ],
  },
  2: {
    title: "How it works?",
    items: [
      ["Choose payer(s)", "Select one person as the payer, or multiple people if the expense was paid by more than one person."],
      ["Match total amount", "The total paid by the selected payer(s) must equal the expense amount."],
      ["You can change later", "Don't worry, you can update payer details anytime before finalizing the expense."],
    ],
  },
  3: {
    title: "How it works?",
    items: [
      ["Select people or groups", "Choose the people or groups you want to split this expense with."],
      ["Add from contacts", "Search and add people from your contacts or create a group."],
      ["Review participants", "See the selected people on the right. You can remove anyone before continuing."],
    ],
  },
  4: {
    title: "Choosing a method",
    items: [
      ["Pick how to split", "Equal, exact amounts, percentages, shares or item-wise."],
      ["Check the breakdown", "Each person's share and status is previewed before you continue."],
      ["Tune payment options", "Allow partial payments and control notifications."],
    ],
  },
  5: {
    title: "How reminders work?",
    items: [
      ["Pick a due date", "Choose when everyone should settle their share."],
      ["Set reminder cadence", "Choose the first reminder and how often to repeat it."],
      ["Choose channels", "Notify via in-app, email or WhatsApp / SMS."],
    ],
  },
  6: {
    title: "Review tips",
    items: [
      ["Double-check amounts", "Make sure the total matches the receipt."],
      ["Confirm participants", "Everyone listed here will see this expense."],
      ["Create when ready", "You can still edit or settle the expense afterwards."],
    ],
  },
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0);
};
const fmtDate = (iso: string) =>
  iso
    ? fromIso(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
const fmtTime = (hhmm: string) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const hr = (h ?? 0) % 12 || 12;
  return `${hr}:${pad2(m ?? 0)} ${(h ?? 0) >= 12 ? "PM" : "AM"}`;
};
const shiftIso = (iso: string, days: number) => {
  const d = fromIso(iso);
  d.setDate(d.getDate() - days);
  return toIso(d);
};

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`sm-toggle ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

function QuickActions() {
  const go = (path: string) => window.location.assign(path);
  const actions: Array<[string, string, string, ReactNode, string]> = [
    ["Create Group", "For trips, home, friends etc.", "/split-money/groups", <FolderPlus key="a" size={18} />, "g"],
    ["Add Person", "Add friends or family", "/split-money/people", <UserPlus key="b" size={18} />, "p"],
    ["Import Receipt", "Scan and auto-fill details", "/split-money/import-receipt", <ReceiptText key="c" size={18} />, "r"],
    ["Split History", "View past splits and settlements", "/split-money/history", <History key="d" size={18} />, "h"],
  ];
  return (
    <section className="sm-rail-card">
      <h3>Quick Actions</h3>
      <p className="sm-rail-sub">Common tasks for Split Money</p>
      <div className="sm-quick-grid">
        {actions.map(([label, hint, path, icon, k]) => (
          <button key={k} type="button" onClick={() => go(path)}>
            <span className="sm-quick-icon">{icon}</span>
            <b>{label}</b>
            <small>{hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ step }: { step: number }) {
  const tip = TIPS[step]!;
  return (
    <section className="sm-rail-card">
      <h3>{tip.title}</h3>
      <p className="sm-rail-sub">Quick guide for this step.</p>
      <ol className="sm-tips">
        {tip.items.map(([t, d], i) => (
          <li key={t}>
            <span>{i + 1}</span>
            <div>
              <b>{t}</b>
              <small>{d}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MiniCalendar({
  month,
  onMonth,
  value,
  reminderIso,
  onPick,
}: {
  month: { y: number; m: number };
  onMonth: (next: { y: number; m: number }) => void;
  value: string;
  reminderIso: string;
  onPick: (iso: string) => void;
}) {
  const first = new Date(month.y, month.m, 1, 12);
  const lead = first.getDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(month.y, month.m, 1 - lead + i, 12);
    return { iso: toIso(d), day: d.getDate(), out: d.getMonth() !== month.m };
  });
  const todayIso = toIso(new Date());
  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1, 12);
    onMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  return (
    <div className="sm-cal">
      <div className="sm-cal-head">
        <b>{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b>
        <span>
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={15} />
          </button>
        </span>
      </div>
      <div className="sm-cal-grid">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <em key={d}>{d}</em>
        ))}
        {cells.map((c) => (
          <button
            key={c.iso}
            type="button"
            className={[
              c.out ? "out" : "",
              c.iso === value ? "sel" : "",
              c.iso === reminderIso && c.iso !== value ? "rem" : "",
              c.iso === todayIso ? "today" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onPick(c.iso)}
          >
            {c.day}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CreateSplitWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SplitWizardDraft>(() => loadDraft() ?? defaultDraft());
  const [doneId, setDoneId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // UI-only state (not persisted / not part of the API payload)
  const [peopleTab, setPeopleTab] = useState<"people" | "groups">("people");
  const [search, setSearch] = useState("");
  const [dueLater, setDueLater] = useState(false);
  const [previewTab, setPreviewTab] = useState<"in_app" | "email" | "whatsapp">("in_app");
  const [receipt, setReceipt] = useState<{ name: string; url: string | null } | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    return () => {
      if (receipt?.url) URL.revokeObjectURL(receipt.url);
    };
  }, [receipt]);

  useEffect(() => {
    if (!draft.dueDate) return;
    const d = fromIso(draft.dueDate);
    setCalMonth({ y: d.getFullYear(), m: d.getMonth() });
  }, [draft.dueDate]);

  const peopleQuery = useQuery({
    queryKey: ["split-people"],
    queryFn: () => splitMoneyService.listPeople(),
  });
  const groupsQuery = useQuery({
    queryKey: ["split-groups"],
    queryFn: () => splitMoneyService.listGroups(),
  });

  const people = peopleQuery.data ?? [];
  const self = people.find((p) => p.isSelf) ?? people[0];

  const update = (patch: Partial<SplitWizardDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  };

  // Keep self in the draft participant list so UI "Added" state and toggles stay in sync.
  useEffect(() => {
    if (!self?.id) return;
    if (draft.participantIds.includes(self.id)) return;
    if (draft.participantIds.length === 0) {
      update({ participantIds: [self.id] });
    }
  }, [self?.id, draft.participantIds]);

  const totalMinor = useMemo(() => {
    try {
      return majorStringToMinor(draft.amountMajor || "0");
    } catch {
      return 0;
    }
  }, [draft.amountMajor]);

  const participantIds =
    draft.participantIds.length > 0
      ? draft.participantIds
      : self
        ? [self.id]
        : [];

  const sharePreview = useMemo(() => {
    if (!participantIds.length || totalMinor <= 0) return [];
    try {
      if (draft.method === "equal") {
        return computeParticipantShares({
          totalAmountMinor: totalMinor,
          method: "equal",
          participants: participantIds.map((personId) => ({ personId })),
        });
      }
      if (draft.method === "exact") {
        return computeParticipantShares({
          totalAmountMinor: totalMinor,
          method: "exact",
          participants: participantIds.map((personId) => ({
            personId,
            shareAmountMinor: majorStringToMinor(draft.exactAmounts[personId] || "0"),
          })),
        });
      }
      if (draft.method === "percentage") {
        return computeParticipantShares({
          totalAmountMinor: totalMinor,
          method: "percentage",
          participants: participantIds.map((personId) => ({
            personId,
            sharePercentageBps: Math.round(Number(draft.percentages[personId] || "0") * 100),
          })),
        });
      }
      if (draft.method === "shares") {
        return computeParticipantShares({
          totalAmountMinor: totalMinor,
          method: "shares",
          participants: participantIds.map((personId) => ({
            personId,
            shareValue: Math.max(1, Number(draft.shares[personId] || "1")),
          })),
        });
      }
      return computeParticipantShares({
        totalAmountMinor: totalMinor,
        method: "itemwise",
        participants: participantIds.map((personId) => ({ personId })),
        items: draft.items.map((item) => ({
          name: item.name || "Item",
          quantity: item.quantity || 1,
          priceMinor: majorStringToMinor(item.priceMajor || "0"),
          kind: item.kind,
          personIds: item.personIds.length ? item.personIds : participantIds,
        })),
      });
    } catch {
      return participantIds.map((personId) => ({
        personId,
        sharePercentageBps: 0,
        shareValue: 1,
        shareAmountMinor: 0,
      }));
    }
  }, [draft, participantIds, totalMinor]);

  const createMutation = useMutation({
    mutationFn: (isDraft: boolean) => {
      if (!self) throw new Error("Load people first");
      const payers =
        draft.payerMode === "single"
          ? [
              {
                personId: draft.payerIds[0] || self.id,
                paidAmountMinor: totalMinor,
              },
            ]
          : draft.payerIds.map((id) => ({
              personId: id,
              paidAmountMinor: majorStringToMinor(draft.payerAmounts[id] || "0"),
            }));

      return splitMoneyService.createExpense({
        title: draft.title.trim(),
        description: draft.description || null,
        category: draft.category,
        totalAmountMinor: totalMinor,
        currency: "INR",
        expenseDate: draft.expenseDate,
        expenseTime: draft.expenseTime || null,
        groupId: draft.groupId || null,
        splitMethod: draft.method,
        dueDate: draft.dueDate || null,
        noteForParticipants: draft.noteForParticipants || null,
        allowPartialPayments: draft.allowPartialPayments,
        sendNotifications: draft.sendNotifications,
        isDraft,
        payers,
        participants: sharePreview.map((s) => ({
          personId: s.personId,
          sharePercentageBps: s.sharePercentageBps,
          shareValue: s.shareValue,
          shareAmountMinor: s.shareAmountMinor,
        })),
        items:
          draft.method === "itemwise"
            ? draft.items.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                priceMinor: majorStringToMinor(item.priceMajor || "0"),
                kind: item.kind,
                personIds: item.personIds.length ? item.personIds : participantIds,
              }))
            : undefined,
        reminder: draft.remindersEnabled
          ? {
              enabled: true,
              channels: draft.reminderChannels,
              firstReminderDaysBefore: draft.firstReminderDays,
              frequencyDays: draft.frequencyDays,
              recurring: draft.recurring,
              stopAfterSettlement: draft.stopAfterSettlement,
              message: draft.reminderMessage || null,
            }
          : { enabled: false },
      });
    },
    onSuccess: (expense, isDraft) => {
      clearDraft();
      void qc.invalidateQueries({ queryKey: ["split-money"] });
      void qc.invalidateQueries({ queryKey: ["split-expenses"] });
      if (isDraft) {
        toast.success("Draft saved");
        onClose();
        return;
      }
      toast.success("Split expense created successfully.");
      setDoneId(expense.id);
    },
    onError: (error: Error) => toast.error(error.message || "Could not create expense"),
  });

  const validateStep = (step: number) => {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!draft.title.trim()) next.title = "Title is required";
      if (totalMinor <= 0) next.amount = "Amount must be greater than 0";
      if (!draft.category) next.category = "Category is required";
      if (!draft.expenseDate) next.date = "Date is required";
    }
    if (step === 2) {
      if (draft.payerMode === "single" && !(draft.payerIds[0] || self?.id)) {
        next.payer = "Select a payer";
      }
      if (draft.payerMode === "multiple") {
        const sum = draft.payerIds.reduce(
          (s, id) => s + majorStringToMinor(draft.payerAmounts[id] || "0"),
          0,
        );
        if (sum !== totalMinor) next.payer = "Payer amounts must equal the expense total";
      }
    }
    if (step === 3 && participantIds.length < 1) next.people = "Select at least one person";
    if (step === 4) {
      try {
        if (draft.method === "exact") {
          const amounts = participantIds.map((id) =>
            majorStringToMinor(draft.exactAmounts[id] || "0"),
          );
          if (!allocateExact(amounts, totalMinor).ok) next.method = "Exact amounts must equal total";
        }
        if (draft.method === "percentage") {
          const bps = participantIds.map((id) =>
            Math.round(Number(draft.percentages[id] || "0") * 100),
          );
          allocateByPercentage(totalMinor, bps);
        }
        if (draft.method === "shares") {
          allocateByShares(
            totalMinor,
            participantIds.map((id) => Math.max(1, Number(draft.shares[id] || "1"))),
          );
        }
        if (draft.method === "itemwise" && draft.items.length === 0) {
          next.method = "Add at least one item";
        }
      } catch (error) {
        next.method = error instanceof Error ? error.message : "Invalid split";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(draft.step)) return;
    if (draft.step === 6) {
      createMutation.mutate(false);
      return;
    }
    if (draft.step === 2 && draft.payerMode === "single" && self && draft.payerIds.length === 0) {
      update({ payerIds: [self.id] });
    }
    if (draft.step === 3 && draft.participantIds.length === 0 && self) {
      update({ participantIds: [self.id] });
    }
    update({ step: draft.step + 1 });
  };

  if (doneId) {
    return (
      <main className="sm-page sm-success-page">
        <div className="sm-success">
          <span>
            <Check size={62} />
          </span>
          <p>Split expense created</p>
          <h1>Expense Created Successfully!</h1>
          <small>Everyone has been notified and their balances are ready to settle.</small>
          <button className="sm-primary" type="button" onClick={() => onCreated(doneId)}>
            View Expense <ArrowRight size={17} />
          </button>
          <button
            className="sm-outline"
            type="button"
            onClick={() => {
              setDoneId(null);
              setDraft(defaultDraft());
              clearDraft();
            }}
          >
            Create Another Expense
          </button>
        </div>
      </main>
    );
  }

  const each =
    participantIds.length && totalMinor
      ? allocateEqual(totalMinor, participantIds.length)[0]!
      : 0;

  // ---- derived UI values (no hooks below this line) ----
  const safeMinor = (v: string | undefined) => {
    try {
      return majorStringToMinor(v || "0");
    } catch {
      return 0;
    }
  };
  const groups = groupsQuery.data ?? [];
  const payerId = draft.payerIds[0] || self?.id;
  const payer = people.find((p) => p.id === payerId);
  const selectedGroup = groups.find((g) => g.id === draft.groupId);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.fullName ?? "—";
  const toneOf = (id: string) => avatarTone(Math.max(0, people.findIndex((p) => p.id === id)));
  const selectedPeople = participantIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const dateTimeLabel = `${fmtDate(draft.expenseDate)}${draft.expenseTime ? ` · ${fmtTime(draft.expenseTime)}` : ""}`;
  const q = search.trim().toLowerCase();
  const filteredPeople = q
    ? people.filter((p) =>
        [p.fullName, p.email ?? "", p.phone ?? ""].some((v) => v.toLowerCase().includes(q)),
      )
    : people;
  const filteredGroups = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  const recentContacts = people.filter((p) => !p.isSelf).slice(0, 4);

  const payerPaid = (id: string) =>
    draft.payerMode === "single"
      ? id === payerId
        ? totalMinor
        : 0
      : draft.payerIds.includes(id)
        ? safeMinor(draft.payerAmounts[id])
        : 0;
  const payerRowIds = [
    ...new Set([...(payerId ? [payerId] : []), ...draft.payerIds, ...participantIds]),
  ];
  const paidTotal = payerRowIds.reduce((s, id) => s + payerPaid(id), 0);
  const payerCount =
    draft.payerMode === "single" ? (payerId ? 1 : 0) : draft.payerIds.length;

  const reminderIso = draft.dueDate ? shiftIso(draft.dueDate, draft.firstReminderDays) : "";
  const reminderMsg =
    draft.reminderMessage ||
    `Hi! Just a quick reminder to settle your share for ${draft.title || "this expense"} (${money(each)}) by ${fmtDate(draft.dueDate)}. Thanks!`;

  const toggleParticipant = (id: string) => {
    const current =
      draft.participantIds.length > 0 ? draft.participantIds : self ? [self.id] : [];
    update({
      participantIds: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...new Set([...current, id])],
    });
  };

  const pickGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const members = group?.members?.map((m) => m.personId) ?? [];
    const next = [...new Set([...(self ? [self.id] : []), ...members])];
    update({ groupId, participantIds: next.length ? next : draft.participantIds });
  };

  const methodTiles: Array<[SplitWizardDraft["method"], string, string, ReactNode]> = [
    ["equal", "Equal Split", "Split equally among all people", <Users key="u" size={20} />],
    ["exact", "Exact Amount", "Set exact amount for each person", <IndianRupee key="r" size={20} />],
    ["percentage", "Percentage", "Split by percentage (e.g. 50%, 30%, 20%)", <Percent key="p" size={20} />],
    ["shares", "Shares", "Split by custom shares (e.g. 2:1:1)", <CircleDollarSign key="c" size={20} />],
    ["itemwise", "Item-wise", "Split different items for different people", <ReceiptText key="i" size={20} />],
  ];

  const checklist: Array<[string, string, boolean]> = [
    ["Total amount matches expense amount", money(totalMinor), totalMinor > 0],
    [
      `All participants selected (${participantIds.length} ${participantIds.length === 1 ? "person" : "people"})`,
      `${participantIds.length}/${participantIds.length}`,
      participantIds.length > 0,
    ],
    ["Split method confirmed", METHOD_LABELS[draft.method], true],
    [
      "Due date configured",
      draft.dueDate ? fmtDate(draft.dueDate) : "Not set",
      !!draft.dueDate,
    ],
    ["Reminders enabled", draft.remindersEnabled ? "Yes" : "No", draft.remindersEnabled],
  ];

  const nextLabel = STEPS[draft.step]?.[0] ?? "Review";

  const railSummary = (
    <section className="sm-rail-card">
      <header className="sm-rail-card-head">
        <h3>Expense Summary</h3>
        <button type="button" className="sm-mini-btn" onClick={() => update({ step: 1 })}>
          Edit
        </button>
      </header>
      <p className="sm-rail-sub">Details from the previous steps.</p>
      <div className="sm-summary-title">
        <span className="sm-exp-icon food">
          <ReceiptText size={18} />
        </span>
        <div>
          <b>{draft.title || "Untitled expense"}</b>
          <small>{dateTimeLabel}</small>
        </div>
      </div>
      <dl className="sm-rail-dl">
        <dt>Category</dt>
        <dd>{draft.category}</dd>
        <dt>Group</dt>
        <dd>{selectedGroup?.name ?? "No group"}</dd>
        <dt>Total amount</dt>
        <dd className="strong">{money(totalMinor)}</dd>
      </dl>
    </section>
  );

  return (
    <main className="sm-page sm-create sm-neon-create">
      <header className="sm-create-head">
        <button className="sm-back-title" type="button" onClick={onClose}>
          <ArrowLeft size={18} /> Split Money
        </button>
      </header>

      <section className="sm-create-hero">
        <div className="sm-create-hero-top">
          <div className="sm-wizard-title">
            <h1>Create Split Expense</h1>
            <p>Add a shared expense, define who paid, and track settlements automatically.</p>
          </div>
          <div className="sm-create-hero-actions">
            <button
              className="sm-outline"
              type="button"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!validateStep(1)) return;
                createMutation.mutate(true);
              }}
            >
              <ReceiptText size={16} /> Save Draft
            </button>
            {draft.step < 6 && (
              <button
                className="sm-primary"
                type="button"
                disabled={createMutation.isPending}
                onClick={goNext}
              >
                Continue <ArrowRight size={17} />
              </button>
            )}
          </div>
        </div>

        <nav className="sm-stepper" aria-label="Create split steps">
          {STEPS.map(([label, hint], i) => {
            const n = i + 1;
            return (
              <button
                key={label}
                type="button"
                className={draft.step === n ? "current" : draft.step > n ? "done" : ""}
                aria-current={draft.step === n ? "step" : undefined}
                onClick={() => n < draft.step && update({ step: n })}
              >
                <span>{draft.step > n ? <Check size={14} /> : n}</span>
                <b>{label}</b>
                <small>{hint}</small>
              </button>
            );
          })}
        </nav>
      </section>

      <div className="sm-wizard-layout">
        <div className="sm-wizard-main">
          <section className="sm-form-card">
            {/* ───────────── STEP 1 ───────────── */}
            {draft.step === 1 && (
              <>
                <Head
                  h="Expense Details"
                  p="Tell us about this expense. You can add more details, upload a receipt and choose a group."
                />
                <div className="sm-fields">
                  <label>
                    Expense title *
                    <input
                      value={draft.title}
                      onChange={(e) => update({ title: e.target.value })}
                      aria-invalid={!!errors.title}
                    />
                    {errors.title && <small className="danger">{errors.title}</small>}
                  </label>
                  <label>
                    Total amount *
                    <div className="sm-input-icon">
                      <IndianRupee size={16} />
                      <input
                        value={draft.amountMajor}
                        onChange={(e) =>
                          update({ amountMajor: e.target.value.replace(/[^0-9.,]/g, "") })
                        }
                      />
                    </div>
                    {errors.amount && <small className="danger">{errors.amount}</small>}
                  </label>
                  <label>
                    Category *
                    <select
                      value={draft.category}
                      onChange={(e) => update({ category: e.target.value })}
                    >
                      {[
                        "Food & Dining",
                        "Travel",
                        "Shopping",
                        "Bills & Utilities",
                        "Entertainment",
                        "Others",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    {errors.category && <small className="danger">{errors.category}</small>}
                  </label>
                  <div className="sm-field-pair">
                    <label>
                      Date *
                      <input
                        type="date"
                        value={draft.expenseDate}
                        onChange={(e) => update({ expenseDate: e.target.value })}
                      />
                      {errors.date && <small className="danger">{errors.date}</small>}
                    </label>
                    <label>
                      Time
                      <input
                        type="time"
                        value={draft.expenseTime}
                        onChange={(e) => update({ expenseTime: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="wide">
                    Group (optional)
                    <div className="sm-group-field">
                      <select
                        value={draft.groupId}
                        onChange={(e) => {
                          const groupId = e.target.value;
                          const group = groups.find((g) => g.id === groupId);
                          update({
                            groupId,
                            participantIds:
                              group?.members?.map((m) => m.personId) ?? draft.participantIds,
                          });
                        }}
                      >
                        <option value="">No group</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      {selectedGroup?.members && selectedGroup.members.length > 0 && (
                        <span className="sm-avatar-stack">
                          {selectedGroup.members.slice(0, 3).map((m, i) => (
                            <Avatar
                              key={m.id}
                              name={m.person?.fullName ?? "?"}
                              tone={avatarTone(i)}
                              small
                            />
                          ))}
                          {selectedGroup.members.length > 3 && (
                            <em>+{selectedGroup.members.length - 3}</em>
                          )}
                        </span>
                      )}
                    </div>
                  </label>
                  <label className="wide">
                    Description (optional)
                    <textarea
                      maxLength={200}
                      value={draft.description}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                    <small className="sm-counter">{draft.description.length}/200</small>
                  </label>
                  <div className="wide sm-receipt-field">
                    <span className="sm-field-label">Receipt (optional)</span>
                    <small className="sm-rail-sub">Add a receipt to keep track of this expense.</small>
                    <div className="sm-receipt-row">
                      {receipt && (
                        <div className="sm-receipt-thumb">
                          {receipt.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={receipt.url} alt={receipt.name} />
                          ) : (
                            <FileText size={26} />
                          )}
                          <button
                            type="button"
                            aria-label="Remove receipt"
                            onClick={() => setReceipt(null)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                      <label className="sm-upload sm-upload-drop">
                        <Upload size={20} />
                        <span>
                          <b>{receipt ? receipt.name : "Upload receipt"}</b>
                          <small>Drag &amp; drop or click to upload</small>
                          <small>JPG, PNG or PDF (max 10MB)</small>
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error("Receipt must be 10MB or smaller");
                              return;
                            }
                            setReceipt({
                              name: file.name,
                              url: file.type.startsWith("image/")
                                ? URL.createObjectURL(file)
                                : null,
                            });
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ───────────── STEP 2 ───────────── */}
            {draft.step === 2 && (
              <>
                <Head
                  h="Who Paid?"
                  p="Select who paid for this expense. You can choose a single payer or multiple payers."
                />
                <h3 className="sm-small-heading first">Payer mode</h3>
                <div className="sm-mode sm-mode-cards">
                  <button
                    type="button"
                    className={draft.payerMode === "single" ? "active" : ""}
                    onClick={() => update({ payerMode: "single" })}
                  >
                    <Users size={19} />
                    <span>
                      <b>Single payer</b>
                      <small>One person paid the full amount</small>
                    </span>
                    <i className="sm-radio" />
                  </button>
                  <button
                    type="button"
                    className={draft.payerMode === "multiple" ? "active" : ""}
                    onClick={() => update({ payerMode: "multiple" })}
                  >
                    <HandCoins size={19} />
                    <span>
                      <b>Multiple payers</b>
                      <small>Split payment between multiple people</small>
                    </span>
                    <i className="sm-radio" />
                  </button>
                </div>

                <h3 className="sm-small-heading">Total amount for this expense</h3>
                <div className="sm-amount-lock">
                  <IndianRupee size={16} />
                  <b>{draft.amountMajor || "0"}</b>
                  <span>
                    <Info size={13} /> This is the total amount from Step 1
                  </span>
                </div>

                <h3 className="sm-small-heading">
                  {draft.payerMode === "single" ? "Select the person who paid" : "Select the people who paid"}
                </h3>
                <div className="sm-people-grid sm-people-avatar-grid">
                  {people.map((p, i) => {
                    const selected =
                      draft.payerIds.includes(p.id) ||
                      (draft.payerMode === "single" && draft.payerIds.length === 0 && p.isSelf);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={selected ? "selected" : ""}
                        onClick={() => {
                          if (draft.payerMode === "single") update({ payerIds: [p.id] });
                          else {
                            const on = draft.payerIds.includes(p.id);
                            update({
                              payerIds: on
                                ? draft.payerIds.filter((id) => id !== p.id)
                                : [...draft.payerIds, p.id],
                            });
                          }
                        }}
                      >
                        <Avatar name={p.fullName} tone={avatarTone(i)} />
                        <b>
                          {p.fullName}
                          {p.isSelf ? " (You)" : ""}
                        </b>
                        <i className="sm-check-dot">{selected && <Check size={12} />}</i>
                      </button>
                    );
                  })}
                </div>

                {draft.payerMode === "multiple" && draft.payerIds.length > 0 && (
                  <div className="sm-fields" style={{ marginTop: 16 }}>
                    {draft.payerIds.map((id) => {
                      const person = people.find((p) => p.id === id);
                      return (
                        <label key={id}>
                          {person?.fullName ?? "Payer"}
                          <div className="sm-input-icon">
                            <IndianRupee size={16} />
                            <input
                              value={draft.payerAmounts[id] ?? ""}
                              onChange={(e) =>
                                update({
                                  payerAmounts: {
                                    ...draft.payerAmounts,
                                    [id]: e.target.value.replace(/[^0-9.]/g, ""),
                                  },
                                })
                              }
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {errors.payer && <div className="sm-callout danger">{errors.payer}</div>}
                <div className="sm-callout sm-callout-ok">
                  <span className="sm-callout-icon">
                    <Check size={14} />
                  </span>
                  <div>
                    <b>
                      {draft.payerMode === "single"
                        ? `${payer?.fullName ?? "Payer"}${payer?.isSelf ? " (You)" : ""} will be marked as the payer for the full amount.`
                        : "Multiple payers — amounts must sum to the expense total."}
                    </b>
                    <small>You can change this later if needed.</small>
                  </div>
                </div>

                <h3 className="sm-small-heading">Payment Preview</h3>
                <p className="sm-rail-sub">Here&apos;s how the payment looks so far for this expense.</p>
                <div className="sm-tiles">
                  <div>
                    <span className="sm-tile-icon">
                      <IndianRupee size={16} />
                    </span>
                    <small>Total expense</small>
                    <b>{money(totalMinor)}</b>
                  </div>
                  <div>
                    <span className="sm-tile-icon">
                      <Users size={16} />
                    </span>
                    <small>Paid by</small>
                    <b>
                      {payerCount} {payerCount === 1 ? "person" : "people"}
                    </b>
                  </div>
                  <div>
                    <span className="sm-tile-icon">
                      <CircleDollarSign size={16} />
                    </span>
                    <small>Remaining to split</small>
                    <b>
                      {money(
                        draft.payerMode === "single" ? totalMinor : Math.max(0, totalMinor - paidTotal),
                      )}
                    </b>
                  </div>
                  <div>
                    <span className="sm-tile-icon">
                      <Users size={16} />
                    </span>
                    <small>Participants</small>
                    <b>{participantIds.length}</b>
                  </div>
                </div>
              </>
            )}

            {/* ───────────── STEP 3 ───────────── */}
            {draft.step === 3 && (
              <>
                <Head
                  h="Split With"
                  p="Select the people or groups to split this expense with."
                />
                <div className="sm-tabs-pill" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={peopleTab === "people"}
                    className={peopleTab === "people" ? "active" : ""}
                    onClick={() => setPeopleTab("people")}
                  >
                    <Users size={15} /> People
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={peopleTab === "groups"}
                    className={peopleTab === "groups" ? "active" : ""}
                    onClick={() => setPeopleTab("groups")}
                  >
                    <FolderPlus size={15} /> Groups
                  </button>
                </div>
                <label className="sm-people-search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      peopleTab === "people"
                        ? "Search people by name, phone or email..."
                        : "Search groups by name..."
                    }
                  />
                  {search && (
                    <button
                      type="button"
                      className="sm-clear-x"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                {peopleTab === "people" ? (
                  <>
                    {recentContacts.length > 0 && (
                      <>
                        <h3 className="sm-small-heading">Recent Contacts</h3>
                        <div className="sm-recent">
                          {recentContacts.map((p, i) => (
                            <button
                              key={p.id}
                              type="button"
                              className={participantIds.includes(p.id) ? "on" : ""}
                              onClick={() => toggleParticipant(p.id)}
                            >
                              <Avatar name={p.fullName} tone={avatarTone(i + 1)} small />
                              {p.fullName.split(" ")[0]}
                              {participantIds.includes(p.id) ? <Check size={12} /> : <Plus size={12} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <h3 className="sm-small-heading">All People</h3>
                    <div className="sm-contact-list">
                      {filteredPeople.length === 0 && (
                        <p className="sm-empty-row">No people match your search.</p>
                      )}
                      {filteredPeople.map((p) => {
                        const on = participantIds.includes(p.id);
                        const idx = people.findIndex((x) => x.id === p.id);
                        return (
                          <button key={p.id} type="button" onClick={() => toggleParticipant(p.id)}>
                            <Avatar name={p.fullName} tone={avatarTone(idx)} />
                            <div>
                              <b>
                                {p.fullName}
                                {p.isSelf ? " (You)" : ""}
                              </b>
                            </div>
                            <small className="sm-contact-meta">
                              {p.email || "—"} · {p.phone || "—"}
                            </small>
                            <span className={on ? "checked" : ""}>
                              {on ? <Check size={14} /> : <Plus size={14} />} {on ? "Added" : "Add"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="sm-small-heading">Your Groups</h3>
                    <div className="sm-contact-list">
                      {filteredGroups.length === 0 && (
                        <p className="sm-empty-row">No groups found. Create one from Quick Actions.</p>
                      )}
                      {filteredGroups.map((g, i) => {
                        const on = draft.groupId === g.id;
                        return (
                          <button key={g.id} type="button" onClick={() => pickGroup(g.id)}>
                            <Avatar name={g.name} tone={avatarTone(i)} />
                            <div>
                              <b>{g.name}</b>
                            </div>
                            <small className="sm-contact-meta">
                              {g.members?.length ?? 0} members
                            </small>
                            <span className={on ? "checked" : ""}>
                              {on ? <Check size={14} /> : <Plus size={14} />} {on ? "Selected" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {errors.people && <p className="danger">{errors.people}</p>}
              </>
            )}

            {/* ───────────── STEP 4 ───────────── */}
            {draft.step === 4 && (
              <>
                <Head
                  h="How do you want to split this expense?"
                  p="Choose a split method that works best for your group."
                />
                <div className="sm-methods">
                  {methodTiles.map(([key, label, hint, icon]) => (
                    <button
                      key={key}
                      type="button"
                      className={draft.method === key ? "active" : ""}
                      onClick={() => update({ method: key })}
                    >
                      <i className="sm-radio" />
                      <span className="sm-method-icon">{icon}</span>
                      <b>{label}</b>
                      <small>{hint}</small>
                    </button>
                  ))}
                </div>

                {draft.method === "exact" && (
                  <div className="sm-fields" style={{ marginTop: 16 }}>
                    {participantIds.map((id) => (
                      <label key={id}>
                        {nameOf(id)}
                        <input
                          value={draft.exactAmounts[id] ?? ""}
                          onChange={(e) =>
                            update({
                              exactAmounts: {
                                ...draft.exactAmounts,
                                [id]: e.target.value.replace(/[^0-9.]/g, ""),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                    <p>
                      Remaining:{" "}
                      {money(
                        allocateExact(
                          participantIds.map((id) =>
                            majorStringToMinor(draft.exactAmounts[id] || "0"),
                          ),
                          totalMinor,
                        ).remainingMinor,
                      )}
                    </p>
                  </div>
                )}

                {draft.method === "percentage" && (
                  <div className="sm-fields" style={{ marginTop: 16 }}>
                    {participantIds.map((id) => (
                      <label key={id}>
                        {nameOf(id)} (%)
                        <input
                          value={draft.percentages[id] ?? ""}
                          onChange={(e) =>
                            update({
                              percentages: {
                                ...draft.percentages,
                                [id]: e.target.value.replace(/[^0-9.]/g, ""),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}

                {draft.method === "shares" && (
                  <div className="sm-fields" style={{ marginTop: 16 }}>
                    {participantIds.map((id) => (
                      <label key={id}>
                        {nameOf(id)} (shares)
                        <input
                          value={draft.shares[id] ?? "1"}
                          onChange={(e) =>
                            update({
                              shares: {
                                ...draft.shares,
                                [id]: e.target.value.replace(/[^0-9]/g, ""),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}

                {draft.method === "itemwise" && (
                  <div style={{ marginTop: 16 }}>
                    {draft.items.map((item, idx) => (
                      <div className="sm-fields" key={idx} style={{ marginBottom: 12 }}>
                        <label>
                          Item
                          <input
                            value={item.name}
                            onChange={(e) => {
                              const items = [...draft.items];
                              items[idx] = { ...item, name: e.target.value };
                              update({ items });
                            }}
                          />
                        </label>
                        <label>
                          Price
                          <input
                            value={item.priceMajor}
                            onChange={(e) => {
                              const items = [...draft.items];
                              items[idx] = {
                                ...item,
                                priceMajor: e.target.value.replace(/[^0-9.]/g, ""),
                              };
                              update({ items });
                            }}
                          />
                        </label>
                        <label>
                          Kind
                          <select
                            value={item.kind}
                            onChange={(e) => {
                              const items = [...draft.items];
                              items[idx] = {
                                ...item,
                                kind: e.target.value as "item" | "tax" | "tip",
                              };
                              update({ items });
                            }}
                          >
                            <option value="item">Item</option>
                            <option value="tax">Tax</option>
                            <option value="tip">Tip</option>
                          </select>
                        </label>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="sm-outline"
                      onClick={() =>
                        update({
                          items: [
                            ...draft.items,
                            {
                              name: "",
                              quantity: 1,
                              priceMajor: "",
                              kind: "item",
                              personIds: [...participantIds],
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={16} /> Add item
                    </button>
                  </div>
                )}

                {errors.method && <p className="danger">{errors.method}</p>}

                <div className="sm-breakdown sm-breakdown-neon">
                  <h3>Participant Breakdown</h3>
                  <p className="sm-rail-sub">Here&apos;s how the expense will be split among the selected people.</p>
                  <div className="sm-breakdown-head">
                    <span>Person</span>
                    <span>Share</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>
                  {sharePreview.map((s) => {
                    const isPayer = payerId === s.personId;
                    return (
                      <div key={s.personId} className="sm-breakdown-row">
                        <span className="sm-bd-person">
                          <Avatar name={nameOf(s.personId)} tone={toneOf(s.personId)} small />
                          <span>
                            <b>
                              {nameOf(s.personId)}
                              {self?.id === s.personId ? " (You)" : ""}
                            </b>
                            <small>{isPayer ? "Paid the full amount" : "Owes you this amount"}</small>
                          </span>
                        </span>
                        <span>{(s.sharePercentageBps / 100).toFixed(0)}%</span>
                        <strong>{money(s.shareAmountMinor)}</strong>
                        <em className={isPayer ? "paid" : "owes"}>
                          {isPayer ? <Check size={11} /> : <Clock size={11} />}
                          {isPayer ? "Paid" : "Owes you"}
                        </em>
                      </div>
                    );
                  })}
                </div>
                {payer && totalMinor > 0 && participantIds.length > 1 && (
                  <div className="sm-callout sm-callout-info">
                    <Info size={15} />
                    <div>
                      {payer.fullName} paid the full amount of {money(totalMinor)}. The other{" "}
                      {participantIds.length - 1}{" "}
                      {participantIds.length - 1 === 1 ? "person owes" : "people owe"} their share to{" "}
                      {payer.fullName.split(" ")[0]}.
                    </div>
                  </div>
                )}

                <label className="sm-message">
                  Add a message (optional)
                  <textarea
                    maxLength={200}
                    value={draft.noteForParticipants}
                    onChange={(e) => update({ noteForParticipants: e.target.value })}
                  />
                  <small className="sm-counter">{draft.noteForParticipants.length}/200</small>
                </label>
              </>
            )}

            {/* ───────────── STEP 5 ───────────── */}
            {draft.step === 5 && (
              <>
                <Head
                  h="Due Date & Reminder"
                  p="Set a due date for this expense and configure reminders to get paid on time."
                />
                <div className="sm-due-grid">
                  <div className="sm-due-left">
                    <span className="sm-field-label">Settlement Due Date</span>
                    <small className="sm-rail-sub">When should everyone settle their share?</small>
                    <label className="sm-date-input">
                      <CalendarDays size={16} />
                      <input
                        type="date"
                        value={draft.dueDate}
                        onChange={(e) => {
                          setDueLater(false);
                          update({ dueDate: e.target.value });
                        }}
                      />
                    </label>
                    <MiniCalendar
                      month={calMonth}
                      onMonth={setCalMonth}
                      value={draft.dueDate}
                      reminderIso={draft.remindersEnabled ? reminderIso : ""}
                      onPick={(iso) => {
                        setDueLater(false);
                        update({ dueDate: iso });
                      }}
                    />
                    {dueLater && (
                      <p className="sm-rail-sub">Due date will be set later — pick a date to override.</p>
                    )}
                  </div>
                  <div className="sm-due-right">
                    <span className="sm-field-label">Reminder Settings</span>
                    <small className="sm-rail-sub">Choose when and how to remind participants.</small>
                    <div className="sm-setting-list sm-setting-neon">
                      <div className="sm-setting-row">
                        <Bell size={17} />
                        <div>
                          <b>Send payment reminders</b>
                          <small>We&apos;ll remind pending participants automatically.</small>
                        </div>
                        <Toggle
                          on={draft.remindersEnabled}
                          label="Send payment reminders"
                          onChange={(v) => update({ remindersEnabled: v })}
                        />
                      </div>
                      <div className="sm-setting-row">
                        <CalendarDays size={17} />
                        <div>
                          <b>First reminder</b>
                          <select
                            value={draft.firstReminderDays}
                            onChange={(e) => update({ firstReminderDays: Number(e.target.value) })}
                          >
                            <option value={1}>1 day before due date</option>
                            <option value={2}>2 days before due date</option>
                            <option value={3}>3 days before due date</option>
                            <option value={7}>7 days before due date</option>
                          </select>
                        </div>
                      </div>
                      <div className="sm-setting-row">
                        <Repeat size={17} />
                        <div>
                          <b>Reminder frequency</b>
                          <select
                            value={draft.frequencyDays}
                            onChange={(e) => update({ frequencyDays: Number(e.target.value) })}
                          >
                            <option value={1}>Every day</option>
                            <option value={2}>Every 2 days</option>
                            <option value={3}>Every 3 days</option>
                            <option value={7}>Every week</option>
                          </select>
                        </div>
                      </div>
                      <div className="sm-setting-row">
                        <Repeat size={17} />
                        <div>
                          <b>Recurring reminders</b>
                          <small>Keep sending reminders until the expense is settled.</small>
                        </div>
                        <Toggle
                          on={draft.recurring}
                          label="Recurring reminders"
                          onChange={(v) => update({ recurring: v })}
                        />
                      </div>
                      <div className="sm-setting-row">
                        <Check size={17} />
                        <div>
                          <b>Stop reminder after settlement</b>
                          <small>Automatically stop reminders once all payments are received.</small>
                        </div>
                        <Toggle
                          on={draft.stopAfterSettlement}
                          label="Stop reminder after settlement"
                          onChange={(v) => update({ stopAfterSettlement: v })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="sm-small-heading">Reminder channels</h3>
                <p className="sm-rail-sub">Choose how participants should be notified.</p>
                <div className="sm-channels">
                  {(
                    [
                      ["in_app", "In-app notification", "Send in Hisaab app", <Bell key="b" size={18} />],
                      ["email", "Email", "Send via email", <Mail key="m" size={18} />],
                      ["whatsapp", "WhatsApp / SMS", "Send via WhatsApp", <MessageCircle key="w" size={18} />],
                    ] as const
                  ).map(([key, label, hint, icon]) => {
                    const on = draft.reminderChannels.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={on ? "active" : ""}
                        onClick={() =>
                          update({
                            reminderChannels: on
                              ? draft.reminderChannels.filter((c) => c !== key)
                              : [...draft.reminderChannels, key],
                          })
                        }
                      >
                        <span className="sm-channel-icon">{icon}</span>
                        <span>
                          <b>{label}</b>
                          <small>{hint}</small>
                        </span>
                        <i className="sm-check-dot">{on && <Check size={12} />}</i>
                      </button>
                    );
                  })}
                </div>

                <div className="sm-due-bottom">
                  <label className="sm-message">
                    Reminder message (optional)
                    <textarea
                      maxLength={200}
                      value={draft.reminderMessage}
                      onChange={(e) => update({ reminderMessage: e.target.value })}
                      placeholder={`Hi! Just a quick reminder to settle your share for ${draft.title || "this expense"}.`}
                    />
                    <small className="sm-counter">{draft.reminderMessage.length}/200</small>
                  </label>
                  <div className="sm-notif-preview">
                    <h3>Notification Preview</h3>
                    <p className="sm-rail-sub">Here&apos;s how the reminder will look.</p>
                    <div className="sm-tabs-pill compact">
                      {(
                        [
                          ["in_app", "In-app"],
                          ["email", "Email"],
                          ["whatsapp", "WhatsApp"],
                        ] as const
                      ).map(([k, l]) => (
                        <button
                          key={k}
                          type="button"
                          className={previewTab === k ? "active" : ""}
                          onClick={() => setPreviewTab(k)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className={`sm-notif-card ${previewTab}`}>
                      <span className="sm-notif-logo">
                        {previewTab === "email" ? (
                          <Mail size={16} />
                        ) : previewTab === "whatsapp" ? (
                          <MessageCircle size={16} />
                        ) : (
                          <IndianRupee size={16} />
                        )}
                      </span>
                      <div>
                        <header>
                          <b>{previewTab === "email" ? "Hisaab · Reminder" : "Hisaab"}</b>
                          <small>now</small>
                        </header>
                        <strong>Payment reminder</strong>
                        <p>{reminderMsg}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ───────────── STEP 6 ───────────── */}
            {draft.step === 6 && (
              <>
                <Head
                  h="Review Split Expense"
                  p="Please review all the details below before creating the split expense."
                />
                <section className="sm-review-block">
                  <header>
                    <h3>Expense Details</h3>
                    <button type="button" className="sm-mini-btn" onClick={() => update({ step: 1 })}>
                      Edit
                    </button>
                  </header>
                  <div className="sm-review-grid">
                    <div>
                      <span>Expense title</span>
                      <b>{draft.title || "—"}</b>
                    </div>
                    <div>
                      <span>Total amount</span>
                      <b>{money(totalMinor)}</b>
                    </div>
                    <div>
                      <span>Date &amp; time</span>
                      <b>{dateTimeLabel}</b>
                    </div>
                    <div>
                      <span>Category</span>
                      <b>{draft.category}</b>
                    </div>
                    <div>
                      <span>Paid by</span>
                      <b className="with-avatar">
                        {payer && <Avatar name={payer.fullName} tone="me" small />}
                        {payer?.fullName ?? "—"}
                      </b>
                    </div>
                    <div>
                      <span>Due date</span>
                      <b>{fmtDate(draft.dueDate)}</b>
                    </div>
                    <div>
                      <span>Group</span>
                      <b>{selectedGroup?.name ?? "No group"}</b>
                    </div>
                    <div>
                      <span>Split method</span>
                      <b>{METHOD_LABELS[draft.method]}</b>
                    </div>
                    <div>
                      <span>Reminders</span>
                      <b>
                        {draft.remindersEnabled
                          ? `Enabled · every ${draft.frequencyDays} day${draft.frequencyDays === 1 ? "" : "s"}`
                          : "Disabled"}
                      </b>
                    </div>
                    <div>
                      <span>Description</span>
                      <b>{draft.description || "—"}</b>
                    </div>
                    <div>
                      <span>Participants</span>
                      <b>{participantIds.length} people</b>
                    </div>
                    <div>
                      <span>Note for participants</span>
                      <b>{draft.noteForParticipants || "—"}</b>
                    </div>
                  </div>
                </section>

                <section className="sm-review-block">
                  <header>
                    <h3>Participants ({participantIds.length})</h3>
                  </header>
                  <div className="sm-table">
                    <div className="sm-table-head">
                      <span>Person</span>
                      <span>Share %</span>
                      <span>Amount</span>
                      <span>Current status</span>
                      <span>Notification</span>
                    </div>
                    {sharePreview.map((s) => {
                      const isPayer = payerId === s.personId;
                      const willSend = !isPayer && draft.sendNotifications;
                      return (
                        <div key={s.personId} className="sm-table-row">
                          <span className="sm-bd-person">
                            <Avatar name={nameOf(s.personId)} tone={toneOf(s.personId)} small />
                            <b>
                              {nameOf(s.personId)}
                              {self?.id === s.personId ? " (You)" : ""}
                            </b>
                          </span>
                          <span>{(s.sharePercentageBps / 100).toFixed(0)}%</span>
                          <strong>{money(s.shareAmountMinor)}</strong>
                          <em className={isPayer ? "paid" : "owes"}>
                            {isPayer ? <Check size={11} /> : <Clock size={11} />}
                            {isPayer ? "Paid" : "Not paid yet"}
                          </em>
                          <span className={willSend ? "notify" : "notify off"}>
                            <Bell size={12} /> {willSend ? "Will send" : "Won't send"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </section>

          <footer className="sm-wizard-footer sm-wizard-footer-neon">
            <button
              className="sm-outline"
              type="button"
              onClick={() => (draft.step === 1 ? onClose() : update({ step: draft.step - 1 }))}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="sm-primary sm-primary-wide"
              type="button"
              disabled={createMutation.isPending}
              onClick={goNext}
            >
              {draft.step === 6 ? (
                <>
                  Create Split Expense <ArrowRight size={17} />
                </>
              ) : (
                <span className="sm-primary-stack">
                  <span>
                    Continue <ArrowRight size={16} />
                  </span>
                  <small>Go to {nextLabel}</small>
                </span>
              )}
            </button>
          </footer>
        </div>

        {/* ───────────── RIGHT RAIL ───────────── */}
        <aside className="sm-create-rail">
          <QuickActions />

          {draft.step === 1 && (
            <section className="sm-rail-card">
              <header className="sm-rail-card-head">
                <h3>Split Preview</h3>
                <span className="sm-chip">STEP 1 OF 6</span>
              </header>
              <p className="sm-rail-sub">Here&apos;s a quick preview of how this expense will be split.</p>
              <div className="sm-summary-title big">
                <span className="sm-exp-icon food">
                  <ReceiptText size={18} />
                </span>
                <div>
                  <b>{draft.title || "Untitled expense"}</b>
                  <small>{dateTimeLabel}</small>
                </div>
                <strong>{money(totalMinor)}</strong>
              </div>
              <dl className="sm-rail-dl">
                <dt>Total amount</dt>
                <dd>{money(totalMinor)}</dd>
                <dt>Payers</dt>
                <dd>{payerCount || 1}</dd>
                <dt>Participants</dt>
                <dd>{participantIds.length}</dd>
                <dt>Estimated share</dt>
                <dd className="strong">{money(each)} each</dd>
              </dl>
              <div className="sm-preview-note">
                <Info size={15} /> This is a preview. You can modify payers, participants and split
                method in the next steps.
              </div>
            </section>
          )}

          {draft.step === 2 && (
            <>
              {railSummary}
              <section className="sm-rail-card">
                <h3>Payer Summary</h3>
                <p className="sm-rail-sub">Here&apos;s who has paid for this expense so far.</p>
                <div className="sm-payer-list">
                  {payerRowIds.map((id) => {
                    const paid = payerPaid(id);
                    return (
                      <div key={id} className={paid > 0 ? "on" : ""}>
                        <Avatar name={nameOf(id)} tone={toneOf(id)} small />
                        <span>
                          <b>
                            {nameOf(id)}
                            {self?.id === id ? " (You)" : ""}
                          </b>
                          <small>{paid > 0 ? "Paid the full amount" : "Not paid yet"}</small>
                        </span>
                        <strong>{money(paid)}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {draft.step === 3 && (
            <>
              <section className="sm-rail-card">
                <header className="sm-rail-card-head">
                  <h3>Selected People ({selectedPeople.length})</h3>
                  <button
                    type="button"
                    className="sm-mini-btn"
                    onClick={() => update({ participantIds: self ? [self.id] : [] })}
                  >
                    Clear All
                  </button>
                </header>
                <p className="sm-rail-sub">These people will split this expense.</p>
                <div className="sm-selected-list">
                  {selectedPeople.map((p) => (
                    <div key={p.id}>
                      <Avatar name={p.fullName} tone={toneOf(p.id)} small />
                      <span>
                        <b>
                          {p.fullName}
                          {p.isSelf ? " (You)" : ""}
                        </b>
                        <small>{p.email || p.phone || "—"}</small>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${p.fullName}`}
                        onClick={() => toggleParticipant(p.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              {railSummary}
              <section className="sm-rail-card sm-split-type">
                <header className="sm-rail-card-head">
                  <h3>Split Type</h3>
                  <button type="button" className="sm-mini-btn" onClick={() => update({ step: 4 })}>
                    Edit
                  </button>
                </header>
                <div className="sm-summary-title">
                  <span className="sm-exp-icon food">
                    <Scale size={18} />
                  </span>
                  <div>
                    <b>{METHOD_LABELS[draft.method]}</b>
                    <small>
                      Amount will be divided among {participantIds.length}{" "}
                      {participantIds.length === 1 ? "person" : "people"}. You can change the split
                      method in the next step.
                    </small>
                  </div>
                </div>
              </section>
            </>
          )}

          {draft.step === 4 && (
            <>
              <section className="sm-rail-card">
                <header className="sm-rail-card-head">
                  <h3>Expense Preview</h3>
                  <span className="sm-chip">Step 4 of 6</span>
                </header>
                <p className="sm-rail-sub">Here&apos;s a summary of how this expense will be split.</p>
                <div className="sm-summary-title big">
                  <span className="sm-exp-icon food">
                    <ReceiptText size={18} />
                  </span>
                  <div>
                    <b>{draft.title || "Untitled expense"}</b>
                    <small>{dateTimeLabel}</small>
                  </div>
                  <strong>{money(totalMinor)}</strong>
                </div>
                <dl className="sm-rail-dl">
                  <dt>Category</dt>
                  <dd>{draft.category}</dd>
                  <dt>Group</dt>
                  <dd>{selectedGroup?.name ?? "No group"}</dd>
                  <dt>Split method</dt>
                  <dd>{METHOD_LABELS[draft.method]}</dd>
                  <dt>Total people</dt>
                  <dd>{participantIds.length}</dd>
                  <dt>Amount per person</dt>
                  <dd className="strong">
                    {draft.method === "equal" ? `${money(each)} each` : "Varies"}
                  </dd>
                </dl>
              </section>
              <section className="sm-rail-card">
                <h3>Payment Options</h3>
                <p className="sm-rail-sub">Configure additional settings for this split.</p>
                <div className="sm-option-list">
                  <div>
                    <Check size={15} />
                    <span>
                      <b>Allow partial payments</b>
                      <small>Let people pay in smaller amounts</small>
                    </span>
                    <Toggle
                      on={draft.allowPartialPayments}
                      label="Allow partial payments"
                      onChange={(v) => update({ allowPartialPayments: v })}
                    />
                  </div>
                  <div>
                    <Bell size={15} />
                    <span>
                      <b>Send payment notifications</b>
                      <small>Notify people about their share</small>
                    </span>
                    <Toggle
                      on={draft.sendNotifications}
                      label="Send payment notifications"
                      onChange={(v) => update({ sendNotifications: v })}
                    />
                  </div>
                  <div>
                    <CalendarDays size={15} />
                    <span>
                      <b>Set due date later</b>
                      <small>Add or edit due date in next step</small>
                    </span>
                    <Toggle
                      on={dueLater}
                      label="Set due date later"
                      onChange={(v) => {
                        setDueLater(v);
                        if (v) update({ dueDate: "" });
                      }}
                    />
                  </div>
                </div>
              </section>
            </>
          )}

          {draft.step === 5 && (
            <>
              <section className="sm-rail-card">
                <header className="sm-rail-card-head">
                  <h3>Expense Summary</h3>
                  <button type="button" className="sm-mini-btn" onClick={() => update({ step: 1 })}>
                    Edit
                  </button>
                </header>
                <div className="sm-summary-title">
                  <span className="sm-exp-icon food">
                    <ReceiptText size={18} />
                  </span>
                  <div>
                    <b>{draft.title || "Untitled expense"}</b>
                    <small>{dateTimeLabel}</small>
                  </div>
                </div>
                <dl className="sm-rail-dl">
                  <dt>Total amount</dt>
                  <dd className="strong">{money(totalMinor)}</dd>
                  <dt>Split method</dt>
                  <dd>
                    {METHOD_LABELS[draft.method]}
                    {draft.method === "equal" ? ` · ${money(each)} each` : ""}
                  </dd>
                  <dt>Group</dt>
                  <dd>{selectedGroup?.name ?? "No group"}</dd>
                </dl>
              </section>
              <section className="sm-rail-card">
                <h3>Participants Summary</h3>
                <p className="sm-rail-sub">Here&apos;s who still needs to pay.</p>
                <dl className="sm-rail-dl">
                  <dt>Total amount</dt>
                  <dd className="strong">{money(totalMinor)}</dd>
                  <dt>Paid</dt>
                  <dd>
                    {payerId && participantIds.includes(payerId) ? 1 : 0} person ·{" "}
                    {money(
                      sharePreview
                        .filter((s) => s.personId === payerId)
                        .reduce((a, s) => a + s.shareAmountMinor, 0),
                    )}
                  </dd>
                  <dt>Pending</dt>
                  <dd>
                    {sharePreview.filter((s) => s.personId !== payerId).length} people ·{" "}
                    {money(
                      sharePreview
                        .filter((s) => s.personId !== payerId)
                        .reduce((a, s) => a + s.shareAmountMinor, 0),
                    )}
                  </dd>
                </dl>
                <div className="sm-payer-list">
                  {sharePreview.map((s) => {
                    const isPayer = s.personId === payerId;
                    return (
                      <div key={s.personId}>
                        <Avatar name={nameOf(s.personId)} tone={toneOf(s.personId)} small />
                        <span>
                          <b>{nameOf(s.personId)}</b>
                          <small>
                            {isPayer ? "Paid" : "Pending"} · {money(s.shareAmountMinor)}
                          </small>
                        </span>
                        <em className={isPayer ? "paid" : "owes"}>{isPayer ? "Settled" : "Pending"}</em>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="sm-rail-card">
                <h3>Upcoming Reminders</h3>
                {draft.remindersEnabled && draft.dueDate ? (
                  <>
                    <p className="sm-rail-sub">2 reminders scheduled</p>
                    <div className="sm-reminder-list">
                      <div>
                        <CalendarDays size={15} />
                        <span>
                          <b>{fmtDate(reminderIso)}</b>
                          <small>First reminder ({draft.firstReminderDays} days before)</small>
                        </span>
                      </div>
                      <div>
                        <CalendarDays size={15} />
                        <span>
                          <b>{fmtDate(draft.dueDate)}</b>
                          <small>Due date reminder</small>
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="sm-rail-sub">
                    {draft.remindersEnabled
                      ? "Pick a due date to schedule reminders."
                      : "Reminders are turned off."}
                  </p>
                )}
              </section>
            </>
          )}

          {draft.step === 6 && (
            <>
              <section className="sm-rail-card">
                <h3>Split Summary</h3>
                <p className="sm-rail-sub">Here&apos;s a quick summary of this split expense.</p>
                <dl className="sm-rail-dl">
                  <dt>Total amount</dt>
                  <dd className="strong big">{money(totalMinor)}</dd>
                  <dt>Split between</dt>
                  <dd>{participantIds.length} people</dd>
                  <dt>Amount per person</dt>
                  <dd>
                    {draft.method === "equal" ? `${money(each)} each` : "Varies"}
                  </dd>
                  <dt>Paid by</dt>
                  <dd>{payer?.fullName ?? "—"}</dd>
                  <dt>Split method</dt>
                  <dd>{METHOD_LABELS[draft.method]}</dd>
                  <dt>Due date</dt>
                  <dd>{fmtDate(draft.dueDate)}</dd>
                  <dt>Reminders</dt>
                  <dd>
                    {draft.remindersEnabled
                      ? `Enabled · ${draft.firstReminderDays} days before`
                      : "Disabled"}
                  </dd>
                </dl>
              </section>
              <section className="sm-rail-card">
                <h3>Validation Checklist</h3>
                <div className="sm-checklist">
                  {checklist.map(([label, value, ok]) => (
                    <div key={label} className={ok ? "ok" : "warn"}>
                      <span className="sm-check-dot on">
                        {ok ? <Check size={11} /> : <Info size={11} />}
                      </span>
                      <b>{label}</b>
                      <small>{value}</small>
                    </div>
                  ))}
                </div>
              </section>
              <section className="sm-rail-card">
                <h3>Next Steps</h3>
                <p className="sm-rail-sub">What happens after you create this expense?</p>
                <ol className="sm-tips">
                  {(
                    [
                      ["Create the split expense", "The expense will be created and added to your records."],
                      ["Send notifications", "We'll notify participants (except you) about their share."],
                      ["Track & settle", "Participants can view, settle and mark as paid."],
                    ] as const
                  ).map(([t, d], i) => (
                    <li key={t}>
                      <span>{i + 1}</span>
                      <div>
                        <b>{t}</b>
                        <small>{d}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {draft.step !== 4 && draft.step !== 6 && <HowItWorks step={draft.step} />}
        </aside>
      </div>
    </main>
  );
}
