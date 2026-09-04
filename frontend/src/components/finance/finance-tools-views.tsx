"use client";

import type {
  CreditFacility,
  LendKind,
  LendRecord,
} from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pencil, Sparkles, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CardHead, ProgressBar, ProLabel } from "@/components/layout/chrome";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { money } from "@/lib/format";
import {
  displayDate,
  isoPlusDays,
  isoToday,
  openLends,
  sumMinor,
} from "@/lib/finance-modules";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function Metrics({ items }: { items: Array<{ label: string; value: string; note?: string }> }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="oc-card">
          <small className="text-[11px] font-bold text-[var(--muted-foreground)]">{item.label}</small>
          <div className="mt-2 text-xl font-black tracking-[-0.04em]">{item.value}</div>
          {item.note ? <small className="mt-1 block text-[11px] text-[var(--muted-foreground)]">{item.note}</small> : null}
        </Card>
      ))}
    </div>
  );
}

export { InvestmentsView } from "@/components/investments/investments-view";

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
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      financeService.updateCreditFacility(id, body),
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
  if (profile.isLoading || facilities.isLoading) return <PageSkeleton />;
  if (facilities.isError) return <ErrorState retry={() => void facilities.refetch()} />;
  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = (facilities.data ?? []).filter((item) => item.kind === "UPI");
  const limit = sumMinor(list, (item) => item.limitMinor);
  const used = sumMinor(list, (item) => item.usedMinor);
  return (
    <div>
      <PageHeader
        eyebrow="UPI"
        title="UPI Credit"
        description="Track UPI-linked credit lines, usage and remaining limit."
        actions={<Button onClick={() => setOpen(true)}>Add UPI Credit</Button>}
      />
      <Metrics
        items={[
          { label: "Total UPI credit limit", value: money(limit, currency) },
          { label: "Used", value: money(used, currency) },
          { label: "Remaining", value: money(Math.max(0, limit - used), currency) },
          { label: "Today's spend", value: money(sumMinor(list, (item) => item.todaySpendMinor), currency) },
        ]}
      />
      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((line) => {
            const pct = line.limitMinor ? Math.round((line.usedMinor / line.limitMinor) * 100) : 0;
            return (
              <Card key={line.id} className="oc-card">
                <div className="oc-featuretop">
                  <span className="oc-iconbox">
                    <Wallet size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3>{line.name}</h3>
                    <small className="text-[11px] text-[var(--muted-foreground)]">
                      {line.provider || "Credit line"}
                      {line.mask ? ` · ${line.mask}` : ""}
                    </small>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="px-3"
                      aria-label={`Edit ${line.name}`}
                      onClick={() => setEditing(line)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 hover:text-[var(--danger)]"
                      aria-label={`Delete ${line.name}`}
                      onClick={() => setDeleting(line)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                <div className="oc-credit-row">
                  <span>Used</span>
                  <b>{money(line.usedMinor, currency)}</b>
                </div>
                <ProgressBar value={pct} />
                <div className="mt-2 flex justify-between text-[11px] text-[var(--muted-foreground)]">
                  <span>Limit {money(line.limitMinor, currency)}</span>
                  <span>Available {money(Math.max(0, line.limitMinor - line.usedMinor), currency)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No UPI credit lines"
          description="Add a Paytm, PhonePe or Google Pay credit line to track usage."
          action={<Button onClick={() => setOpen(true)}>Add UPI Credit</Button>}
        />
      )}
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
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (initial) {
          onSave({
            name,
            provider: initial.provider ?? "Credit line",
            mask: initial.mask,
            limitMinor: majorToMinor(limit || "0"),
            usedMinor: used ? majorToMinor(used) : 0,
          });
          return;
        }
        onSave({
          kind: "UPI",
          name,
          provider: "Credit line",
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
          <option>Paytm UPI Credit</option>
          <option>PhonePe UPI Credit</option>
          <option>Google Pay UPI Credit</option>
          {initial &&
          !["Paytm UPI Credit", "PhonePe UPI Credit", "Google Pay UPI Credit"].includes(initial.name) ? (
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

export function LendView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const lends = useQuery({
    queryKey: ["lend-records"],
    queryFn: () => financeService.listLendRecords(),
    retry: false,
  });
  const [tab, setTab] = useState<"all" | "lent" | "borrowed" | "settled">("all");
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
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      financeService.patchLendRecord(id, body),
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
  if (profile.isLoading || lends.isLoading) return <PageSkeleton />;
  if (lends.isError) return <ErrorState retry={() => void lends.refetch()} />;
  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = lends.data ?? [];
  const rows = list.filter((item) => {
    if (tab === "all") return true;
    if (tab === "settled") return item.status === "settled";
    if (tab === "lent") return item.kind === "lent" && item.status !== "settled";
    return item.kind === "borrowed" && item.status !== "settled";
  });
  const lent = sumMinor(
    openLends(list).filter((item) => item.kind === "lent"),
    (item) => item.amountMinor,
  );
  const borrowed = sumMinor(
    openLends(list).filter((item) => item.kind === "borrowed"),
    (item) => item.amountMinor,
  );
  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Borrow / Lend"
        description="Track money you gave or borrowed, due dates and settlements."
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen("borrow")}>
              Borrowed
            </Button>
            <Button onClick={() => setOpen("lend")}>Lent Money</Button>
          </>
        }
      />
      <Metrics
        items={[
          { label: "Money lent", value: money(lent, currency) },
          { label: "Money borrowed", value: money(borrowed, currency) },
          { label: "Due to receive", value: money(lent, currency) },
          {
            label: "Overdue records",
            value: String(list.filter((item) => item.status === "due").length),
          },
        ]}
      />
      <Card className="oc-card">
        <div className="oc-borrowtabs">
          {(["all", "lent", "borrowed", "settled"] as const).map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : undefined} onClick={() => setTab(item)}>
              {item[0]!.toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="finance-tools-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Given</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button type="button" className="font-extrabold" onClick={() => setEditing(item)}>
                        {item.person}
                      </button>
                      <small className="mt-1 block text-[11px] text-[var(--muted-foreground)]">
                        {item.relation || "—"}
                      </small>
                    </td>
                    <td>{item.kind === "lent" ? "Lent" : "Borrowed"}</td>
                    <td>{money(item.amountMinor, currency)}</td>
                    <td>{displayDate(item.givenOn)}</td>
                    <td>{displayDate(item.dueOn)}</td>
                    <td>
                      <span className={`oc-status ${item.status === "settled" ? "allotted" : item.status === "due" ? "notallotted" : "pending"}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No records in this tab"
            description="Add money you lent or borrowed to keep due dates in one place."
          />
        )}
      </Card>
      <Modal open={open === "lend" || open === "borrow"} onClose={() => setOpen(null)} title={open === "borrow" ? "Record borrowed money" : "Record lent money"}>
        <LendForm
          kind={open === "borrow" ? "borrowed" : "lent"}
          currency={currency}
          pending={create.isPending}
          onSave={(body) => create.mutate(body)}
        />
      </Modal>
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? editing.person : "Record"}
      >
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
}: {
  kind: LendKind;
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
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
      <Field label="Person name">
        <Input value={person} onChange={(event) => setPerson(event.target.value)} required />
      </Field>
      <Field label="Relation">
        <Input value={relation} onChange={(event) => setRelation(event.target.value)} />
      </Field>
      <Field label="Amount">
        <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
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
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <Detail label="Type" value={record.kind === "lent" ? "Lent" : "Borrowed"} />
        <Detail label="Status" value={record.status} />
      </div>
      <Field label="Person name">
        <Input value={person} onChange={(event) => setPerson(event.target.value)} required />
      </Field>
      <Field label="Relation">
        <Input value={relation} onChange={(event) => setRelation(event.target.value)} />
      </Field>
      <Field label="Amount">
        <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
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

export function CoachView() {
  return (
    <div>
      <PageHeader
        eyebrow="Premium"
        title="AI Financial Coach"
        description="Ask questions about spending, saving, debt and goals. This coach unlocks with Hisaab Premium."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <Card className="oc-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="m-0 text-[18px] font-semibold">Ask Hisaab AI</h2>
            <ProLabel />
          </div>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            The live coach stays gated. Explore Premium for personalised recommendations. This page
            will not start a trial or change your plan.
          </p>
          <Button
            className="mt-4"
            onClick={() => toast.info("AI Financial Coach is included with Hisaab Premium.")}
          >
            <Sparkles size={16} /> Ask Hisaab AI
          </Button>
        </Card>
        <Card className="oc-card">
          <CardHead title="Suggested questions" />
          <div className="oc-actions">
            {[
              "Can I afford a ₹20,000 purchase?",
              "Which category should I reduce?",
              "How much should I invest monthly?",
            ].map((question) => (
              <button
                key={question}
                type="button"
                className="oc-action"
                onClick={() => toast.info("AI Financial Coach is included with Hisaab Premium.")}
              >
                {question}
              </button>
            ))}
          </div>
          <Link href="/premium" className="oc-link mt-4 inline-flex">
            Explore Premium <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--border)] p-3">
      <small className="block text-[11px] text-[var(--muted-foreground)]">{label}</small>
      <b className="mt-1 block text-sm">{value}</b>
    </div>
  );
}
