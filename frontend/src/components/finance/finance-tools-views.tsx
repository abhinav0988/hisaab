"use client";

import type {
  Investment,
  LendKind,
  LendRecord,
} from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CardHead, ProgressBar, ProLabel } from "@/components/layout/chrome";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { money } from "@/lib/format";
import {
  displayDate,
  isoPlusDays,
  isoToday,
  openLends,
  returnPct,
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

export function InvestmentsView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const investments = useQuery({
    queryKey: ["investments"],
    queryFn: () => financeService.listInvestments(),
    retry: false,
  });
  const [open, setOpen] = useState<"investment" | "sip" | Investment | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createInvestment(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["investments"] });
      setOpen(null);
      toast.success("Investment saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  if (profile.isLoading || investments.isLoading) return <PageSkeleton />;
  if (investments.isError) return <ErrorState retry={() => void investments.refetch()} />;
  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = investments.data ?? [];
  const invested = sumMinor(list, (item) => item.investedMinor);
  const current = sumMinor(list, (item) => item.currentMinor);
  const sip = sumMinor(list, (item) => item.sipMinor);
  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Investments"
        description="Track mutual funds, stocks, gold and SIPs against your live Hisaab account."
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen("sip")}>
              Add SIP
            </Button>
            <Button onClick={() => setOpen("investment")}>Add Investment</Button>
          </>
        }
      />
      <Metrics
        items={[
          { label: "Current value", value: money(current, currency), note: `${returnPct(invested, current)}% overall` },
          { label: "Invested amount", value: money(invested, currency) },
          { label: "Total gain", value: money(current - invested, currency) },
          { label: "Monthly SIP", value: money(sip, currency), note: `${list.filter((item) => item.sipMinor).length} active` },
        ]}
      />
      {list.length ? (
        <Card className="oc-card">
          <CardHead title="Portfolio" description="Holdings saved to your account" />
          <div className="table-scroll">
            <table className="finance-tools-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Invested</th>
                  <th>Current</th>
                  <th>Return</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button type="button" className="text-left font-extrabold" onClick={() => setOpen(item)}>
                        {item.name}
                      </button>
                      <small className="mt-1 block text-[11px] text-[var(--muted-foreground)]">
                        {item.detail || item.type}
                      </small>
                    </td>
                    <td>{item.type}</td>
                    <td>{money(item.investedMinor, currency)}</td>
                    <td>{money(item.currentMinor, currency)}</td>
                    <td className={returnPct(item.investedMinor, item.currentMinor) >= 0 ? "oc-pos" : "oc-neg"}>
                      {returnPct(item.investedMinor, item.currentMinor) >= 0 ? "+" : ""}
                      {returnPct(item.investedMinor, item.currentMinor)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No investments yet"
          description="Add a holding or SIP to track current value and returns here."
          action={<Button onClick={() => setOpen("investment")}>Add Investment</Button>}
        />
      )}
      <Modal
        open={open === "investment" || open === "sip"}
        onClose={() => setOpen(null)}
        title={open === "sip" ? "Add SIP" : "Add investment"}
      >
        <InvestmentForm
          sipOnly={open === "sip"}
          currency={currency}
          pending={create.isPending}
          onSave={(body) => create.mutate(body)}
        />
      </Modal>
      <Modal
        open={typeof open === "object" && open !== null}
        onClose={() => setOpen(null)}
        title={typeof open === "object" && open ? open.name : "Investment"}
      >
        {typeof open === "object" && open ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Invested" value={money(open.investedMinor, currency)} />
            <Detail label="Current value" value={money(open.currentMinor, currency)} />
            <Detail label="Return" value={`${returnPct(open.investedMinor, open.currentMinor)}%`} />
            <Detail label="SIP" value={open.sipMinor ? money(open.sipMinor, currency) : "None"} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function InvestmentForm({
  sipOnly,
  currency,
  pending,
  onSave,
}: {
  sipOnly: boolean;
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Mutual Fund");
  const [invested, setInvested] = useState("");
  const [current, setCurrent] = useState("");
  const [sip, setSip] = useState(sipOnly ? "" : "0");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const investedMinor = majorToMinor(invested || "0");
        const sipMinor = sip ? majorToMinor(sip) : 0;
        onSave({
          name: name || "New holding",
          type,
          detail: sipMinor ? `SIP ₹${sip}` : type,
          investedMinor,
          currentMinor: current ? majorToMinor(current) : investedMinor,
          sipMinor,
          sipDay: sipMinor ? "5th" : null,
          currency,
        });
      }}
    >
      <Field label="Name">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Fund or stock" required />
      </Field>
      <Field label="Type">
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option>Mutual Fund</option>
          <option>Stock</option>
          <option>Gold</option>
          <option>FD</option>
        </Select>
      </Field>
      <Field label="Invested">
        <Input type="number" min="0" step="0.01" value={invested} onChange={(event) => setInvested(event.target.value)} required />
      </Field>
      <Field label={sipOnly ? "Monthly SIP" : "Current value"}>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={sipOnly ? sip : current}
          onChange={(event) => (sipOnly ? setSip(event.target.value) : setCurrent(event.target.value))}
        />
      </Field>
      {!sipOnly ? (
        <Field label="Monthly SIP">
          <Input type="number" min="0" step="0.01" value={sip} onChange={(event) => setSip(event.target.value)} />
        </Field>
      ) : null}
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
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
  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createCreditFacility(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["credit-facilities"] });
      setOpen(false);
      toast.success("UPI credit saved");
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
                  <div>
                    <h3>{line.name}</h3>
                    <small className="text-[11px] text-[var(--muted-foreground)]">
                      {line.provider || "Credit line"}
                      {line.mask ? ` · ${line.mask}` : ""}
                    </small>
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
    </div>
  );
}

function UpiForm({
  currency,
  pending,
  onSave,
}: {
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
}) {
  const [name, setName] = useState("Paytm UPI Credit");
  const [limit, setLimit] = useState("");
  const [used, setUsed] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
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
  const [open, setOpen] = useState<"lend" | "borrow" | LendRecord | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createLendRecord(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["lend-records"] });
      setOpen(null);
      toast.success("Record saved");
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
                      <button type="button" className="font-extrabold" onClick={() => setOpen(item)}>
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
        open={typeof open === "object" && open !== null}
        onClose={() => setOpen(null)}
        title={typeof open === "object" && open ? open.person : "Record"}
      >
        {typeof open === "object" && open ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Amount" value={money(open.amountMinor, currency)} />
            <Detail label="Type" value={open.kind === "lent" ? "Lent" : "Borrowed"} />
            <Detail label="Given" value={displayDate(open.givenOn)} />
            <Detail label="Due" value={displayDate(open.dueOn)} />
          </div>
        ) : null}
      </Modal>
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
