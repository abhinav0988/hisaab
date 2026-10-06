"use client";

import { useEffect, useMemo, useState } from "react";
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
  Check,
  CircleDollarSign,
  HandCoins,
  IndianRupee,
  Plus,
  ReceiptText,
  Search,
  Users,
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

  return (
    <main className="sm-page sm-create">
      <header className="sm-create-head">
        <button className="sm-back-title" type="button" onClick={onClose}>
          <ArrowLeft size={18} /> Split Money
        </button>
        <button
          className="sm-outline"
          type="button"
          onClick={() => {
            if (!validateStep(1)) return;
            createMutation.mutate(true);
          }}
        >
          <ReceiptText size={16} /> Save Draft
        </button>
      </header>

      <section className="sm-wizard-title">
        <p className="sm-kicker">NEW SHARED EXPENSE</p>
        <h1>Create Split Expense</h1>
        <p>Add a shared expense, define who paid, and track settlements automatically.</p>
      </section>

      <nav className="sm-stepper" aria-label="Create split steps">
        {STEPS.map(([label, hint], i) => {
          const n = i + 1;
          return (
            <button
              key={label}
              type="button"
              className={draft.step === n ? "current" : draft.step > n ? "done" : ""}
              onClick={() => n < draft.step && update({ step: n })}
            >
              <span>{draft.step > n ? <Check size={14} /> : n}</span>
              <b>{label}</b>
              <small>{hint}</small>
            </button>
          );
        })}
      </nav>

      <div className="sm-wizard-grid">
        <section className="sm-form-card">
          {draft.step === 1 && (
            <>
              <Head
                h="Expense Details"
                p="Tell us about this expense. You can add more details and choose a group."
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
                </label>
                <label>
                  Date *
                  <input
                    type="date"
                    value={draft.expenseDate}
                    onChange={(e) => update({ expenseDate: e.target.value })}
                  />
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    value={draft.expenseTime}
                    onChange={(e) => update({ expenseTime: e.target.value })}
                  />
                </label>
                <label className="wide">
                  Group (optional)
                  <select
                    value={draft.groupId}
                    onChange={(e) => {
                      const groupId = e.target.value;
                      const group = (groupsQuery.data ?? []).find((g) => g.id === groupId);
                      update({
                        groupId,
                        participantIds: group?.members?.map((m) => m.personId) ?? draft.participantIds,
                      });
                    }}
                  >
                    <option value="">No group</option>
                    {(groupsQuery.data ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Description (optional)
                  <textarea
                    maxLength={200}
                    value={draft.description}
                    onChange={(e) => update({ description: e.target.value })}
                  />
                  <small>
                    {draft.description.length}/200
                  </small>
                </label>
              </div>
            </>
          )}

          {draft.step === 2 && (
            <>
              <Head h="Who Paid?" p="Select who paid for this expense. Single or multiple payers." />
              <div className="sm-mode">
                <button
                  type="button"
                  className={draft.payerMode === "single" ? "active" : ""}
                  onClick={() => update({ payerMode: "single" })}
                >
                  <Users size={19} />
                  Single payer
                  <small>One person paid the full amount</small>
                </button>
                <button
                  type="button"
                  className={draft.payerMode === "multiple" ? "active" : ""}
                  onClick={() => update({ payerMode: "multiple" })}
                >
                  <HandCoins size={19} />
                  Multiple payers
                  <small>Split payment among several people</small>
                </button>
              </div>
              <h3 className="sm-small-heading">Select payer(s)</h3>
              <div className="sm-people-grid">
                {people.map((p, i) => {
                  const selected = draft.payerIds.includes(p.id) || (draft.payerMode === "single" && draft.payerIds.length === 0 && p.isSelf);
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
                      {selected && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
              {draft.payerMode === "multiple" && (
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
              <div className="sm-callout">
                <Check size={18} />
                <div>
                  <b>
                    {draft.payerMode === "single"
                      ? `${people.find((p) => p.id === (draft.payerIds[0] || self?.id))?.fullName ?? "Payer"} will be marked as the payer for the full amount.`
                      : "Multiple payers — amounts must sum to the expense total."}
                  </b>
                </div>
              </div>
            </>
          )}

          {draft.step === 3 && (
            <>
              <Head h="Split With" p="Select the people to split this expense with." />
              <label className="sm-people-search">
                <Search size={17} />
                <input placeholder="Search people by name, phone or email..." />
              </label>
              <h3 className="sm-small-heading">All People</h3>
              <div className="sm-contact-list">
                {people.map((p, i) => {
                  const on = participantIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const current =
                          draft.participantIds.length > 0
                            ? draft.participantIds
                            : self
                              ? [self.id]
                              : [];
                        update({
                          participantIds: on
                            ? current.filter((id) => id !== p.id)
                            : [...new Set([...current, p.id])],
                        });
                      }}
                    >
                      <Avatar name={p.fullName} tone={avatarTone(i)} />
                      <div>
                        <b>
                          {p.fullName}
                          {p.isSelf ? " (You)" : ""}
                        </b>
                        <small>
                          {p.email || "—"} · {p.phone || "—"}
                        </small>
                      </div>
                      <span className={on ? "checked" : ""}>
                        {on ? <Check size={14} /> : <Plus size={14} />} {on ? "Added" : "Add"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.people && <p className="danger">{errors.people}</p>}
            </>
          )}

          {draft.step === 4 && (
            <>
              <Head h="How do you want to split this expense?" p="Choose a split method." />
              <div className="sm-methods">
                {(
                  [
                    ["equal", "Equal Split", "Split equally among all people"],
                    ["exact", "Exact Amount", "Set exact amount for each person"],
                    ["percentage", "Percentage", "Split by percentage"],
                    ["shares", "Shares", "Split by custom shares"],
                    ["itemwise", "Item-wise", "Split different items"],
                  ] as const
                ).map(([key, label, hint], i) => (
                  <button
                    key={key}
                    type="button"
                    className={draft.method === key ? "active" : ""}
                    onClick={() => update({ method: key })}
                  >
                    {
                      [
                        <Users key="u" />,
                        <IndianRupee key="r" />,
                        <span key="p">%</span>,
                        <CircleDollarSign key="c" />,
                        <ReceiptText key="i" />,
                      ][i]
                    }
                    <b>{label}</b>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>

              {draft.method === "exact" && (
                <div className="sm-fields" style={{ marginTop: 16 }}>
                  {participantIds.map((id) => {
                    const person = people.find((p) => p.id === id);
                    return (
                      <label key={id}>
                        {person?.fullName}
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
                    );
                  })}
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
                  {participantIds.map((id) => {
                    const person = people.find((p) => p.id === id);
                    return (
                      <label key={id}>
                        {person?.fullName} (%)
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
                    );
                  })}
                </div>
              )}

              {draft.method === "shares" && (
                <div className="sm-fields" style={{ marginTop: 16 }}>
                  {participantIds.map((id) => {
                    const person = people.find((p) => p.id === id);
                    return (
                      <label key={id}>
                        {person?.fullName} (shares)
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
                    );
                  })}
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

              <div className="sm-breakdown">
                <h3>Participant Breakdown</h3>
                {sharePreview.map((s) => {
                  const person = people.find((p) => p.id === s.personId);
                  const isPayer = (draft.payerIds[0] || self?.id) === s.personId;
                  return (
                    <div key={s.personId}>
                      <Avatar
                        name={person?.fullName ?? "?"}
                        tone={avatarTone(participantIds.indexOf(s.personId))}
                        small
                      />
                      <b>{person?.fullName}</b>
                      <span>{(s.sharePercentageBps / 100).toFixed(0)}%</span>
                      <strong>{money(s.shareAmountMinor)}</strong>
                      <em>{isPayer ? "Paid" : "Owes you"}</em>
                    </div>
                  );
                })}
              </div>

              <label className="sm-message">
                Add a message (optional)
                <textarea
                  maxLength={200}
                  value={draft.noteForParticipants}
                  onChange={(e) => update({ noteForParticipants: e.target.value })}
                />
              </label>
            </>
          )}

          {draft.step === 5 && (
            <>
              <Head h="Due Date & Reminder" p="Set a due date and configure reminders." />
              <div className="sm-fields">
                <label>
                  Settlement due date
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => update({ dueDate: e.target.value })}
                  />
                </label>
                <label>
                  First reminder
                  <select
                    value={draft.firstReminderDays}
                    onChange={(e) => update({ firstReminderDays: Number(e.target.value) })}
                  >
                    <option value={1}>1 day before</option>
                    <option value={2}>2 days before</option>
                    <option value={3}>3 days before</option>
                    <option value={7}>7 days before</option>
                  </select>
                </label>
              </div>
              <div className="sm-setting-list">
                {(
                  [
                    ["remindersEnabled", "Send payment reminders"],
                    ["recurring", "Recurring reminders"],
                    ["stopAfterSettlement", "Stop reminder after settlement"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <div>
                      <b>{label}</b>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft[key]}
                      onChange={(e) => update({ [key]: e.target.checked })}
                    />
                  </label>
                ))}
              </div>
              <div className="sm-mode" style={{ marginTop: 12 }}>
                {(
                  [
                    ["in_app", "In-app"],
                    ["email", "Email"],
                    ["whatsapp", "WhatsApp / SMS"],
                  ] as const
                ).map(([key, label]) => {
                  const on = draft.reminderChannels.includes(key === "whatsapp" ? "whatsapp" : key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={on ? "active" : ""}
                      onClick={() => {
                        const channel = key === "whatsapp" ? "whatsapp" : key;
                        update({
                          reminderChannels: on
                            ? draft.reminderChannels.filter((c) => c !== channel)
                            : [...draft.reminderChannels, channel],
                        });
                      }}
                    >
                      <BellIcon />
                      {label}
                      <small>{on ? "Selected" : "Tap to enable"}</small>
                    </button>
                  );
                })}
              </div>
              <label className="sm-message">
                Reminder message (optional)
                <textarea
                  maxLength={200}
                  value={draft.reminderMessage}
                  onChange={(e) => update({ reminderMessage: e.target.value })}
                  placeholder={`Hi! Reminder to settle your share for ${draft.title || "this expense"}.`}
                />
              </label>
            </>
          )}

          {draft.step === 6 && (
            <>
              <Head h="Review Split Expense" p="Confirm details before creating." />
              <div className="sm-review-card">
                <div>
                  <span>Expense title</span>
                  <b>{draft.title}</b>
                </div>
                <div>
                  <span>Total amount</span>
                  <b>{money(totalMinor)}</b>
                </div>
                <div>
                  <span>Paid by</span>
                  <b>
                    {people.find((p) => p.id === (draft.payerIds[0] || self?.id))?.fullName}
                  </b>
                </div>
                <div>
                  <span>Split method</span>
                  <b>{draft.method}</b>
                </div>
                <div>
                  <span>Due date</span>
                  <b>{draft.dueDate || "—"}</b>
                </div>
                <div>
                  <span>Participants</span>
                  <b>{participantIds.length} people</b>
                </div>
              </div>
              <div className="sm-breakdown">
                <h3>Participants</h3>
                {sharePreview.map((s) => {
                  const person = people.find((p) => p.id === s.personId);
                  return (
                    <div key={s.personId}>
                      <Avatar name={person?.fullName ?? "?"} tone="me" small />
                      <b>{person?.fullName}</b>
                      <span>{(s.sharePercentageBps / 100).toFixed(0)}%</span>
                      <strong>{money(s.shareAmountMinor)}</strong>
                      <em>Pending</em>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <footer className="sm-wizard-footer">
            <button
              className="sm-outline"
              type="button"
              onClick={() => (draft.step === 1 ? onClose() : update({ step: draft.step - 1 }))}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="sm-primary"
              type="button"
              disabled={createMutation.isPending}
              onClick={goNext}
            >
              {draft.step === 6 ? (
                <>
                  Create Split Expense <Check size={17} />
                </>
              ) : (
                <>
                  Continue <ArrowRight size={17} />
                </>
              )}
            </button>
          </footer>
        </section>

        <aside className="sm-preview">
          <span className="sm-chip">STEP {draft.step} OF 6</span>
          <h2>{draft.step === 6 ? "Split Summary" : "Expense Preview"}</h2>
          <div className="sm-preview-main">
            <span className="sm-exp-icon food">
              <ReceiptText />
            </span>
            <div>
              <b>{draft.title || "Untitled expense"}</b>
              <small>
                {draft.expenseDate}
                {draft.expenseTime ? ` · ${draft.expenseTime}` : ""}
              </small>
            </div>
            <strong>{money(totalMinor)}</strong>
          </div>
          <dl>
            <dt>Total amount</dt>
            <dd>{money(totalMinor)}</dd>
            <dt>Split between</dt>
            <dd>{participantIds.length} people</dd>
            <dt>Amount per person</dt>
            <dd>{money(each)} each</dd>
            <dt>Paid by</dt>
            <dd>
              {people.find((p) => p.id === (draft.payerIds[0] || self?.id))?.fullName ?? "—"}
            </dd>
            <dt>Split method</dt>
            <dd>{draft.method}</dd>
          </dl>
          <div className="sm-preview-note">
            <CircleDollarSign size={17} /> You can update details any time before creating the
            split.
          </div>
        </aside>
      </div>
    </main>
  );
}

function BellIcon() {
  return <Users size={19} />;
}
