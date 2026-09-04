"use client";

import type { GoalContribution, SavingsGoal } from "@hisaab/types";
import { Button, Field, Input } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  Check,
  Gem,
  Home,
  Laptop,
  Moon,
  MoreVertical,
  Pause,
  Pencil,
  Plane,
  Play,
  Plus,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import { money, signedMoney } from "@/lib/format";
import { goalService } from "@/services/goal.service";
import { profileService } from "@/services/profile.service";
import "../../app/savings-goals.css";

type GoalStatus = "active" | "paused" | "completed" | "overdue";
type GoalTone = "green" | "gold" | "blue" | "purple";

function goalStatus(goal: SavingsGoal): GoalStatus {
  if (goal.savedAmountMinor >= goal.targetAmountMinor) return "completed";
  if (!goal.isActive) return "paused";
  if (goal.targetDate) {
    const end = goal.targetDate.length === 7 ? `${goal.targetDate}-28` : goal.targetDate;
    if (end < new Date().toISOString().slice(0, 10)) return "overdue";
  }
  return "active";
}

function monthLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

function goalTone(name: string, index: number): GoalTone {
  const lower = name.toLowerCase();
  if (lower.includes("emergency") || lower.includes("fund") || lower.includes("safety")) return "green";
  if (lower.includes("trip") || lower.includes("travel") || lower.includes("goa") || lower.includes("vacation"))
    return "gold";
  if (lower.includes("laptop") || lower.includes("gadget") || lower.includes("phone") || lower.includes("car"))
    return "blue";
  const tones: GoalTone[] = ["green", "gold", "blue", "purple"];
  return tones[index % tones.length]!;
}

function goalIconNode(name: string, icon: string) {
  const lower = name.toLowerCase();
  if (lower.includes("emergency") || lower.includes("fund") || lower.includes("safety")) return <Shield />;
  if (lower.includes("trip") || lower.includes("travel") || lower.includes("goa") || lower.includes("vacation"))
    return <Plane />;
  if (lower.includes("laptop") || lower.includes("computer") || lower.includes("gadget")) return <Laptop />;
  if (lower.includes("car") || lower.includes("bike") || lower.includes("vehicle")) return <Car />;
  if (lower.includes("home") || lower.includes("house") || lower.includes("rent")) return <Home />;
  if (icon && icon !== "*" && icon.length <= 3) return <span aria-hidden>{icon}</span>;
  return <Target />;
}

function goalDescription(goal: SavingsGoal) {
  if (goal.notes?.trim()) return goal.notes.trim();
  const lower = goal.name.toLowerCase();
  if (lower.includes("emergency")) return "6 months of essential expenses";
  if (lower.includes("trip") || lower.includes("goa")) return "Flights, stay and experiences";
  if (lower.includes("laptop")) return "Workstation upgrade";
  if (goal.targetDate) return `Target · ${goal.targetDate}`;
  return "Keep contributing to reach this milestone";
}

function percentTone(pct: number, tone: GoalTone) {
  if (pct >= 100) return "";
  if (tone === "gold") return " gold";
  if (tone === "blue") return " blue";
  if (tone === "purple") return " purple";
  return "";
}

function monthsUntil(targetDate: string | null) {
  if (!targetDate) return null;
  const end = targetDate.length === 7 ? `${targetDate}-28` : targetDate;
  const target = new Date(`${end.slice(0, 10)}T12:00:00`);
  const now = new Date();
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(0, months);
}

function contributionMonthKey(iso: string) {
  return iso.slice(0, 7);
}

export function GoalsView() {
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [contribute, setContribute] = useState<SavingsGoal | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const goals = useQuery({
    queryKey: ["goals"],
    queryFn: () => goalService.list(),
    retry: false,
  });
  const history = useQuery({
    queryKey: ["goal-contributions"],
    queryFn: () => goalService.contributions(),
    retry: false,
  });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["goals"] });
    void client.invalidateQueries({ queryKey: ["goal-contributions"] });
  };

  const lifecycle = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { isActive?: boolean; notes?: string | null };
    }) => goalService.update(id, body),
    onSuccess: (_, variables) => {
      const paused = variables.body.isActive === false;
      const completed = paused && variables.body.notes != null;
      toast.success(completed ? "Goal marked complete" : paused ? "Goal paused" : "Goal resumed");
      refresh();
    },
    onError: (cause) => {
      toast.error(cause instanceof ApiError ? cause.message : "Unable to update goal.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => goalService.remove(id),
    onSuccess: () => {
      toast.success("Goal deleted");
      setDeleting(null);
      setManageOpen(false);
      refresh();
    },
    onError: (cause) => {
      toast.error(cause instanceof ApiError ? cause.message : "Unable to delete goal.");
    },
  });

  if (profile.isLoading || goals.isLoading) return <PageSkeleton />;
  if (!profile.data) return <ErrorState retry={() => void profile.refetch()} />;

  const missingTable = goals.isError;
  const list = goals.data ?? [];
  const rows = history.data ?? [];
  const currency = profile.data.defaultCurrency;

  const activeGoals = list.filter((goal) => goalStatus(goal) !== "paused");
  const totalTarget = list.reduce((sum, goal) => sum + goal.targetAmountMinor, 0);
  const totalSaved = list.reduce((sum, goal) => sum + goal.savedAmountMinor, 0);
  const remaining = Math.max(0, totalTarget - totalSaved);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const nowMonth = new Date().toISOString().slice(0, 7);
  const prev = new Date();
  prev.setMonth(prev.getMonth() - 1);
  const prevMonth = prev.toISOString().slice(0, 7);
  const monthContrib = rows
    .filter((item) => contributionMonthKey(item.contributedAt) === nowMonth)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const prevContrib = rows
    .filter((item) => contributionMonthKey(item.contributedAt) === prevMonth)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const contribDelta = monthContrib - prevContrib;
  const contribDeltaPct =
    prevContrib > 0 ? Math.round((contribDelta / prevContrib) * 100) : monthContrib > 0 ? 100 : 0;

  const onTrackCount = list.filter((goal) => {
    const status = goalStatus(goal);
    return status === "active" || status === "completed";
  }).length;
  const attentionCount = list.filter((goal) => {
    const status = goalStatus(goal);
    return status === "overdue" || status === "paused";
  }).length;

  const monthsForAvg = Math.max(
    1,
    ...list.map((goal) => monthsUntil(goal.targetDate) ?? 6).filter((value) => value > 0),
    1,
  );
  const avgMonthlyNeeded = remaining > 0 ? Math.round(remaining / monthsForAvg) : 0;
  const nextContributionHint = rows[0]
    ? formatShortDate(rows[0].contributedAt)
    : "Add your first deposit";

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openContribute = (goal?: SavingsGoal | null) => {
    const target =
      goal ??
      list.find((item) => item.isActive && item.savedAmountMinor < item.targetAmountMinor) ??
      list[0] ??
      null;
    if (!target) {
      toast.info("Create a goal before adding a contribution.");
      openCreate();
      return;
    }
    setContribute(target);
  };

  return (
    <div className="sg31">
      <section className="sg31-header">
        <div className="sg31-header-left">
          <div className="sg31-page-icon">
            <Target />
          </div>
          <div>
            <h1>Savings Goals</h1>
            <p>Turn your plans into milestones and build them one contribution at a time.</p>
          </div>
        </div>
        <div className="sg31-header-actions">
          <button type="button" className="sg31-control">
            <CalendarDays /> {monthLabel()}
          </button>
          <button type="button" className="sg31-ghost sg31-notify" aria-label="Notifications" onClick={() => toast.info("No new savings alerts.")}>
            <Bell /><span />
          </button>
          <button type="button" className="sg31-ghost" aria-label="Theme settings" onClick={() => toast.info("Use Settings to change appearance.")}>
            <Moon />
          </button>
          <button type="button" className="sg31-ghost" aria-label="More goal options" onClick={() => setManageOpen(true)}>
            <MoreVertical />
          </button>
          <button type="button" className="sg31-primary" onClick={openCreate} disabled={missingTable}>
            <Plus /> New Goal
          </button>
        </div>
      </section>

      {missingTable ? (
        <EmptyState
          title="Goals will be ready after the next database update"
          description="The savings goals tables are in the schema. Once they are applied, you can create goals here."
        />
      ) : (
        <>
          <section className="sg31-kpis">
            <article className="sg31-kpi green">
              <div>
                <span className="eyebrow">Total Goal Value</span>
                <strong>{totalTarget ? money(totalTarget, currency) : "—"}</strong>
                <small>
                  Across {activeGoals.length || list.length} active goal
                  {(activeGoals.length || list.length) === 1 ? "" : "s"}
                </small>
              </div>
              <div className="sg31-kpi-icon">
                <Target />
              </div>
            </article>
            <article className="sg31-kpi gold">
              <div>
                <span className="eyebrow">Total Saved</span>
                <strong>{money(totalSaved, currency)}</strong>
                <small>
                  {totalTarget ? `${overallPct}% of combined targets reached` : "Create a goal to start tracking"}
                </small>
              </div>
              <div className="sg31-kpi-icon">
                <Wallet />
              </div>
            </article>
            <article className="sg31-kpi purple">
              <div>
                <span className="eyebrow">Monthly Contribution</span>
                <strong>
                  {money(monthContrib, currency)}
                  {contribDelta !== 0 ? (
                    <span className="delta">
                      {contribDelta >= 0 ? "↑" : "↓"} {Math.abs(contribDeltaPct)}%
                    </span>
                  ) : null}
                </strong>
                <small>
                  {contribDelta === 0
                    ? "No change vs last month"
                    : `${money(Math.abs(contribDelta), currency)} ${contribDelta >= 0 ? "more" : "less"} than last month`}
                </small>
              </div>
              <div className="sg31-kpi-icon">
                <BarChart3 />
              </div>
            </article>
            <article className="sg31-kpi blue">
              <div>
                <span className="eyebrow">Goals On Track</span>
                <strong>
                  {list.length ? `${onTrackCount} of ${list.length}` : "—"}
                </strong>
                <small>
                  {list.length
                    ? attentionCount
                      ? `${attentionCount} goal${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`
                      : "All goals looking healthy"
                    : "No goals yet"}
                </small>
              </div>
              <div className="sg31-kpi-icon">
                <Target />
              </div>
            </article>
          </section>

          <section className="sg31-topgrid">
            <article className="sg31-panel sg31-hero">
              <div className="sg31-hero-copy">
                <div className="sg31-overline">Small steps. Brighter tomorrows.</div>
                <h2>
                  Build the future <span>you deserve</span>
                </h2>
                <p>
                  Save for what matters — an emergency fund, a dream trip, a new gadget, or anything you care
                  about.
                </p>
                <div className="sg31-hero-actions">
                  <button type="button" className="sg31-primary" onClick={openCreate}>
                    <Plus /> Create a new goal
                  </button>
                </div>
              </div>
              <div className="sg31-hero-art" aria-hidden>
                <div className="sg31-art-pill a">
                  <Plane />
                  <span>Dream Trips</span>
                </div>
                <div className="sg31-art-pill b">
                  <Shield />
                  <span>Emergency Fund</span>
                </div>
                <div className="sg31-art-pill c">
                  <Car />
                  <span>New Car</span>
                </div>
                <div className="sg31-art-pill d">
                  <Home />
                  <span>Home</span>
                </div>
                <div className="sg31-jar">
                  <div className="sg31-leaf l1" />
                  <div className="sg31-leaf l2" />
                  <div className="sg31-leaf l3" />
                  <div className="sg31-jar-lid" />
                  <div className="sg31-jar-body" />
                  <div className="sg31-jar-label">
                    Better
                    <br />
                    Choices
                    <br />
                    Brighter
                    <br />
                    Tomorrow
                  </div>
                  <div className="sg31-coin c1" />
                  <div className="sg31-coin c2" />
                  <div className="sg31-coin c3" />
                </div>
              </div>
            </article>

            <article className="sg31-panel">
              <div className="sg31-panel-head">
                <div>
                  <h3>Goal Insights</h3>
                  <p>Smart insights from your savings journey.</p>
                </div>
              </div>
              <div className="sg31-insight-wrap">
                <div
                  className="sg31-donut"
                  style={{ "--progress": `${Math.min(100, overallPct)}%` } as CSSProperties}
                >
                  <div>
                    <strong>{totalTarget ? `${overallPct}%` : "—"}</strong>
                    <span>Overall Progress</span>
                  </div>
                </div>
                <div className="sg31-insight-list">
                  <div className="sg31-insight-line">
                    <div className="sg31-insight-icon">
                      <TrendingUp />
                    </div>
                    <div>
                      <b>{money(remaining, currency)}</b>
                      <small>Left to save</small>
                    </div>
                  </div>
                  <div className="sg31-insight-line">
                    <div className="sg31-insight-icon">
                      <CalendarDays />
                    </div>
                    <div>
                      <b>{nextContributionHint}</b>
                      <small>{rows[0] ? "Latest contribution" : "Next contribution"}</small>
                    </div>
                  </div>
                  <div className="sg31-insight-line">
                    <div className="sg31-insight-icon">
                      <BarChart3 />
                    </div>
                    <div>
                      <b>{avgMonthlyNeeded ? money(avgMonthlyNeeded, currency) : "—"}</b>
                      <small>Avg. monthly to reach goals</small>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="sg31-panel sg31-goals">
            <div className="sg31-panel-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div>
                <h3>Active Savings Goals</h3>
                <p>Track every target, deadline and remaining amount.</p>
              </div>
              <button type="button" className="sg31-ghost" onClick={() => setManageOpen(true)}>
                Manage goals
              </button>
            </div>
            {list.length ? (
              <div className="sg31-goalgrid">
                {list.map((goal, index) => {
                  const tone = goalTone(goal.name, index);
                  const pct = Math.min(
                    100,
                    Math.round((goal.savedAmountMinor / Math.max(1, goal.targetAmountMinor)) * 100),
                  );
                  const left = Math.max(0, goal.targetAmountMinor - goal.savedAmountMinor);
                  const status = goalStatus(goal);
                  return (
                    <article className={`sg31-goal ${tone}`} key={goal.id}>
                      <div className="sg31-goal-top">
                        <div className="sg31-goal-icon">{goalIconNode(goal.name, goal.icon)}</div>
                        <span className={`sg31-percent${percentTone(pct, tone)}`}>{pct}%</span>
                      </div>
                      <h4>{goal.name}</h4>
                      <div className="desc">{goalDescription(goal)}</div>
                      <div className="amount">
                        {money(goal.savedAmountMinor, goal.currency)}{" "}
                        <span>of {money(goal.targetAmountMinor, goal.currency)}</span>
                      </div>
                      <div className="sg31-progress">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <div className="sg31-goal-meta">
                        <b>
                          {status === "completed"
                            ? "Goal reached"
                            : `${money(left, goal.currency)} remaining`}
                        </b>
                        <span>{Math.max(0, 100 - pct)}% left</span>
                      </div>
                      <div className="sg31-goal-actions">
                        {status !== "completed" && status !== "paused" ? (
                          <button type="button" className="primary" onClick={() => setContribute(goal)}>
                            Contribute
                          </button>
                        ) : status === "paused" ? (
                          <button
                            type="button"
                            className="primary"
                            disabled={lifecycle.isPending}
                            onClick={() => lifecycle.mutate({ id: goal.id, body: { isActive: true } })}
                          >
                            Resume
                          </button>
                        ) : (
                          <button type="button" className="primary" onClick={() => setEditing(goal)}>
                            Details
                          </button>
                        )}
                        <button type="button" onClick={() => setEditing(goal)}>
                          Details
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No savings goals yet"
                description="Create a goal for an emergency fund, a trip, or anything you are saving toward."
                action={
                  <Button onClick={openCreate}>
                    <Plus size={16} /> Create goal
                  </Button>
                }
              />
            )}
          </section>

          <section className="sg31-bottom">
            <article className="sg31-panel">
              <div className="sg31-panel-head">
                <div>
                  <h3>Recent Contributions</h3>
                  <p>Your latest deposits across savings goals.</p>
                </div>
                <button type="button" className="sg31-ghost" onClick={() => openContribute()}>
                  View all
                </button>
              </div>
              <div className="sg31-history">
                {rows.length ? (
                  rows.slice(0, 6).map((item) => (
                    <HistoryRow key={item.id} item={item} goals={list} currency={currency} />
                  ))
                ) : (
                  <p className="sg31-empty">Contributions will appear here after you add money to a goal.</p>
                )}
              </div>
            </article>

            <article className="sg31-panel">
              <div className="sg31-panel-head">
                <div>
                  <h3>Quick Actions</h3>
                  <p>Common goal controls.</p>
                </div>
              </div>
              <div className="sg31-actions">
                <button type="button" className="sg31-action" onClick={openCreate}>
                  <span className="sg31-miniicon">
                    <Plus />
                  </span>
                  <span>
                    <b>Create a new goal</b>
                    <small>Start another savings target</small>
                  </span>
                  <ArrowRight />
                </button>
                <button type="button" className="sg31-action" onClick={() => openContribute()}>
                  <span className="sg31-miniicon">
                    <Wallet />
                  </span>
                  <span>
                    <b>Add contribution</b>
                    <small>Put money toward a goal</small>
                  </span>
                  <ArrowRight />
                </button>
                <button type="button" className="sg31-action" onClick={() => router.push("/reports")}>
                  <span className="sg31-miniicon">
                    <TrendingUp />
                  </span>
                  <span>
                    <b>View savings analytics</b>
                    <small>Explore progress and trends</small>
                  </span>
                  <ArrowRight />
                </button>
                <button type="button" className="sg31-action" onClick={() => setManageOpen(true)}>
                  <span className="sg31-miniicon">
                    <Target />
                  </span>
                  <span>
                    <b>Manage goals</b>
                    <small>Edit, pause or delete goals</small>
                  </span>
                  <ArrowRight />
                </button>
              </div>
              <div className="sg31-premium-strip">
                <div className="sg31-miniicon">
                  <Gem />
                </div>
                <div>
                  <b>Go further with Premium</b>
                  <small>Get advanced insights, smart recommendations and more.</small>
                </div>
                <button type="button" className="sg31-upgrade" onClick={() => router.push("/premium")}>
                  Upgrade Now
                </button>
              </div>
            </article>
          </section>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create savings goal">
        <GoalForm
          currency={currency}
          onSaved={() => {
            setOpen(false);
            toast.success("Goal created");
            refresh();
          }}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit savings goal">
        {editing ? (
          <GoalForm
            key={editing.id}
            currency={currency}
            initial={editing}
            onSaved={() => {
              setEditing(null);
              toast.success("Goal updated");
              refresh();
            }}
          />
        ) : null}
        {editing ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            {editing.isActive && goalStatus(editing) !== "completed" ? (
              <>
                <Button
                  variant="secondary"
                  disabled={lifecycle.isPending}
                  onClick={() => lifecycle.mutate({ id: editing.id, body: { isActive: false } })}
                >
                  <Pause size={16} /> Pause
                </Button>
                <Button
                  variant="secondary"
                  disabled={lifecycle.isPending}
                  onClick={() =>
                    lifecycle.mutate({
                      id: editing.id,
                      body: { isActive: false, notes: editing.notes ?? "Completed" },
                    })
                  }
                >
                  <Check size={16} /> Complete
                </Button>
              </>
            ) : goalStatus(editing) !== "completed" ? (
              <Button
                variant="secondary"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate({ id: editing.id, body: { isActive: true } })}
              >
                <Play size={16} /> Resume
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setContribute(editing)}>
              <Wallet size={16} /> Contribute
            </Button>
            <Button
              variant="ghost"
              className="hover:text-[var(--danger)]"
              onClick={() => {
                setDeleting(editing);
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(contribute)} onClose={() => setContribute(null)} title="Add contribution">
        {contribute ? (
          <ContributeForm
            goal={contribute}
            onSaved={async (nextSaved) => {
              setContribute(null);
              toast.success("Contribution added");
              if (nextSaved >= contribute.targetAmountMinor && contribute.isActive) {
                try {
                  await goalService.update(contribute.id, {
                    isActive: false,
                    notes: contribute.notes ?? "Completed",
                  });
                  toast.success("Goal marked complete");
                } catch {
                  /* contribution already saved */
                }
              }
              refresh();
            }}
          />
        ) : null}
      </Modal>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage goals">
        <div className="grid gap-3">
          {list.length ? (
            list.map((goal) => {
              const status = goalStatus(goal);
              return (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{goal.name}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {money(goal.savedAmountMinor, goal.currency)} of{" "}
                      {money(goal.targetAmountMinor, goal.currency)} · {status}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setManageOpen(false);
                      setEditing(goal);
                    }}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button variant="secondary" onClick={() => setDeleting(goal)}>
                    Delete
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">No goals yet.</p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setManageOpen(false);
                openCreate();
              }}
            >
              <Plus size={16} /> New goal
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? "goal"}?`}
        description="This removes the goal and its contribution history from your account. This cannot be undone."
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function HistoryRow({
  item,
  goals,
  currency,
}: {
  item: GoalContribution;
  goals: SavingsGoal[];
  currency: string;
}) {
  const goal = goals.find((entry) => entry.id === item.goalId);
  const name = item.goalName ?? goal?.name ?? "Goal";
  return (
    <div className="sg31-history-row">
      <div className="sg31-miniicon">{goalIconNode(name, goal?.icon ?? "*")}</div>
      <div>
        <b>{name}</b>
        <small>
          {formatShortDate(item.contributedAt)} ·{" "}
          {item.source === "MANUAL" ? "Manual contribution" : item.source}
        </small>
      </div>
      <strong>{signedMoney(item.amountMinor, currency, "INCOME")}</strong>
    </div>
  );
}

function GoalForm({
  currency,
  initial,
  onSaved,
}: {
  currency: string;
  initial?: SavingsGoal;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "*");
  const [target, setTarget] = useState(initial ? String(initial.targetAmountMinor / 100) : "");
  const [saved, setSaved] = useState(initial ? String(initial.savedAmountMinor / 100) : "0");
  const [date, setDate] = useState(initial?.targetDate?.slice(0, 7) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name,
        icon: icon.trim() || "*",
        currency,
        targetAmountMinor: majorToMinor(target),
        ...(initial ? {} : { savedAmountMinor: saved ? majorToMinor(saved) : 0 }),
        targetDate: date || null,
        notes: notes.trim() || null,
      };
      return initial ? goalService.update(initial.id, body) : goalService.create(body);
    },
    onSuccess: onSaved,
    onError: (cause) => {
      setError(cause instanceof ApiError ? cause.message : "Unable to save goal.");
    },
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Goal name">
        <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. New car" />
      </Field>
      <Field label="Icon">
        <Input value={icon} maxLength={8} onChange={(event) => setIcon(event.target.value)} placeholder="*" />
      </Field>
      <Field label="Target amount">
        <Input required inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
      </Field>
      {initial ? null : (
        <Field label="Already saved">
          <Input inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} />
        </Field>
      )}
      <Field label="Target date">
        <Input type="month" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <Field label="Notes">
        <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional description" />
      </Field>
      {error ? <p className="col-span-full text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="col-span-full flex justify-end">
        <Button disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : initial ? "Save changes" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}

function ContributeForm({
  goal,
  onSaved,
}: {
  goal: SavingsGoal;
  onSaved: (nextSaved: number) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => goalService.contribute(goal.id, { amountMinor: majorToMinor(amount) }),
    onSuccess: async (result) => {
      const nextSaved =
        result && typeof result === "object" && "savedAmountMinor" in result
          ? Number((result as { savedAmountMinor: number }).savedAmountMinor)
          : goal.savedAmountMinor + majorToMinor(amount);
      await onSaved(nextSaved);
    },
    onError: (cause) => {
      setError(cause instanceof ApiError ? cause.message : "Unable to add contribution.");
    },
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        Adding to <b>{goal.name}</b>
      </p>
      <Field label="Amount">
        <Input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <Button disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save contribution"}</Button>
    </form>
  );
}
