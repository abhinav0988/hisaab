"use client";

import type {
  CreditFacility,
  Investment,
  IpoApplication,
  IpoStatus,
  LendKind,
  LendRecord,
  Loan,
} from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Landmark, Sparkles, Wallet } from "lucide-react";
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
  ipoStatusClass,
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

export function IpoView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const ipos = useQuery({ queryKey: ["ipos"], queryFn: () => financeService.listIpos(), retry: false });
  const [open, setOpen] = useState<"add" | IpoApplication | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createIpo(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["ipos"] });
      setOpen(null);
      toast.success("IPO saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  if (profile.isLoading || ipos.isLoading) return <PageSkeleton />;
  if (ipos.isError) return <ErrorState retry={() => void ipos.refetch()} />;
  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = ipos.data ?? [];
  const applied = sumMinor(list, (item) => item.amountMinor);
  return (
    <div>
      <PageHeader
        eyebrow="Applications"
        title="IPO Tracker"
        description="Follow applications from apply date through allotment and listing."
        actions={<Button onClick={() => setOpen("add")}>Add IPO</Button>}
      />
      <Metrics
        items={[
          { label: "Applied amount", value: money(applied, currency) },
          { label: "Active applications", value: String(list.length) },
          { label: "Allotted", value: String(list.filter((item) => item.status === "Allotted").length) },
          { label: "Listed", value: String(list.filter((item) => item.status === "Listed").length) },
        ]}
      />
      {list.length ? (
        <Card className="oc-card">
          <div className="table-scroll">
            <table className="finance-tools-table">
              <thead>
                <tr>
                  <th>IPO</th>
                  <th>Applied</th>
                  <th>Amount</th>
                  <th>Lots</th>
                  <th>Allotment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button type="button" className="font-extrabold" onClick={() => setOpen(item)}>
                        {item.name}
                      </button>
                    </td>
                    <td>{displayDate(item.appliedOn)}</td>
                    <td>{money(item.amountMinor, currency)}</td>
                    <td>{item.lots}</td>
                    <td>{displayDate(item.allotmentOn)}</td>
                    <td>
                      <span className={`oc-status ${ipoStatusClass(item.status)}`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No IPO applications"
          description="Add an application to track allotment status and amount blocked."
          action={<Button onClick={() => setOpen("add")}>Add IPO</Button>}
        />
      )}
      <Modal open={open === "add"} onClose={() => setOpen(null)} title="Add IPO application">
        <IpoForm currency={currency} pending={create.isPending} onSave={(body) => create.mutate(body)} />
      </Modal>
      <Modal
        open={typeof open === "object" && open !== null}
        onClose={() => setOpen(null)}
        title={typeof open === "object" && open ? open.name : "IPO"}
      >
        {typeof open === "object" && open ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Applied" value={displayDate(open.appliedOn)} />
            <Detail label="Amount" value={money(open.amountMinor, currency)} />
            <Detail label="Lots" value={String(open.lots)} />
            <Detail label="Status" value={open.status} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function IpoForm({
  currency,
  pending,
  onSave,
}: {
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [lots, setLots] = useState("1");
  const [status, setStatus] = useState<IpoStatus>("Applied");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          name: name || "New IPO",
          appliedOn: isoToday(),
          allotmentOn: isoPlusDays(10),
          amountMinor: majorToMinor(amount || "1"),
          lots: Number(lots) || 1,
          status,
          currency,
        });
      }}
    >
      <Field label="IPO name">
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field label="Lots">
        <Input type="number" min="1" value={lots} onChange={(event) => setLots(event.target.value)} />
      </Field>
      <Field label="Applied amount">
        <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </Field>
      <Field label="Status">
        <Select value={status} onChange={(event) => setStatus(event.target.value as IpoStatus)}>
          <option>Applied</option>
          <option>In progress</option>
          <option>Allotted</option>
          <option>Not Allotted</option>
          <option>Listed</option>
        </Select>
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function LoansView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const loans = useQuery({ queryKey: ["loans"], queryFn: () => financeService.listLoans(), retry: false });
  const [open, setOpen] = useState<"add" | Loan | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createLoan(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["loans"] });
      setOpen(null);
      toast.success("Loan saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  if (profile.isLoading || loans.isLoading) return <PageSkeleton />;
  if (loans.isError) return <ErrorState retry={() => void loans.refetch()} />;
  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = loans.data ?? [];
  const outstanding = sumMinor(list, (item) => item.outstandingMinor);
  const emi = sumMinor(list, (item) => item.emiMinor);
  return (
    <div>
      <PageHeader
        eyebrow="Debt"
        title="EMI & Loans"
        description="Track outstanding principal, EMI dates and progress."
        actions={<Button onClick={() => setOpen("add")}>Add Loan</Button>}
      />
      <Metrics
        items={[
          { label: "Outstanding", value: money(outstanding, currency) },
          { label: "Monthly EMI", value: money(emi, currency) },
          { label: "Next due", value: displayDate(list[0]?.dueOn) },
          { label: "Loans", value: String(list.length) },
        ]}
      />
      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((item) => (
            <Card key={item.id} className="oc-card">
              <div className="oc-featuretop">
                <span className="oc-iconbox">
                  <Landmark size={16} />
                </span>
                <div>
                  <h3>{item.name}</h3>
                  <small className="text-[11px] text-[var(--muted-foreground)]">
                    {item.lender} · {item.rate} p.a.
                  </small>
                </div>
              </div>
              <div className="mb-2 text-lg font-black">{money(item.emiMinor, currency)} / mo</div>
              <ProgressBar value={item.progress} />
              <div className="mt-2 flex justify-between text-[11px] text-[var(--muted-foreground)]">
                <span>Outstanding {money(item.outstandingMinor, currency)}</span>
                <span>Due {displayDate(item.dueOn)}</span>
              </div>
              <Button className="mt-3 w-full" variant="secondary" onClick={() => setOpen(item)}>
                View loan
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No loans yet"
          description="Add a home, car or personal loan to track EMI and outstanding principal."
          action={<Button onClick={() => setOpen("add")}>Add Loan</Button>}
        />
      )}
      <Modal open={open === "add"} onClose={() => setOpen(null)} title="Add loan">
        <LoanForm currency={currency} pending={create.isPending} onSave={(body) => create.mutate(body)} />
      </Modal>
      <Modal
        open={typeof open === "object" && open !== null}
        onClose={() => setOpen(null)}
        title={typeof open === "object" && open ? open.name : "Loan"}
      >
        {typeof open === "object" && open ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Outstanding" value={money(open.outstandingMinor, currency)} />
            <Detail label="EMI" value={money(open.emiMinor, currency)} />
            <Detail label="Rate" value={open.rate} />
            <Detail label="Remaining EMIs" value={String(open.remainingEmis)} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function LoanForm({
  currency,
  pending,
  onSave,
}: {
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
}) {
  const [name, setName] = useState("Home Loan");
  const [lender, setLender] = useState("");
  const [rate, setRate] = useState("10%");
  const [emi, setEmi] = useState("");
  const [outstanding, setOutstanding] = useState("");
  const [remaining, setRemaining] = useState("60");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const remainingEmis = Number(remaining) || 0;
        onSave({
          name,
          lender: lender || "Bank",
          rate: rate || "10%",
          emiMinor: majorToMinor(emi || "0"),
          outstandingMinor: majorToMinor(outstanding || "0"),
          dueOn: isoPlusDays(5),
          remainingEmis,
          progress: 0,
          currency,
        });
      }}
    >
      <Field label="Loan type">
        <Select value={name} onChange={(event) => setName(event.target.value)}>
          <option>Home Loan</option>
          <option>Car Loan</option>
          <option>Personal Loan</option>
        </Select>
      </Field>
      <Field label="Lender">
        <Input value={lender} onChange={(event) => setLender(event.target.value)} />
      </Field>
      <Field label="Interest rate">
        <Input value={rate} onChange={(event) => setRate(event.target.value)} />
      </Field>
      <Field label="Remaining EMIs">
        <Input type="number" min="0" value={remaining} onChange={(event) => setRemaining(event.target.value)} />
      </Field>
      <Field label="Monthly EMI">
        <Input type="number" min="0" step="0.01" value={emi} onChange={(event) => setEmi(event.target.value)} required />
      </Field>
      <Field label="Outstanding">
        <Input type="number" min="0" step="0.01" value={outstanding} onChange={(event) => setOutstanding(event.target.value)} required />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function CardsView() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
    retry: false,
  });
  const [open, setOpen] = useState<"add" | CreditFacility | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createCreditFacility(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["credit-facilities"] });
      setOpen(null);
      toast.success("Card saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  if (profile.isLoading || facilities.isLoading) return <PageSkeleton />;
  if (facilities.isError) return <ErrorState retry={() => void facilities.refetch()} />;
  const currency = profile.data?.defaultCurrency ?? "INR";
  const list = (facilities.data ?? []).filter((item) => item.kind === "CARD");
  const limit = sumMinor(list, (item) => item.limitMinor);
  const used = sumMinor(list, (item) => item.usedMinor);
  return (
    <div>
      <PageHeader
        eyebrow="Credit"
        title="Credit Cards"
        description="Track limits, utilisation, due dates and overdue amounts."
        actions={<Button onClick={() => setOpen("add")}>Add Card</Button>}
      />
      <Metrics
        items={[
          { label: "Total limit", value: money(limit, currency) },
          { label: "Used", value: money(used, currency) },
          { label: "Available", value: money(Math.max(0, limit - used), currency) },
          { label: "Overdue", value: money(sumMinor(list, (item) => item.overdueMinor), currency) },
        ]}
      />
      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((card) => {
            const pct = card.limitMinor ? Math.round((card.usedMinor / card.limitMinor) * 100) : 0;
            return (
              <Card key={card.id} className="oc-card">
                <div className="oc-featuretop">
                  <span className="oc-iconbox">
                    <CreditCard size={16} />
                  </span>
                  <div>
                    <h3>{card.name}</h3>
                    <small className="text-[11px] text-[var(--muted-foreground)]">
                      {card.mask || "Card"} · Due {displayDate(card.dueOn)}
                    </small>
                  </div>
                </div>
                <div className="oc-credit">
                  <div className="oc-credit-row">
                    <span>Used</span>
                    <b>
                      {money(card.usedMinor, currency)} ({pct}%)
                    </b>
                  </div>
                  <ProgressBar value={pct} tone={pct > 50 ? "warn" : "ok"} />
                  {card.overdueMinor ? (
                    <div className="oc-credit-row oc-overdue">
                      <span>Overdue</span>
                      <b>{money(card.overdueMinor, currency)}</b>
                    </div>
                  ) : null}
                </div>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => setOpen(card)}>
                  Open card
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No credit cards yet"
          description="Add a card to track limit, usage and statement due date."
          action={<Button onClick={() => setOpen("add")}>Add Card</Button>}
        />
      )}
      <Modal open={open === "add"} onClose={() => setOpen(null)} title="Add credit card">
        <CardForm currency={currency} pending={create.isPending} onSave={(body) => create.mutate(body)} />
      </Modal>
      <Modal
        open={typeof open === "object" && open !== null}
        onClose={() => setOpen(null)}
        title={typeof open === "object" && open ? open.name : "Card"}
      >
        {typeof open === "object" && open ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Limit" value={money(open.limitMinor, currency)} />
            <Detail label="Used" value={money(open.usedMinor, currency)} />
            <Detail label="Overdue" value={money(open.overdueMinor, currency)} />
            <Detail label="Due" value={displayDate(open.dueOn)} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function CardForm({
  currency,
  pending,
  onSave,
}: {
  currency: string;
  pending: boolean;
  onSave: (body: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [limit, setLimit] = useState("");
  const [used, setUsed] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          kind: "CARD",
          name: name || "New card",
          provider: null,
          mask: last4 ? `•••• ${last4.slice(-4)}` : null,
          limitMinor: majorToMinor(limit || "0"),
          usedMinor: used ? majorToMinor(used) : 0,
          todaySpendMinor: 0,
          overdueMinor: 0,
          dueOn: isoPlusDays(5),
          currency,
        });
      }}
    >
      <Field label="Card name">
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field label="Last 4 digits">
        <Input value={last4} onChange={(event) => setLast4(event.target.value)} maxLength={4} inputMode="numeric" />
      </Field>
      <Field label="Total limit">
        <Input type="number" min="0" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} required />
      </Field>
      <Field label="Used">
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
            Explore Premium →
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
