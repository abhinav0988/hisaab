"use client";
import type { SavingsGoal } from "@hisaab/types";
import { Badge, Button, Card, Field, Input } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CardHead, Insight, ProLabel, ProgressBar } from "@/components/layout/chrome";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { dateTime, money, signedMoney } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { goalService } from "@/services/goal.service";
import { profileService } from "@/services/profile.service";

type GoalStatus = "active" | "paused" | "completed" | "overdue";

function goalStatus(goal: SavingsGoal): GoalStatus {
  if (goal.savedAmountMinor >= goal.targetAmountMinor) return "completed";
  if (!goal.isActive) return "paused";
  if (goal.targetDate) {
    const end = goal.targetDate.length === 7 ? `${goal.targetDate}-28` : goal.targetDate;
    if (end < new Date().toISOString().slice(0, 10)) return "overdue";
  }
  return "active";
}

function statusBadge(status: GoalStatus) {
  switch (status) {
    case "completed":
      return { tone: "success" as const, label: "Completed" };
    case "paused":
      return { tone: "neutral" as const, label: "Paused" };
    case "overdue":
      return { tone: "danger" as const, label: "Overdue" };
    default:
      return { tone: "success" as const, label: "Active" };
  }
}

export function GoalsView() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [contribute, setContribute] = useState<SavingsGoal | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
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
  return (
    <div>
      <PageHeader
        eyebrow="Build your future"
        title="Savings goals"
        description="Turn everyday choices into meaningful progress."
        actions={
          <>
            <Button variant="secondary" onClick={() => toast.info("Auto-save is a Premium feature.")}>
              <RefreshCw size={16} aria-hidden="true" /> Auto-save <ProLabel />
            </Button>
            <Button onClick={() => setOpen(true)} disabled={missingTable}>
              <Plus size={16} aria-hidden="true" /> Create goal
            </Button>
          </>
        }
      />
      {missingTable ? (
        <EmptyState
          title="Goals will be ready after the next database update"
          description="The savings goals tables are in the schema. Once they are applied, you can create goals here."
        />
      ) : list.length ? (
        <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
          {list.map((goal) => {
            const pct = Math.round((goal.savedAmountMinor / goal.targetAmountMinor) * 100);
            const status = goalStatus(goal);
            const badge = statusBadge(status);
            return (
              <Card key={goal.id} className="interactive-card p-[22px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-[43px] place-items-center rounded-[14px] bg-[var(--mint)] text-lg text-[var(--primary)]">
                    {goal.icon}
                  </span>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <h3 className="mb-1 mt-[18px] text-sm font-semibold">{goal.name}</h3>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Target · {goal.targetDate ?? "No target date"}
                </div>
                <div className="my-3 text-lg font-black [overflow-wrap:anywhere]" aria-live="polite">
                  {money(goal.savedAmountMinor, goal.currency)}{" "}
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    of {money(goal.targetAmountMinor, goal.currency)}
                  </span>
                </div>
                <ProgressBar value={pct} />
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11px] text-[var(--muted-foreground)]">
                  <span>{pct}% complete</span>
                  <span>{goal.notes ?? "Choose a target date for a plan"}</span>
                </div>
                <div className="mt-[18px] grid gap-2">
                  {status !== "completed" && status !== "paused" ? (
                    <Button className="w-full" variant="secondary" onClick={() => setContribute(goal)}>
                      Add money
                    </Button>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      className="px-3"
                      onClick={() => setEditing(goal)}
                      aria-label={`Edit ${goal.name}`}
                    >
                      <Pencil size={16} />
                    </Button>
                    {goal.isActive ? (
                      <>
                        {status !== "completed" ? (
                          <Button
                            variant="ghost"
                            className="px-3"
                            disabled={lifecycle.isPending}
                            onClick={() => lifecycle.mutate({ id: goal.id, body: { isActive: false } })}
                            aria-label={`Pause ${goal.name}`}
                          >
                            <Pause size={16} />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          className="px-3"
                          disabled={lifecycle.isPending}
                          onClick={() =>
                            lifecycle.mutate({
                              id: goal.id,
                              body: {
                                isActive: false,
                                notes: goal.notes ?? "Completed",
                              },
                            })
                          }
                          aria-label={`Complete ${goal.name}`}
                        >
                          <Check size={16} />
                        </Button>
                      </>
                    ) : status !== "completed" ? (
                      <Button
                        variant="ghost"
                        className="px-3"
                        disabled={lifecycle.isPending}
                        onClick={() => lifecycle.mutate({ id: goal.id, body: { isActive: true } })}
                        aria-label={`Resume ${goal.name}`}
                      >
                        <Play size={16} />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      className="px-3 hover:text-[var(--danger)]"
                      onClick={() => setDeleting(goal)}
                      aria-label={`Delete ${goal.name}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No savings goals yet"
          description="Create a goal for an emergency fund, a trip, or anything you are saving toward."
          action={<Button onClick={() => setOpen(true)}>Create goal</Button>}
        />
      )}
      <div className="mt-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <Card className="p-[22px]">
          <CardHead
            title="Goal contribution history"
            description="Small deposits create momentum."
            action={
              <Button
                variant="secondary"
                disabled={!list.some((goal) => goal.isActive && goal.savedAmountMinor < goal.targetAmountMinor)}
                onClick={() =>
                  setContribute(
                    list.find((goal) => goal.isActive && goal.savedAmountMinor < goal.targetAmountMinor) ?? null,
                  )
                }
              >
                Add contribution
              </Button>
            }
          />
          {rows.length ? (
            rows.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--border)] py-3 last:border-0"
              >
                <span className="premium-icon-tile size-[38px] rounded-xl">
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
                <div>
                  <b className="block text-xs">{item.goalName ?? "Goal"}</b>
                  <small className="mt-0.5 block text-[var(--muted-foreground)]">
                    {item.source === "MANUAL" ? "Manual contribution" : item.source} ·{" "}
                    {dateTime(item.contributedAt)}
                  </small>
                </div>
                <span className="text-xs font-extrabold text-[var(--primary)]">
                  {signedMoney(item.amountMinor, currency, "INCOME")}
                </span>
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-[var(--muted-foreground)]">
              Contributions will appear here after you add money to a goal.
            </p>
          )}
        </Card>
        <Card className="p-[22px]">
          <CardHead title="Goal coach" description="Premium planning assistant" action={<ProLabel />} />
          <Insight
            gold
            icon={<Sparkles size={17} aria-hidden="true" />}
            title={
              list[0]
                ? `${list[0].name} can finish earlier`
                : "Keep a steady monthly amount"
            }
            body={
              list[0]
                ? `Adding a little more each month could finish ${list[0].name} weeks sooner without stretching this month’s budget.`
                : "Adding a little more each month can finish your first goal weeks sooner without stretching this month’s budget."
            }
          />
        </Card>
      </div>
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
      </Modal>
      <Modal
        open={Boolean(contribute)}
        onClose={() => setContribute(null)}
        title="Add contribution"
      >
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
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name,
        icon: icon.trim() || "*",
        currency,
        targetAmountMinor: majorToMinor(target),
        ...(initial
          ? {}
          : { savedAmountMinor: saved ? majorToMinor(saved) : 0 }),
        targetDate: date || null,
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
        <Input
          value={icon}
          maxLength={8}
          onChange={(event) => setIcon(event.target.value)}
          placeholder="*"
        />
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
