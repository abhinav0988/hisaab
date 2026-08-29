"use client";
import type { Budget, Category } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CardHead, Insight, ProLabel, ProgressBar } from "@/components/layout/chrome";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { money } from "@/lib/format";
import { budgetService } from "@/services/budget.service";
import { categoryService } from "@/services/category.service";
import { profileService } from "@/services/profile.service";

const initialMonth = new Date().toISOString().slice(0, 7);

export function BudgetsView() {
  const client = useQueryClient();
  const [month, setMonth] = useState(initialMonth);
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const budgets = useQuery({
    queryKey: ["budgets", month],
    queryFn: () => budgetService.list(month),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.get(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => budgetService.remove(id),
    onSuccess: () => {
      toast.success("Budget deleted");
      setDeleting(null);
      void client.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
  if (budgets.isLoading || categories.isLoading || profile.isLoading) return <PageSkeleton />;
  if (!budgets.data || !categories.data || !profile.data)
    return <ErrorState retry={() => void budgets.refetch()} />;
  const done = () => {
    setOpen(false);
    setEditing(null);
    toast.success("Budget saved");
    void client.invalidateQueries({ queryKey: ["budgets"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const currency = profile.data.defaultCurrency;
  const overall = budgets.data.find((item) => !item.categoryId);
  const categoryLimits = budgets.data.filter((item) => item.categoryId);
  const scale = period === "weekly" ? 1 / 4.3 : 1;
  const totalLimit = Math.round((overall?.amountMinor ?? 0) * scale);
  const totalSpent = Math.round((overall?.spentMinor ?? 0) * scale);
  const totalLeft = totalLimit - totalSpent;
  const used = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const under = totalLeft > 0;
  return (
    <div>
      <PageHeader
        eyebrow="Spend intentionally"
        title="Spending limits"
        description="Flexible weekly and monthly limits that adapt to you."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => toast.info("Smart budget suggestions are a Premium feature.")}
            >
              ✦ Smart budget <ProLabel />
            </Button>
            <Button aria-label="Create budget" onClick={() => setOpen(true)}>
              ＋ New category limit
            </Button>
          </>
        }
      />
      <div className="grid gap-[18px] md:grid-cols-[1.1fr_.9fr]">
        <Card className="p-[22px]">
          <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="inline-flex w-full rounded-[11px] bg-[var(--muted)] p-1 sm:w-auto" role="group" aria-label="Limit period">
              {(["monthly", "weekly"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`min-h-11 flex-1 rounded-lg px-3 py-1.5 text-[11px] font-extrabold capitalize sm:flex-none ${
                    period === value
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)]"
                  }`}
                >
                  {value === "monthly" ? "Monthly" : "Weekly"}
                </button>
              ))}
            </div>
            <Input
              className="w-full sm:w-40"
              type="month"
              aria-label="Budget month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">
            Total {period} limit
          </div>
          <div className="mt-2.5 text-[clamp(26px,8vw,36px)] font-black tracking-[-0.04em] [overflow-wrap:anywhere]" aria-live="polite">
            {overall ? money(totalLimit, currency) : "—"}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            {overall ? (
              <>
                <b>{money(totalSpent, currency)}</b> spent · <b>{money(Math.max(0, totalLeft), currency)}</b>{" "}
                available
              </>
            ) : (
              "Create an overall monthly budget to see your safe-to-spend amount."
            )}
          </p>
          <ProgressBar className="mt-4" value={used} tone={used > 90 ? "danger" : used > 75 ? "warn" : "ok"} />
        </Card>
        <Card className="p-[22px]">
          <CardHead
            title={
              <>
                Smart forecast <ProLabel />
              </>
            }
            description="Based on current pace"
          />
          <Insight
            gold
            icon="✦"
            title={
              overall
                ? under
                  ? `Likely ${money(Math.abs(totalLeft), currency)} under budget`
                  : `Likely ${money(Math.abs(totalLeft), currency)} over budget`
                : "Add a monthly limit to forecast"
            }
            body="We continuously adjust your safe-to-spend amount as income and bills change."
          />
          <Button className="mt-3 w-full" variant="secondary" onClick={() => setForecastOpen(true)}>
            View forecast details
          </Button>
        </Card>
      </div>
      <Card className="mt-[18px] p-[22px]">
        <CardHead
          title="Category limits"
          description="Tap a category to review spending history."
          action={
            <button className="text-[11px] font-bold text-[var(--muted-foreground)]" onClick={() => setOpen(true)}>
              Manage all
            </button>
          }
        />
        {categoryLimits.length || overall ? (
          <div className="grid gap-4">
            {budgets.data.map((budget) => {
              const spent = Math.round(budget.spentMinor * scale);
              const limit = Math.round(budget.amountMinor * scale);
              const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
              return (
                <div key={budget.id}>
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-[11px]">
                    <b className="min-w-0 break-words">{budget.categoryName ?? "Overall monthly budget"}</b>
                    <span className="shrink-0">
                      {money(spent, currency)} / {money(limit, currency)}
                    </span>
                  </div>
                  <ProgressBar
                    value={pct}
                    tone={pct > 90 ? "danger" : pct > 75 ? "warn" : "ok"}
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[var(--muted-foreground)]">
                    <span>{pct}% used</span>
                    <span className="flex items-center gap-1">
                      {money(Math.max(0, limit - spent), currency)} left
                      <button
                        className="grid size-11 place-items-center rounded-lg hover:bg-[var(--muted)]"
                        aria-label={`Edit ${budget.categoryName ?? "overall"} budget`}
                        onClick={() => setEditing(budget)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="grid size-11 place-items-center rounded-lg hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        aria-label={`Delete ${budget.categoryName ?? "overall"} budget`}
                        onClick={() => setDeleting(budget)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No budgets for this month"
            description="Create an overall limit or a focused category budget."
            action={<Button onClick={() => setOpen(true)}>Create a budget</Button>}
          />
        )}
      </Card>
      <Modal
        open={open || Boolean(editing)}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit budget" : "Create category limit"}
      >
        <BudgetForm
          month={month}
          categories={categories.data.filter((item) => item.type === "EXPENSE")}
          initial={editing ?? undefined}
          onSaved={done}
        />
      </Modal>
      <Modal open={forecastOpen} onClose={() => setForecastOpen(false)} title="Cash-flow forecast · Premium">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="kpi-card p-4">
            <div className="text-[11px] text-[var(--muted-foreground)]">Projected income</div>
            <div className="mt-2 text-2xl font-black">{money(totalSpent + Math.max(0, totalLeft), currency)}</div>
          </Card>
          <Card className="kpi-card p-4">
            <div className="text-[11px] text-[var(--muted-foreground)]">Projected outflow</div>
            <div className="mt-2 text-2xl font-black">{money(totalSpent, currency)}</div>
          </Card>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
          Based on your current category limits and spending pace. Unlock Premium for a full
          month-end forecast.
        </p>
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.categoryName ?? "overall"} budget?`}
        description="This removes the limit for the selected month. Your transactions and spending history will not be changed."
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function BudgetForm({
  month,
  categories,
  initial,
  onSaved,
}: {
  month: string;
  categories: Category[];
  initial?: Budget;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : "");
  const [alert, setAlert] = useState(String(initial?.alertPercentage ?? 80));
  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? budgetService.update(initial.id, {
            amountMinor: Math.round(Number(amount) * 100),
            alertPercentage: Number(alert),
          })
        : budgetService.create({
            month,
            categoryId: categoryId || null,
            amountMinor: Math.round(Number(amount) * 100),
            alertPercentage: Number(alert),
          }),
    onSuccess: onSaved,
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      {!initial ? (
        <Field label="Category">
          <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Overall budget</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget amount">
          <Input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Warning at %">
          <Input
            required
            type="number"
            min={1}
            max={100}
            value={alert}
            onChange={(event) => setAlert(event.target.value)}
          />
        </Field>
      </div>
      {mutation.error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {mutation.error.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save budget"}
        </Button>
      </div>
    </form>
  );
}
