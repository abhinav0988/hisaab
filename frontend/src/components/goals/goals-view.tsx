"use client";
import type { SavingsGoal } from "@hisaab/types";
import { Button, Card, Field, Input } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Plus, RefreshCw, Sparkles } from "lucide-react";
import { CardHead, Insight, ProLabel, ProgressBar } from "@/components/layout/chrome";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { dateTime, money, signedMoney } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { goalService } from "@/services/goal.service";
import { profileService } from "@/services/profile.service";

export function GoalsView() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [contribute, setContribute] = useState<SavingsGoal | null>(null);
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
  if (profile.isLoading || goals.isLoading) return <PageSkeleton />;
  if (!profile.data) return <ErrorState retry={() => void profile.refetch()} />;
  const missingTable = goals.isError;
  const list = goals.data ?? [];
  const rows = history.data ?? [];
  const currency = profile.data.defaultCurrency;
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["goals"] });
    void client.invalidateQueries({ queryKey: ["goal-contributions"] });
  };
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
            return (
              <Card key={goal.id} className="interactive-card p-[22px]">
                <span className="grid size-[43px] place-items-center rounded-[14px] bg-[var(--mint)] text-lg text-[var(--primary)]">
                  {goal.icon}
                </span>
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
                <Button className="mt-[18px] w-full" variant="secondary" onClick={() => setContribute(goal)}>
                  Add money
                </Button>
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
                disabled={!list.length}
                onClick={() => setContribute(list[0] ?? null)}
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
      <Modal
        open={Boolean(contribute)}
        onClose={() => setContribute(null)}
        title="Add contribution"
      >
        {contribute ? (
          <ContributeForm
            goal={contribute}
            onSaved={() => {
              setContribute(null);
              toast.success("Contribution added");
              refresh();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function GoalForm({ currency, onSaved }: { currency: string; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("0");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      goalService.create({
        name,
        icon: "★",
        currency,
        targetAmountMinor: majorToMinor(target),
        savedAmountMinor: saved ? majorToMinor(saved) : 0,
        targetDate: date || null,
      }),
    onSuccess: onSaved,
    onError: (cause) => {
      setError(cause instanceof ApiError ? cause.message : "Unable to create goal.");
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
      <Field label="Target amount">
        <Input required inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
      </Field>
      <Field label="Already saved">
        <Input inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} />
      </Field>
      <Field label="Target date">
        <Input type="month" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      {error ? <p className="col-span-full text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="col-span-full flex justify-end">
        <Button disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Create goal"}</Button>
      </div>
    </form>
  );
}

function ContributeForm({ goal, onSaved }: { goal: SavingsGoal; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => goalService.contribute(goal.id, { amountMinor: majorToMinor(amount) }),
    onSuccess: onSaved,
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
