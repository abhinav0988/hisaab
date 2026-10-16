"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Currency, SplitGroup, SplitMethod, SplitRelationship } from "@hisaab/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Percent,
  Plus,
  Receipt,
  Search,
  Split,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { avatarTone, initials, statusClass, statusLabel } from "./split-format";

const GROUP_STEPS = ["Group Details", "Add Members", "Settings", "Review"] as const;
const GROUP_CATEGORIES = ["Friends & Social", "Family", "Work", "Travel", "Home", "Others"];
const CURRENCIES: Currency[] = ["INR", "NPR", "PKR", "BDT", "USD"];
const GROUP_METHODS: Array<{ id: SplitMethod; label: string; icon: React.ReactNode }> = [
  { id: "equal", label: "Equal Split", icon: <Users size={20} /> },
  { id: "exact", label: "Exact Amount", icon: <Receipt size={20} /> },
  { id: "percentage", label: "Percentage", icon: <Percent size={20} /> },
  { id: "shares", label: "Custom Shares", icon: <Split size={20} /> },
];
const RELATIONSHIPS: Array<{ id: SplitRelationship; label: string }> = [
  { id: "friend", label: "Friend" },
  { id: "family", label: "Family" },
  { id: "colleague", label: "Colleague" },
  { id: "other", label: "Other" },
];

type GroupSettings = {
  defaultSplitMethod: SplitMethod;
  currency: Currency;
  defaultDueDays: number;
  allowMemberAdd: boolean;
  allowMemberEdit: boolean;
  allowMemberSettle: boolean;
  sendNotifications: boolean;
};

function SettingsFields({
  value,
  onChange,
}: {
  value: GroupSettings;
  onChange: (next: GroupSettings) => void;
}) {
  const toggles: Array<[keyof GroupSettings, string]> = [
    ["allowMemberAdd", "Allow members to add expenses"],
    ["allowMemberEdit", "Allow members to edit expenses"],
    ["allowMemberSettle", "Allow members to settle expenses"],
    ["sendNotifications", "Send notifications to members"],
  ];
  return (
    <>
      <h3 className="sm-small-heading" style={{ marginTop: 0 }}>
        Default split method
      </h3>
      <div className="sm-method-cards">
        {GROUP_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={value.defaultSplitMethod === m.id ? "active" : ""}
            onClick={() => onChange({ ...value, defaultSplitMethod: m.id })}
          >
            {m.icon}
            <b>{m.label}</b>
          </button>
        ))}
      </div>
      <div className="sm-fields" style={{ marginTop: 16 }}>
        <label>
          Default currency
          <select
            value={value.currency}
            onChange={(e) => onChange({ ...value, currency: e.target.value as Currency })}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Default due date
          <select
            value={value.defaultDueDays}
            onChange={(e) => onChange({ ...value, defaultDueDays: Number(e.target.value) })}
          >
            {[0, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d === 0 ? "On expense date" : `${d} days from expense date`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="sm-setting-list" style={{ marginTop: 16 }}>
        {toggles.map(([key, label]) => (
          <label key={key}>
            <div>
              <b>{label}</b>
            </div>
            <input
              type="checkbox"
              checked={value[key] as boolean}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
          </label>
        ))}
      </div>
    </>
  );
}

const DEFAULT_SETTINGS: GroupSettings = {
  defaultSplitMethod: "equal",
  currency: "INR",
  defaultDueDays: 7,
  allowMemberAdd: true,
  allowMemberEdit: true,
  allowMemberSettle: true,
  sendNotifications: true,
};

function GroupDetail({ group, onBack }: { group: SplitGroup; onBack: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"expenses" | "balances" | "members" | "settings">("expenses");
  const [settings, setSettings] = useState<GroupSettings>({
    defaultSplitMethod: group.defaultSplitMethod,
    currency: group.currency,
    defaultDueDays: group.defaultDueDays,
    allowMemberAdd: group.allowMemberAdd,
    allowMemberEdit: group.allowMemberEdit,
    allowMemberSettle: group.allowMemberSettle,
    sendNotifications: group.sendNotifications,
  });
  const [newMember, setNewMember] = useState("");

  const peopleQuery = useQuery({
    queryKey: ["split-people"],
    queryFn: () => splitMoneyService.listPeople(),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["split-group", group.id] });
    void qc.invalidateQueries({ queryKey: ["split-groups"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => splitMoneyService.patchGroup(group.id, settings),
    onSuccess: () => {
      toast.success("Group settings saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addMutation = useMutation({
    mutationFn: (personId: string) => splitMoneyService.addGroupMember(group.id, personId),
    onSuccess: () => {
      setNewMember("");
      toast.success("Member added.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => splitMoneyService.removeGroupMember(group.id, memberId),
    onSuccess: () => {
      toast.success("Member removed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const members = group.members ?? [];
  const expenses = group.expenses ?? [];
  const currency = group.currency;
  const summary = group.summary;
  const totalMinor = summary?.totalSharedMinor ?? expenses.reduce((s, e) => s + e.totalAmountMinor, 0);
  const balances = group.memberBalances ?? [];
  const addable = (peopleQuery.data ?? []).filter((p) => !members.some((m) => m.personId === p.id));
  const balanceFor = (personId: string) => balances.find((b) => b.personId === personId);

  return (
    <main className="sm-page">
      <header className="sm-create-head">
        <button className="sm-back-title" type="button" onClick={onBack}>
          <ArrowLeft size={18} /> Groups
        </button>
      </header>
      <section className="sm-group-banner">
        <span className="sm-group-icon">
          <Users size={30} />
        </span>
        <div>
          <h1>{group.name}</h1>
          <p>{group.description || "No description"}</p>
          <div className="sm-avatar-stack">
            {members.slice(0, 5).map((m, i) => (
              <span key={m.id} className={`sm-avatar small ${avatarTone(i)}`}>
                {initials(m.person?.fullName ?? "?")}
              </span>
            ))}
            {members.length > 5 && <span className="sm-more">+{members.length - 5}</span>}
          </div>
        </div>
        <div className="sm-chip-row">
          {group.category && <span className="sm-chip">{group.category}</span>}
          <span className="sm-chip">{statusLabel(group.groupType)}</span>
        </div>
      </section>

      <nav className="sm-tabs sm-group-tabs" aria-label="Group sections">
        {(["expenses", "balances", "members", "settings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {statusLabel(t)}
          </button>
        ))}
      </nav>

      <section className="sm-stat-grid" aria-label="Group summary">
        <article className="sm-stat green">
          <div>
            <b>{money(totalMinor, currency)}</b>
            <p>Total shared expenses</p>
          </div>
        </article>
        <article className="sm-stat blue">
          <div>
            <b>{money(summary?.collectedMinor ?? 0, currency)}</b>
            <p>Repayments completed</p>
          </div>
        </article>
        <article className="sm-stat gold">
          <div>
            <b>{money(summary?.outstandingMinor ?? 0, currency)}</b>
            <p>Still outstanding</p>
          </div>
        </article>
        <article className="sm-stat">
          <div>
            <b>
              {summary?.activeExpenses ?? expenses.length} active · {summary?.settledExpenses ?? 0} settled
            </b>
            <p>
              {members.length} members · {summary?.settledPercent ?? 0}% settled
            </p>
          </div>
        </article>
      </section>

      {tab === "balances" && (
        <section className="sm-form-card" aria-label="Member balances">
          <h2>Member balances</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
            Positive = should receive money, negative = owes money. Computed by the server from every
            expense in this group; upfront bill payments are separate from repayments.
          </p>
          {balances.length === 0 && <p className="sm-empty">No balances yet — add an expense to this group.</p>}
          <div className="sm-breakdown">
            {balances.map((b, i) => (
              <div key={b.personId}>
                <span className={`sm-avatar ${avatarTone(i)} small`}>{initials(b.person?.fullName ?? "?")}</span>
                <b>
                  {b.person?.fullName ?? "Unknown"}
                  {!b.isMember ? " (former member)" : ""}
                </b>
                <span>
                  {b.expenseCount} expense{b.expenseCount === 1 ? "" : "s"} · share {money(b.shareMinor, currency)}
                </span>
                <strong style={{ color: b.netMinor > 0 ? "var(--green, #55e7a0)" : b.netMinor < 0 ? "var(--red, #f87171)" : undefined }}>
                  {b.netMinor > 0 ? `+${money(b.netMinor, currency)}` : b.netMinor < 0 ? `−${money(-b.netMinor, currency)}` : "settled"}
                </strong>
                <em>
                  upfront {money(b.upfrontPaidMinor, currency)} · repaid {money(b.repaymentSentMinor, currency)} · received{" "}
                  {money(b.repaymentReceivedMinor, currency)}
                  {b.owedMinor > 0 ? ` · owes ${money(b.owedMinor, currency)}` : ""}
                  {b.receivableMinor > 0 ? ` · is owed ${money(b.receivableMinor, currency)}` : ""}
                </em>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "expenses" && (
        <section className="sm-form-card">
          <div className="sm-section-row">
            <h2>Recent Expenses</h2>
            <Link className="sm-primary" href={`/split-money/create?groupId=${encodeURIComponent(group.id)}`}>
              <Plus size={16} /> Add Expense
            </Link>
          </div>
          {expenses.length === 0 && <p className="sm-empty">No expenses in this group yet.</p>}
          <div className="sm-group-expenses">
            {expenses.map((e) => (
              <Link
                key={e.id}
                href={`/split-money/expense?id=${encodeURIComponent(e.id)}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <span className="sm-exp-icon food">
                  <Receipt size={16} />
                </span>
                <div>
                  <b>{e.title}</b>
                  <small>
                    {e.expenseDate} · {money(e.totalAmountMinor, e.currency)} · repaid{" "}
                    {money(e.ledger?.collectedMinor ?? e.collectedMinor ?? 0, e.currency)} of{" "}
                    {money(e.ledger?.collectibleMinor ?? e.collectibleMinor ?? 0, e.currency)}
                  </small>
                </div>
                <span className={`sm-status ${statusClass(e.status)}`}>{statusLabel(e.status)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === "members" && (
        <section className="sm-form-card">
          <div className="sm-section-row">
            <h2>Members ({members.length})</h2>
            <div className="sm-inline-add">
              <select
                aria-label="Add member"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
              >
                <option value="">Select person…</option>
                {addable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
              <button
                className="sm-primary"
                type="button"
                disabled={!newMember || addMutation.isPending}
                onClick={() => addMutation.mutate(newMember)}
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
          <div className="sm-contact-list">
            {members.map((m, i) => (
              <div key={m.id} className="sm-member-row">
                <span className={`sm-avatar ${avatarTone(i)}`}>
                  {initials(m.person?.fullName ?? "?")}
                </span>
                <b>{m.person?.fullName ?? "Unknown"}</b>
                <small>
                  {statusLabel(m.role)}
                  {(() => {
                    const b = balanceFor(m.personId);
                    if (!b || b.netMinor === 0) return " · settled";
                    return b.netMinor > 0
                      ? ` · is owed ${money(b.netMinor, currency)}`
                      : ` · owes ${money(-b.netMinor, currency)}`;
                  })()}
                </small>
                {!m.person?.isSelf && (
                  <button
                    type="button"
                    className="sm-icon-btn"
                    aria-label={`Remove ${m.person?.fullName ?? "member"}`}
                    disabled={removeMutation.isPending}
                    title={
                      (balanceFor(m.personId)?.netMinor ?? 0) !== 0
                        ? "Settle this member's balance before removing them"
                        : undefined
                    }
                    onClick={() => {
                      const b = balanceFor(m.personId);
                      const warning =
                        b && b.netMinor !== 0
                          ? `${m.person?.fullName ?? "This member"} still ${b.netMinor < 0 ? "owes" : "is owed"} ${money(Math.abs(b.netMinor), currency)} in this group. The server will refuse removal until it is settled. Try anyway?`
                          : `Remove ${m.person?.fullName ?? "this member"} from the group? Their past expenses stay in history.`;
                      if (window.confirm(warning)) removeMutation.mutate(m.id);
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="sm-form-card">
          <SettingsFields value={settings} onChange={setSettings} />
          <footer className="sm-wizard-footer">
            <span />
            <button
              className="sm-primary"
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save Settings"}
            </button>
          </footer>
        </section>
      )}
    </main>
  );
}

export function GroupsView({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Friends & Social");
  const [groupType, setGroupType] = useState<"shared" | "personal">("shared");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [settings, setSettings] = useState<GroupSettings>(DEFAULT_SETTINGS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["split-groups"],
    queryFn: () => splitMoneyService.listGroups(),
  });
  const peopleQuery = useQuery({
    queryKey: ["split-people"],
    queryFn: () => splitMoneyService.listPeople(),
  });
  const detailQuery = useQuery({
    queryKey: ["split-group", selectedId],
    queryFn: () => splitMoneyService.getGroup(selectedId!),
    enabled: !!selectedId,
  });

  const candidates = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return (peopleQuery.data ?? [])
      .filter((p) => !p.isSelf)
      .filter(
        (p) =>
          !q ||
          p.fullName.toLowerCase().includes(q) ||
          (p.phone ?? "").includes(q) ||
          (p.email ?? "").toLowerCase().includes(q),
      );
  }, [peopleQuery.data, memberSearch]);
  const selectedPeople = (peopleQuery.data ?? []).filter((p) => memberIds.includes(p.id));

  const resetForm = () => {
    setStep(1);
    setName("");
    setDescription("");
    setCategory("Friends & Social");
    setGroupType("shared");
    setMemberIds([]);
    setMemberSearch("");
    setSettings(DEFAULT_SETTINGS);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      splitMoneyService.createGroup({
        name: name.trim(),
        description: description || null,
        category,
        groupType,
        memberPersonIds: memberIds,
        ...settings,
      }),
    onSuccess: () => {
      toast.success("Group created.");
      setCreating(false);
      resetForm();
      void qc.invalidateQueries({ queryKey: ["split-groups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (creating) {
    return (
      <main className="sm-page sm-create">
        <header className="sm-create-head">
          <button className="sm-back-title" type="button" onClick={() => setCreating(false)}>
            <ArrowLeft size={18} /> Groups
          </button>
        </header>
        <section className="sm-wizard-title">
          <h1>Create Group</h1>
          <p>Create a group to split expenses with friends, family or colleagues.</p>
        </section>
        <nav className="sm-stepper" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {GROUP_STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}
            >
              <span>{step > i + 1 ? <Check size={13} /> : i + 1}</span>
              <b>{label}</b>
            </button>
          ))}
        </nav>
        <section className="sm-form-card">
          {step === 1 && (
            <div className="sm-fields">
              <label className="wide">
                Group Name *
                <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="wide">
                Description (optional)
                <textarea
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <small className="sm-muted">{description.length}/200</small>
              </label>
              <label className="wide">
                Category (optional)
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {GROUP_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <div className="sm-mode wide sm-type-cards">
                <button
                  type="button"
                  className={groupType === "shared" ? "active" : ""}
                  onClick={() => setGroupType("shared")}
                >
                  <Users size={19} />
                  Shared Group
                  <small>All members can add and manage expenses</small>
                </button>
                <button
                  type="button"
                  className={groupType === "personal" ? "active" : ""}
                  onClick={() => setGroupType("personal")}
                >
                  <Users size={19} />
                  My Group
                  <small>Only you manage expenses and just invite</small>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <label className="sm-people-search sm-search" style={{ width: "100%" }}>
                <Search size={14} />
                <input
                  aria-label="Search people"
                  placeholder="Search by name, phone or email…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </label>
              <div className="sm-contact-list" style={{ marginTop: 12 }}>
                {candidates.map((p, i) => {
                  const on = memberIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setMemberIds(
                          on ? memberIds.filter((id) => id !== p.id) : [...memberIds, p.id],
                        )
                      }
                    >
                      <span className={`sm-avatar ${avatarTone(i)}`}>{initials(p.fullName)}</span>
                      <div>
                        <b>{p.fullName}</b>
                        <small>{p.phone || p.email || "—"}</small>
                      </div>
                      <span className={on ? "checked" : ""}>{on ? "Added" : "+ Add"}</span>
                    </button>
                  );
                })}
                {!candidates.length && <p className="sm-empty">No people found.</p>}
              </div>
              <div className="sm-split-with-head">
                <h3 className="sm-small-heading">Selected Members ({selectedPeople.length})</h3>
                {selectedPeople.length > 0 && (
                  <button className="sm-link-btn" type="button" onClick={() => setMemberIds([])}>
                    Clear All
                  </button>
                )}
              </div>
              <div className="sm-member-chips">
                {selectedPeople.map((p, i) => (
                  <span key={p.id}>
                    <span className={`sm-avatar small ${avatarTone(i)}`}>{initials(p.fullName)}</span>
                    {p.fullName}
                    <button
                      type="button"
                      aria-label={`Remove ${p.fullName}`}
                      onClick={() => setMemberIds(memberIds.filter((id) => id !== p.id))}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {!selectedPeople.length && <small className="sm-muted">You are added automatically.</small>}
              </div>
            </>
          )}

          {step === 3 && <SettingsFields value={settings} onChange={setSettings} />}

          {step === 4 && (
            <div className="sm-review-card">
              <div>
                <span>Group Name</span>
                <b>{name}</b>
              </div>
              <div>
                <span>Description</span>
                <b>{description || "—"}</b>
              </div>
              <div>
                <span>Category</span>
                <b>{category}</b>
              </div>
              <div>
                <span>Type</span>
                <b>{groupType === "shared" ? "Shared Group" : "My Group"}</b>
              </div>
              <div>
                <span>Members</span>
                <b>{memberIds.length + 1}</b>
              </div>
              <div>
                <span>Default Split Method</span>
                <b>{statusLabel(settings.defaultSplitMethod)}</b>
              </div>
              <div>
                <span>Currency</span>
                <b>{settings.currency}</b>
              </div>
              <div>
                <span>Members can add expenses</span>
                <b>{settings.allowMemberAdd ? "Yes" : "No"}</b>
              </div>
              <div>
                <span>Members can edit expenses</span>
                <b>{settings.allowMemberEdit ? "Yes" : "No"}</b>
              </div>
              <div>
                <span>Members can settle expenses</span>
                <b>{settings.allowMemberSettle ? "Yes" : "No"}</b>
              </div>
              <div>
                <span>Notifications</span>
                <b>{settings.sendNotifications ? "Yes" : "No"}</b>
              </div>
              <div>
                <span>Default Due Date</span>
                <b>
                  {settings.defaultDueDays === 0
                    ? "On expense date"
                    : `${settings.defaultDueDays} days from expense date`}
                </b>
              </div>
            </div>
          )}

          <footer className="sm-wizard-footer">
            <button
              className="sm-outline"
              type="button"
              onClick={() => (step === 1 ? setCreating(false) : setStep(step - 1))}
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>
            <button
              className="sm-primary"
              type="button"
              disabled={createMutation.isPending}
              onClick={() => {
                if (step < 4) {
                  if (step === 1 && !name.trim()) {
                    toast.error("Group name is required");
                    return;
                  }
                  setStep(step + 1);
                  return;
                }
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? (
                "Creating…"
              ) : step === 4 ? (
                <>
                  Create Group <Check size={15} />
                </>
              ) : (
                <>
                  Next: {GROUP_STEPS[step]} <ArrowRight size={15} />
                </>
              )}
            </button>
          </footer>
        </section>
      </main>
    );
  }

  if (selectedId && detailQuery.data) {
    return <GroupDetail group={detailQuery.data} onBack={() => setSelectedId(null)} />;
  }

  return (
    <main className="sm-page">
      <header className="sm-head">
        <div>
          <button className="sm-back-title" type="button" onClick={onBack}>
            <ArrowLeft size={18} /> Split Money
          </button>
          <h1>Groups</h1>
        </div>
        <button className="sm-primary" type="button" onClick={() => setCreating(true)}>
          <Plus size={18} /> Create Group
        </button>
      </header>
      <section className="sm-list-panel" style={{ padding: 16 }}>
        {(groupsQuery.data ?? []).length === 0 && <p className="sm-empty">No groups yet.</p>}
        {(groupsQuery.data ?? []).map((g) => (
          <button
            key={g.id}
            type="button"
            className="sm-callout"
            style={{ width: "100%", marginBottom: 10, textAlign: "left" }}
            onClick={() => setSelectedId(g.id)}
          >
            <Users size={18} />
            <div>
              <b>{g.name}</b>
              <small>
                {g.members?.length ?? 0} members · {g.category || "Uncategorized"}
              </small>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}

export function PeopleView({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | SplitRelationship>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState(false);
  const [form, setForm] = useState<{
    fullName: string;
    phone: string;
    email: string;
    relationship: SplitRelationship;
  }>({
    fullName: "",
    phone: "",
    email: "",
    relationship: "friend",
  });

  const peopleQuery = useQuery({
    queryKey: ["split-people", showArchived],
    queryFn: () => splitMoneyService.listPeople(showArchived),
  });
  const detailQuery = useQuery({
    queryKey: ["split-person", selectedId],
    queryFn: () => splitMoneyService.getPerson(selectedId!),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      splitMoneyService.createPerson({
        fullName: form.fullName.trim(),
        phone: form.phone || null,
        email: form.email || null,
        relationship: form.relationship,
        countryCode: "IN",
      }),
    onSuccess: () => {
      toast.success("Person added.");
      setAdding(false);
      setForm({ fullName: "", phone: "", email: "", relationship: "friend" });
      void qc.invalidateQueries({ queryKey: ["split-people"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshPerson = () => {
    void qc.invalidateQueries({ queryKey: ["split-people"] });
    void qc.invalidateQueries({ queryKey: ["split-person", selectedId] });
    void qc.invalidateQueries({ queryKey: ["split-money"] });
  };
  const editMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("No person selected");
      if (!form.fullName.trim()) throw new Error("Full name is required");
      return splitMoneyService.patchPerson(selectedId, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        relationship: form.relationship,
      });
    },
    onSuccess: () => {
      toast.success("Person updated.");
      setEditingPerson(false);
      refreshPerson();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveMutation = useMutation({
    mutationFn: (restore: boolean) => {
      if (!selectedId) throw new Error("No person selected");
      return restore ? splitMoneyService.restorePerson(selectedId) : splitMoneyService.archivePerson(selectedId);
    },
    onSuccess: (_, restore) => {
      toast.success(restore ? "Person restored." : "Person archived. Their history is kept.");
      refreshPerson();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = peopleQuery.data ?? [];
  const countFor = (rel: "all" | SplitRelationship) =>
    rel === "all" ? all.length : all.filter((p) => !p.isSelf && p.relationship === rel).length;
  const people = all.filter((p) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !(
        p.fullName.toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.email ?? "").toLowerCase().includes(q)
      )
    )
      return false;
    if (p.isSelf) return filter === "all";
    if (filter === "all") return true;
    return p.relationship === filter;
  });

  if (adding) {
    return (
      <main className="sm-page">
        <header className="sm-create-head">
          <button className="sm-back-title" type="button" onClick={() => setAdding(false)}>
            <ArrowLeft size={18} /> People
          </button>
        </header>
        <section className="sm-wizard-title">
          <h1>Add Person</h1>
          <p>Add a new person to quickly split expenses.</p>
        </section>
        <section className="sm-form-card">
          <div className="sm-fields">
            <label className="wide">
              Full Name *
              <input
                value={form.fullName}
                maxLength={80}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </label>
            <label>
              Phone Number
              <span className="sm-phone-field">
                <i>🇮🇳 +91</i>
                <input
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </span>
            </label>
            <label>
              Email (optional)
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <div className="wide">
              <b style={{ fontSize: 12 }}>Relationship (optional)</b>
              <div className="sm-rel-chips">
                {RELATIONSHIPS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={form.relationship === r.id ? "selected" : ""}
                    onClick={() => setForm({ ...form, relationship: r.id })}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button
              className="sm-primary"
              type="button"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!form.fullName.trim()) {
                  toast.error("Full name is required");
                  return;
                }
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? "Saving…" : "Save Person"}
            </button>
          </footer>
        </section>
      </main>
    );
  }

  if (selectedId && detailQuery.data) {
    const d = detailQuery.data;
    return (
      <main className="sm-page">
        <header className="sm-create-head">
          <button className="sm-back-title" type="button" onClick={() => setSelectedId(null)}>
            <ArrowLeft size={18} /> People
          </button>
        </header>
        <section className="sm-group-banner">
          <span className="sm-avatar" style={{ width: 64, height: 64, fontSize: 20 }}>
            {initials(d.person.fullName)}
          </span>
          <div>
            <h1>{d.person.fullName}</h1>
            <p>
              {d.person.phone || "—"} · {d.person.email || "—"}
            </p>
          </div>
          <div className="sm-chip-row">
            <span className="sm-chip">{statusLabel(d.person.relationship)}</span>
            {d.person.archivedAt ? <span className="sm-chip">Archived</span> : null}
          </div>
        </section>
        {(d.balances?.length
          ? d.balances
          : [{ currency: d.currency ?? "INR", youOweMinor: d.youOweMinor, youAreOwedMinor: d.youAreOwedMinor }]
        ).map((b) => (
          <section key={b.currency} className="sm-stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <article className="sm-stat red">
              <div>
                <small>You owe {d.balances && d.balances.length > 1 ? `(${b.currency})` : ""}</small>
                <b>{money(b.youOweMinor, b.currency)}</b>
              </div>
            </article>
            <article className="sm-stat green">
              <div>
                <small>You are owed {d.balances && d.balances.length > 1 ? `(${b.currency})` : ""}</small>
                <b>{money(b.youAreOwedMinor, b.currency)}</b>
              </div>
            </article>
          </section>
        ))}
        {!d.person.isSelf ? (
          <section className="sm-form-card" style={{ marginBottom: 16 }}>
            {editingPerson ? (
              <>
                <h2>Edit person</h2>
                <div className="sm-fields">
                  <label className="wide">
                    Full Name *
                    <input value={form.fullName} maxLength={80} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                  </label>
                  <label>
                    Phone Number
                    <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label>
                    Email
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                  <div className="wide">
                    <b style={{ fontSize: 12 }}>Relationship</b>
                    <div className="sm-rel-chips">
                      {RELATIONSHIPS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={form.relationship === r.id ? "selected" : ""}
                          onClick={() => setForm({ ...form, relationship: r.id })}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <footer className="sm-wizard-footer">
                  <button className="sm-outline" type="button" disabled={editMutation.isPending} onClick={() => setEditingPerson(false)}>
                    Discard
                  </button>
                  <button className="sm-primary" type="button" disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>
                    {editMutation.isPending ? "Saving…" : "Save changes"}
                  </button>
                </footer>
              </>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="sm-outline"
                  type="button"
                  disabled={archiveMutation.isPending}
                  onClick={() => {
                    setForm({
                      fullName: d.person.fullName,
                      phone: d.person.phone ?? "",
                      email: d.person.email ?? "",
                      relationship: d.person.relationship,
                    });
                    setEditingPerson(true);
                  }}
                >
                  Edit person
                </button>
                {d.person.archivedAt ? (
                  <button className="sm-outline" type="button" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(true)}>
                    {archiveMutation.isPending ? "Restoring…" : "Restore person"}
                  </button>
                ) : (
                  <button
                    className="sm-outline"
                    type="button"
                    disabled={archiveMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Archive this person? They are hidden from new splits; every past expense and repayment stays in history. You can restore them later.",
                        )
                      )
                        archiveMutation.mutate(false);
                    }}
                  >
                    {archiveMutation.isPending ? "Archiving…" : "Archive person"}
                  </button>
                )}
              </div>
            )}
          </section>
        ) : null}
        <section className="sm-form-card">
          <h2>Expenses ({d.expenses.length})</h2>
          {d.expenses.length === 0 && <p className="sm-empty">No shared expenses yet.</p>}
          <div className="sm-group-expenses">
            {d.expenses.map((e) => (
              <Link
                key={e.id}
                href={`/split-money/expense?id=${encodeURIComponent(e.id)}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <span className="sm-exp-icon food">
                  <Receipt size={16} />
                </span>
                <div>
                  <b>{e.title}</b>
                  <small>
                    {e.expenseDate} · {money(e.totalAmountMinor, e.currency)}
                  </small>
                </div>
                <span className={`sm-status ${statusClass(e.status)}`}>{statusLabel(e.status)}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="sm-page">
      <header className="sm-head">
        <div>
          <button className="sm-back-title" type="button" onClick={onBack}>
            <ArrowLeft size={18} /> Split Money
          </button>
          <h1>People</h1>
          <p style={{ color: "var(--muted-foreground)" }}>Manage people you split expenses with.</p>
        </div>
        <button className="sm-primary" type="button" onClick={() => setAdding(true)}>
          <Plus size={18} /> Add Person
        </button>
      </header>
      <label className="sm-search sm-people-search" style={{ width: "100%", marginBottom: 12 }}>
        <Search size={14} />
        <input
          aria-label="Search people"
          placeholder="Search by name, phone or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="sm-filters" style={{ marginBottom: 16 }}>
        {(
          [
            ["all", "All"],
            ["friend", "Friends"],
            ["family", "Family"],
            ["colleague", "Work"],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {label} ({countFor(f)})
          </button>
        ))}
        <button
          type="button"
          className={showArchived ? "selected" : ""}
          onClick={() => setShowArchived((prev) => !prev)}
        >
          {showArchived ? "Showing archived" : "Show archived"}
        </button>
      </div>
      <section className="sm-contact-list sm-people-list">
        {people.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}>
            <span className={`sm-avatar ${avatarTone(i)}`}>{initials(p.fullName)}</span>
            <div>
              <b>
                {p.fullName}
                {p.isSelf ? " (You)" : ""}
                {p.archivedAt ? " (Archived)" : ""}
              </b>
              <small>{p.phone || p.email || "—"}</small>
            </div>
            <span className={`sm-rel-badge ${p.relationship}`}>{statusLabel(p.relationship)}</span>
          </button>
        ))}
        {!people.length && <p className="sm-empty">No people found.</p>}
      </section>
    </main>
  );
}
