"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { splitMoneyService } from "@/services/split-money.service";
import { avatarTone, initials, statusLabel } from "./split-format";

export function GroupsView({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Friends & Social");
  const [groupType, setGroupType] = useState<"shared" | "personal">("shared");
  const [memberIds, setMemberIds] = useState<string[]>([]);
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

  const createMutation = useMutation({
    mutationFn: () =>
      splitMoneyService.createGroup({
        name,
        description: description || null,
        category,
        groupType,
        memberPersonIds: memberIds,
        defaultSplitMethod: "equal",
        currency: "INR",
        defaultDueDays: 7,
        allowMemberAdd: true,
        allowMemberEdit: true,
        allowMemberSettle: true,
        sendNotifications: true,
      }),
    onSuccess: () => {
      toast.success("Group created.");
      setCreating(false);
      setStep(1);
      setName("");
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
        <nav className="sm-stepper" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {["Group Details", "Add Members", "Settings", "Review"].map((label, i) => (
            <button
              key={label}
              type="button"
              className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}
            >
              <span>{i + 1}</span>
              <b>{label}</b>
            </button>
          ))}
        </nav>
        <section className="sm-form-card">
          {step === 1 && (
            <div className="sm-fields">
              <label className="wide">
                Group Name *
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="wide">
                Description
                <textarea
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Friends & Social</option>
                  <option>Family</option>
                  <option>Work</option>
                  <option>Travel</option>
                </select>
              </label>
              <div className="sm-mode wide">
                <button
                  type="button"
                  className={groupType === "shared" ? "active" : ""}
                  onClick={() => setGroupType("shared")}
                >
                  <Users size={19} />
                  Shared Group
                  <small>Members can add/manage</small>
                </button>
                <button
                  type="button"
                  className={groupType === "personal" ? "active" : ""}
                  onClick={() => setGroupType("personal")}
                >
                  <Users size={19} />
                  My Group
                  <small>Only you manage</small>
                </button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="sm-contact-list">
              {(peopleQuery.data ?? [])
                .filter((p) => !p.isSelf)
                .map((p, i) => {
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
            </div>
          )}
          {step === 3 && (
            <div className="sm-setting-list">
              <label>
                <div>
                  <b>Default split method</b>
                  <small>Equal Split</small>
                </div>
              </label>
              <label>
                <div>
                  <b>Allow members to add expenses</b>
                </div>
                <input type="checkbox" defaultChecked />
              </label>
              <label>
                <div>
                  <b>Send notifications to members</b>
                </div>
                <input type="checkbox" defaultChecked />
              </label>
            </div>
          )}
          {step === 4 && (
            <div className="sm-review-card">
              <div>
                <span>Name</span>
                <b>{name}</b>
              </div>
              <div>
                <span>Members</span>
                <b>{memberIds.length + 1}</b>
              </div>
              <div>
                <span>Type</span>
                <b>{groupType}</b>
              </div>
              <div>
                <span>Category</span>
                <b>{category}</b>
              </div>
            </div>
          )}
          <footer className="sm-wizard-footer">
            <button
              className="sm-outline"
              type="button"
              onClick={() => (step === 1 ? setCreating(false) : setStep(step - 1))}
            >
              Back
            </button>
            <button
              className="sm-primary"
              type="button"
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
              {step === 4 ? "Create Group" : "Next"}
            </button>
          </footer>
        </section>
      </main>
    );
  }

  if (selectedId && detailQuery.data) {
    const g = detailQuery.data;
    return (
      <main className="sm-page">
        <header className="sm-create-head">
          <button className="sm-back-title" type="button" onClick={() => setSelectedId(null)}>
            <ArrowLeft size={18} /> Groups
          </button>
        </header>
        <section className="sm-wizard-title">
          <h1>{g.name}</h1>
          <p>{g.description || "No description"}</p>
        </section>
        <section className="sm-stat-grid">
          <article className="sm-stat green">
            <div>
              <b>{money((g.expenses ?? []).reduce((s, e) => s + e.totalAmountMinor, 0))}</b>
              <p>Total Expenses</p>
            </div>
          </article>
          <article className="sm-stat blue">
            <div>
              <b>{g.members?.length ?? 0}</b>
              <p>Members</p>
            </div>
          </article>
        </section>
        <section className="sm-form-card">
          <h2>Members</h2>
          <div className="sm-contact-list">
            {(g.members ?? []).map((m, i) => (
              <div key={m.id} style={{ display: "flex", gap: 10, padding: 10, alignItems: "center" }}>
                <span className={`sm-avatar ${avatarTone(i)}`}>
                  {initials(m.person?.fullName ?? "?")}
                </span>
                <b>{m.person?.fullName}</b>
                <small style={{ marginLeft: "auto" }}>{m.role}</small>
              </div>
            ))}
          </div>
          <h2 style={{ marginTop: 20 }}>Recent expenses</h2>
          {(g.expenses ?? []).map((e) => (
            <div key={e.id} className="sm-callout" style={{ marginBottom: 8 }}>
              <div>
                <b>{e.title}</b>
                <small>
                  {statusLabel(e.status)} · {money(e.totalAmountMinor)}
                </small>
              </div>
            </div>
          ))}
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
          <h1>Groups</h1>
        </div>
        <button className="sm-primary" type="button" onClick={() => setCreating(true)}>
          <Plus size={18} /> Create Group
        </button>
      </header>
      <section className="sm-list-panel" style={{ padding: 16 }}>
        {(groupsQuery.data ?? []).length === 0 && <p>No groups yet.</p>}
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
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    fullName: string;
    phone: string;
    email: string;
    relationship: "friend" | "family" | "colleague" | "other";
  }>({
    fullName: "",
    phone: "",
    email: "",
    relationship: "friend",
  });

  const peopleQuery = useQuery({
    queryKey: ["split-people"],
    queryFn: () => splitMoneyService.listPeople(),
  });
  const detailQuery = useQuery({
    queryKey: ["split-person", selectedId],
    queryFn: () => splitMoneyService.getPerson(selectedId!),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      splitMoneyService.createPerson({
        fullName: form.fullName,
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

  const people = (peopleQuery.data ?? []).filter((p) => {
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
        <section className="sm-form-card">
          <h2>Add Person</h2>
          <div className="sm-fields">
            <label className="wide">
              Full Name *
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="wide">
              Relationship
              <select
                value={form.relationship}
                onChange={(e) =>
                  setForm({
                    ...form,
                    relationship: e.target.value as "friend" | "family" | "colleague" | "other",
                  })
                }
              >
                <option value="friend">Friend</option>
                <option value="family">Family</option>
                <option value="colleague">Colleague</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <footer className="sm-wizard-footer">
            <button className="sm-outline" type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="sm-primary" type="button" onClick={() => createMutation.mutate()}>
              Save Person
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
        <section className="sm-wizard-title">
          <h1>{d.person.fullName}</h1>
          <p>
            {statusLabel(d.person.relationship)} · {d.person.phone || "—"} · {d.person.email || "—"}
          </p>
        </section>
        <section className="sm-stat-grid">
          <article className="sm-stat red">
            <div>
              <b>{money(d.youOweMinor)}</b>
              <p>You owe</p>
            </div>
          </article>
          <article className="sm-stat green">
            <div>
              <b>{money(d.youAreOwedMinor)}</b>
              <p>You are owed</p>
            </div>
          </article>
        </section>
        <section className="sm-form-card">
          <h2>Shared expenses</h2>
          {d.expenses.map((e) => (
            <div key={e.id} className="sm-callout" style={{ marginBottom: 8 }}>
              <div>
                <b>{e.title}</b>
                <small>
                  {statusLabel(e.status)} · {money(e.totalAmountMinor)}
                </small>
              </div>
            </div>
          ))}
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
        </div>
        <button className="sm-primary" type="button" onClick={() => setAdding(true)}>
          <Plus size={18} /> Add Person
        </button>
      </header>
      <div className="sm-filters" style={{ marginBottom: 16 }}>
        {["all", "friend", "family", "colleague"].map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {statusLabel(f)}
          </button>
        ))}
      </div>
      <section className="sm-contact-list">
        {people.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}>
            <span className={`sm-avatar ${avatarTone(i)}`}>{initials(p.fullName)}</span>
            <div>
              <b>
                {p.fullName}
                {p.isSelf ? " (You)" : ""}
              </b>
              <small>
                {p.phone || "—"} · {statusLabel(p.relationship)}
              </small>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}
