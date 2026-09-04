"use client";

import type { Investment } from "@hisaab/types";
import { Button, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CandlestickChart,
  CircleDollarSign,
  FileText,
  Gem,
  Landmark,
  Lightbulb,
  LineChart,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { returnPct, sumMinor } from "@/lib/finance-modules";
import { money } from "@/lib/format";
import { financeService } from "@/services/finance.service";
import { profileService } from "@/services/profile.service";
import "../../app/investments35.css";

type RangeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function withinRange(iso: string, range: RangeKey) {
  if (range === "ALL") return true;
  const created = new Date(iso).getTime();
  const now = Date.now();
  const days = range === "1M" ? 30 : range === "3M" ? 90 : range === "6M" ? 180 : 365;
  return now - created <= days * 24 * 60 * 60 * 1000;
}

function typeIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("stock") || lower.includes("etf")) return <CandlestickChart />;
  if (lower.includes("gold")) return <CircleDollarSign />;
  if (lower.includes("sip") || lower.includes("fd")) return <RefreshCw />;
  return <Landmark />;
}

export function InvestmentsView() {
  const router = useRouter();
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const investments = useQuery({
    queryKey: ["investments"],
    queryFn: () => financeService.listInvestments(),
    retry: false,
  });

  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeKey>("ALL");
  const [open, setOpen] = useState<"investment" | "sip" | null>(null);
  const [prefType, setPrefType] = useState<string | undefined>();
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);

  const create = useMutation({
    mutationFn: (body: unknown) => financeService.createInvestment(body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["investments"] });
      setOpen(null);
      setPrefType(undefined);
      toast.success("Investment saved");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      financeService.updateInvestment(id, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["investments"] });
      setEditing(null);
      toast.success("Investment updated");
    },
    onError: (error) => toast.error(failMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => financeService.deleteInvestment(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["investments"] });
      setDeleting(null);
      setEditing(null);
      toast.success("Investment removed");
    },
    onError: (error) => toast.error(failMessage(error)),
  });

  const list = investments.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      if (!withinRange(item.createdAt, range)) return false;
      if (!q) return true;
      return `${item.name} ${item.type} ${item.detail ?? ""}`.toLowerCase().includes(q);
    });
  }, [list, search, range]);

  const activity = useMemo(
    () =>
      [...list]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 5),
    [list],
  );

  if (profile.isLoading || investments.isLoading) return <PageSkeleton />;
  if (investments.isError) return <ErrorState retry={() => void investments.refetch()} />;

  const currency = profile.data?.defaultCurrency ?? "INR";
  const invested = sumMinor(list, (item) => item.investedMinor);
  const current = sumMinor(list, (item) => item.currentMinor);
  const gain = current - invested;
  const overall = returnPct(invested, current);
  const sip = sumMinor(list, (item) => item.sipMinor);
  const sipCount = list.filter((item) => item.sipMinor > 0).length;
  const suggestedSip = sip > 0 ? sip : 500000;

  const openCreate = (mode: "investment" | "sip" = "investment", type?: string) => {
    setPrefType(type);
    setOpen(mode);
  };

  return (
    <div className="iv35">
      <section className="iv35-head">
        <div className="iv35-head-left">
          <div className="iv35-page-icon">
            <TrendingUp />
          </div>
          <div>
            <h1>Investments</h1>
            <p>Track mutual funds, stocks, gold and SIPs against your Hisaab account.</p>
          </div>
        </div>
        <div className="iv35-head-actions">
          <label className="iv35-search">
            <Search />
            <input
              aria-label="Search investments"
              placeholder="Search investments..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="iv35-btn">
            <CalendarDays /> {monthLabel()}
          </button>
          <button type="button" className="iv35-btn primary" onClick={() => openCreate("investment")}>
            <Plus /> Add Investment
          </button>
        </div>
      </section>

      <section className="iv35-kpis">
        <article className="iv35-kpi green">
          <div>
            <span className="label">Current Value</span>
            <strong>{money(current, currency)}</strong>
            <small>
              <em className={overall < 0 ? "neg" : undefined}>
                {overall >= 0 ? "+" : ""}
                {overall}%
              </em>{" "}
              overall
            </small>
          </div>
          <div className="iv35-kpi-icon">
            <Wallet />
          </div>
        </article>
        <article className="iv35-kpi blue">
          <div>
            <span className="label">Invested Amount</span>
            <strong>{money(invested, currency)}</strong>
            <small>Total capital invested</small>
          </div>
          <div className="iv35-kpi-icon">
            <CircleDollarSign />
          </div>
        </article>
        <article className="iv35-kpi gold">
          <div>
            <span className="label">Total Gain</span>
            <strong>{money(gain, currency)}</strong>
            <small>
              <em className={overall < 0 ? "neg" : undefined}>
                {overall >= 0 ? "+" : ""}
                {overall}%
              </em>{" "}
              returns
            </small>
          </div>
          <div className="iv35-kpi-icon">
            <BarChart3 />
          </div>
        </article>
        <article className="iv35-kpi purple">
          <div>
            <span className="label">Monthly SIP</span>
            <strong>{money(sip, currency)}</strong>
            <small>
              {sipCount} active SIP{sipCount === 1 ? "" : "s"}
            </small>
          </div>
          <div className="iv35-kpi-icon">
            <RefreshCw />
          </div>
        </article>
      </section>

      <section className="iv35-top">
        <article className="iv35-panel iv35-hero">
          <div className="iv35-hero-copy">
            <div className="iv35-overline">Invest for a brighter tomorrow</div>
            <h2>
              Grow your wealth with <span>smart investments</span>
            </h2>
            <p>
              Invest in mutual funds, stocks, gold or start a SIP — all in one place. Track, analyse and build
              long-term wealth.
            </p>
            <div className="iv35-hero-actions">
              <button type="button" className="iv35-btn primary" onClick={() => openCreate("investment")}>
                <Plus /> {list.length ? "Add investment" : "Add your first investment"}
              </button>
              <button type="button" className="iv35-btn secondary" onClick={() => openCreate("sip")}>
                <CalendarDays /> Start a SIP
              </button>
            </div>
          </div>
          <div className="iv35-art" aria-hidden>
            <div className="iv35-art-base" />
            <div className="iv35-bar b1" />
            <div className="iv35-bar b2" />
            <div className="iv35-bar b3" />
            <div className="iv35-bar b4" />
            <div className="iv35-growline" />
            <div className="iv35-coin c1" />
            <div className="iv35-coin c2" />
            <div className="iv35-coin c3" />
            <div className="iv35-leaf l1" />
            <div className="iv35-leaf l2" />
          </div>
        </article>

        <aside className="iv35-panel">
          <div className="iv35-panel-head">
            <div>
              <h3>Explore Investment Options</h3>
              <p>Choose an asset class to get started.</p>
            </div>
          </div>
          <div className="iv35-options">
            <button type="button" className="iv35-option" onClick={() => openCreate("investment", "Mutual Fund")}>
              <span className="iv35-option-icon">
                <Landmark />
              </span>
              <span>
                <b>Mutual Funds</b>
                <small>Diversified funds with professional management</small>
              </span>
              <ArrowRight />
            </button>
            <button
              type="button"
              className="iv35-option blue"
              onClick={() => openCreate("investment", "Stock")}
            >
              <span className="iv35-option-icon">
                <CandlestickChart />
              </span>
              <span>
                <b>Stocks & ETFs</b>
                <small>Invest in listed companies and ETFs</small>
              </span>
              <ArrowRight />
            </button>
            <button
              type="button"
              className="iv35-option gold"
              onClick={() => openCreate("investment", "Gold")}
            >
              <span className="iv35-option-icon">
                <CircleDollarSign />
              </span>
              <span>
                <b>Gold</b>
                <small>Digital gold and other gold assets</small>
              </span>
              <ArrowRight />
            </button>
            <button type="button" className="iv35-option purple" onClick={() => openCreate("sip")}>
              <span className="iv35-option-icon">
                <RefreshCw />
              </span>
              <span>
                <b>Monthly SIP</b>
                <small>Build wealth automatically</small>
              </span>
              <ArrowRight />
            </button>
          </div>
        </aside>
      </section>

      <section className="iv35-mid">
        <article className="iv35-panel">
          <div className="iv35-panel-head">
            <div>
              <h3>Your Portfolio</h3>
              <p>
                {list.length
                  ? "Holdings, returns and portfolio performance."
                  : "Holdings, returns and portfolio performance will appear here."}
              </p>
            </div>
            <div className="iv35-tabs">
              {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`iv35-tab${range === key ? " active" : ""}`}
                  onClick={() => setRange(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <div className="iv35-holdings">
              {filtered.map((item) => {
                const pct = returnPct(item.investedMinor, item.currentMinor);
                return (
                  <div
                    key={item.id}
                    className="iv35-holding"
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditing(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setEditing(item);
                      }
                    }}
                  >
                    <div>
                      <b>{item.name}</b>
                      <small>
                        {item.type}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </small>
                    </div>
                    <div className="val">{money(item.investedMinor, currency)}</div>
                    <div className="val">{money(item.currentMinor, currency)}</div>
                    <div className={`ret${pct < 0 ? " neg" : ""}`}>
                      {pct >= 0 ? "+" : ""}
                      {pct}%
                    </div>
                    <button
                      type="button"
                      className="edit"
                      aria-label={`Edit ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditing(item);
                      }}
                    >
                      <Pencil />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : list.length ? (
            <div className="iv35-empty">
              <div className="iv35-emptybox">
                <div>
                  <div className="iv35-empty-icon">
                    <Search />
                  </div>
                  <h4>No matches in this view</h4>
                  <p>Try another search term or switch the portfolio range to ALL.</p>
                  <button type="button" className="iv35-btn primary" style={{ marginTop: 12 }} onClick={() => {
                    setSearch("");
                    setRange("ALL");
                  }}>
                    Reset filters
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="iv35-empty">
              <div className="iv35-emptybox">
                <div>
                  <div className="iv35-empty-icon">
                    <BarChart3 />
                  </div>
                  <h4>No investments yet</h4>
                  <p>
                    Add your first holding or SIP and Hisaab will start tracking invested value, current value and
                    returns automatically.
                  </p>
                  <button
                    type="button"
                    className="iv35-btn primary"
                    style={{ marginTop: 12 }}
                    onClick={() => openCreate("investment")}
                  >
                    <Plus /> Add Investment
                  </button>
                </div>
              </div>
            </div>
          )}
        </article>

        <aside className="iv35-panel">
          <div className="iv35-panel-head">
            <div>
              <h3>Investment Coach</h3>
              <p>Smart guidance for building a healthy portfolio.</p>
            </div>
            <span
              style={{
                fontSize: 8,
                fontWeight: 850,
                background: "#35290d",
                color: "#efc55e",
                padding: "4px 7px",
                borderRadius: 999,
              }}
            >
              PRO
            </span>
          </div>
          <div className="iv35-coach">
            <div className="iv35-coach-card">
              <div className="iv35-coach-top">
                <div className="iv35-coach-icon">
                  <Lightbulb />
                </div>
                <div>
                  <b>{sipCount ? "Keep your SIP streak going" : "Start small, stay consistent"}</b>
                  <span>
                    {sipCount
                      ? `You already have ${sipCount} active SIP${sipCount === 1 ? "" : "s"}. Consistency usually beats timing.`
                      : "A regular SIP can help you invest without trying to time the market."}
                  </span>
                </div>
              </div>
              <div className="iv35-sipline">
                <small>{sipCount ? "Your monthly SIP" : "Suggested starting SIP"}</small>
                <strong>{money(suggestedSip, currency)} / month</strong>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="iv35-bottom">
        <article className="iv35-panel">
          <div className="iv35-panel-head">
            <div>
              <h3>Recent Investment Activity</h3>
              <p>Your latest buys, SIPs and transactions.</p>
            </div>
            <button type="button" className="iv35-btn" onClick={() => openCreate("investment")}>
              View all
            </button>
          </div>
          {activity.length ? (
            <div className="iv35-activity">
              {activity.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="iv35-activity-row"
                  onClick={() => setEditing(item)}
                  style={{ width: "100%", background: "transparent", border: 0, color: "inherit", textAlign: "left" }}
                >
                  <div className="iv35-activity-icon">{typeIcon(item.type)}</div>
                  <div>
                    <b>{item.name}</b>
                    <small>
                      {item.type}
                      {item.sipMinor ? " · SIP" : ""} · {formatShortDate(item.updatedAt)}
                    </small>
                  </div>
                  <strong>{money(item.currentMinor, currency)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="iv35-activity-empty">
              <div>
                <div className="iv35-docicon">
                  <FileText />
                </div>
                <h4>No recent activity</h4>
                <p>Your investment transactions will appear here.</p>
              </div>
            </div>
          )}
        </article>

        <article className="iv35-panel">
          <div className="iv35-panel-head">
            <div>
              <h3>Quick Actions</h3>
              <p>Common investment tasks.</p>
            </div>
          </div>
          <div className="iv35-actions">
            <button type="button" className="iv35-action" onClick={() => openCreate("investment")}>
              <div className="iv35-action-icon">
                <Plus />
              </div>
              <b>Add Investment</b>
              <small>Add a new holding</small>
            </button>
            <button type="button" className="iv35-action" onClick={() => openCreate("sip")}>
              <div className="iv35-action-icon">
                <RefreshCw />
              </div>
              <b>Create SIP</b>
              <small>Set up a monthly SIP</small>
            </button>
            <button type="button" className="iv35-action" onClick={() => router.push("/reports")}>
              <div className="iv35-action-icon">
                <LineChart />
              </div>
              <b>View Analytics</b>
              <small>Track performance</small>
            </button>
            <button type="button" className="iv35-action" onClick={() => router.push("/goals")}>
              <div className="iv35-action-icon">
                <Target />
              </div>
              <b>Manage Goals</b>
              <small>Link to savings goals</small>
            </button>
          </div>
          <div className="iv35-premium">
            <div className="iv35-premium-icon">
              <Gem />
            </div>
            <div>
              <b>Get more with Premium</b>
              <small>Advanced insights, portfolio analysis, and personalized recommendations.</small>
            </div>
            <button type="button" className="iv35-upgrade" onClick={() => router.push("/premium")}>
              Upgrade Now →
            </button>
          </div>
        </article>
      </section>

      <Modal
        open={open === "investment" || open === "sip"}
        onClose={() => {
          setOpen(null);
          setPrefType(undefined);
        }}
        title={open === "sip" ? "Add SIP" : "Add investment"}
      >
        <InvestmentForm
          sipOnly={open === "sip"}
          preferredType={prefType}
          currency={currency}
          pending={create.isPending}
          onSave={(body) => create.mutate(body)}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : "Investment"}>
        {editing ? (
          <InvestmentForm
            key={editing.id}
            currency={currency}
            initial={editing}
            pending={update.isPending}
            onSave={(body) => update.mutate({ id: editing.id, body })}
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
        title={`Delete ${deleting?.name ?? "investment"}?`}
        description="This removes the holding from your portfolio. Historical account transactions are not changed."
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function InvestmentForm({
  sipOnly = false,
  preferredType,
  currency,
  initial,
  pending,
  onSave,
  onDelete,
}: {
  sipOnly?: boolean;
  preferredType?: string;
  currency: string;
  initial?: Investment;
  pending: boolean;
  onSave: (body: unknown) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? preferredType ?? "Mutual Fund");
  const [invested, setInvested] = useState(initial ? String(initial.investedMinor / 100) : "");
  const [current, setCurrent] = useState(initial ? String(initial.currentMinor / 100) : "");
  const [sip, setSip] = useState(initial ? String(initial.sipMinor / 100) : sipOnly ? "" : "0");

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
          sipDay: sipMinor ? initial?.sipDay ?? "5th" : null,
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
        <Input
          type="number"
          min="0"
          step="0.01"
          value={invested}
          onChange={(event) => setInvested(event.target.value)}
          required={!sipOnly}
        />
      </Field>
      <Field label={sipOnly && !initial ? "Monthly SIP" : "Current value"}>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={sipOnly && !initial ? sip : current}
          onChange={(event) =>
            sipOnly && !initial ? setSip(event.target.value) : setCurrent(event.target.value)
          }
          required={sipOnly && !initial}
        />
      </Field>
      {!sipOnly || initial ? (
        <Field label="Monthly SIP">
          <Input type="number" min="0" step="0.01" value={sip} onChange={(event) => setSip(event.target.value)} />
        </Field>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        {onDelete ? (
          <Button type="button" variant="danger" onClick={onDelete}>
            <Trash2 size={16} /> Delete
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
