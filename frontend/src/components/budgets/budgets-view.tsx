"use client";

import type { Budget, Category } from "@hisaab/types";
import { Button, Field, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Car,
  ChevronDown,
  HeartPulse,
  Home,
  MoreVertical,
  Pencil,
  PieChart,
  Plus,
  Receipt,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { ImmersedNotifyButton, ImmersedThemeButton } from "@/components/layout/immersed-chrome";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { localDateKey, money } from "@/lib/format";
import { dayKeysEnding, spendByDay } from "@/lib/tx-insights";
import { budgetService } from "@/services/budget.service";
import { categoryService } from "@/services/category.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";
import "../../app/spending-limits.css";

const initialMonth = new Date().toISOString().slice(0, 7);
const TONES = ["green", "blue", "gold", "red", "purple"] as const;

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(year!, (mon ?? 1) - 1, 1),
  );
}

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year!, mon!, 0).getDate();
}

function elapsedDaysInMonth(month: string, now = new Date()) {
  const [year, mon] = month.split("-").map(Number);
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (month < current) return daysInMonth(month);
  if (month > current) return 1;
  return Math.max(1, now.getDate());
}

function categoryTone(name: string, index: number) {
  const lower = name.toLowerCase();
  if (lower.includes("food") || lower.includes("dining") || lower.includes("groc")) return "green";
  if (lower.includes("transport") || lower.includes("travel") || lower.includes("fuel")) return "blue";
  if (lower.includes("shop")) return "gold";
  if (lower.includes("hous") || lower.includes("rent") || lower.includes("home")) return "red";
  if (lower.includes("bill") || lower.includes("util") || lower.includes("health")) return "purple";
  return TONES[index % TONES.length]!;
}

function categoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("food") || lower.includes("dining") || lower.includes("groc")) return <UtensilsCrossed />;
  if (lower.includes("transport") || lower.includes("travel") || lower.includes("fuel") || lower.includes("car"))
    return <Car />;
  if (lower.includes("shop")) return <ShoppingBag />;
  if (lower.includes("hous") || lower.includes("rent") || lower.includes("home")) return <Home />;
  if (lower.includes("health") || lower.includes("fitness") || lower.includes("medical")) return <HeartPulse />;
  if (lower.includes("bill") || lower.includes("util")) return <Receipt />;
  return <Wallet />;
}

function categorySubtitle(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("food") || lower.includes("dining")) return "Dining, groceries & delivery";
  if (lower.includes("transport")) return "Fuel, metro, cabs & travel";
  if (lower.includes("shop")) return "Retail & online purchases";
  if (lower.includes("hous") || lower.includes("rent")) return "Rent, maintenance & home";
  if (lower.includes("bill") || lower.includes("util")) return "Mobile, electricity & subscriptions";
  if (lower.includes("health")) return "Medical, pharmacy & fitness";
  return "Category spending this period";
}

function compactMoney(minor: number, currency: string) {
  return money(minor, currency).replace(".00", "");
}

export function BudgetsView() {
  const router = useRouter();
  const client = useQueryClient();
  const [month, setMonth] = useState(initialMonth);
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

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

  const lookbackStart = localDateKey(
    new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 6),
  );
  const lookbackEnd = localDateKey(new Date());
  const paceQuery = useQuery({
    queryKey: ["budgets-pace", lookbackStart, lookbackEnd],
    queryFn: async () => {
      const from = new Date(`${lookbackStart}T00:00:00`).toISOString();
      const toDate = new Date(`${lookbackEnd}T00:00:00`);
      toDate.setDate(toDate.getDate() + 1);
      const result = await transactionService.list(
        new URLSearchParams({
          from,
          to: toDate.toISOString(),
          type: "EXPENSE",
          limit: "500",
          sort: "newest",
        }).toString(),
      );
      return result.data;
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => budgetService.remove(id),
    onSuccess: () => {
      toast.success("Budget deleted");
      setDeleting(null);
      setManageOpen(false);
      void client.invalidateQueries({ queryKey: ["budgets"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (budgets.isLoading || categories.isLoading || profile.isLoading) return <PageSkeleton />;
  if (!budgets.data || !categories.data || !profile.data)
    return <ErrorState retry={() => void budgets.refetch()} />;

  const done = () => {
    setOpen(false);
    setEditing(null);
    setManageOpen(false);
    toast.success("Budget saved");
    void client.invalidateQueries({ queryKey: ["budgets"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const currency = profile.data.defaultCurrency;
  const overall = budgets.data.find((item) => !item.categoryId);
  const categoryLimits = budgets.data.filter((item) => item.categoryId);
  const scale = period === "weekly" ? 1 / 4.3 : 1;

  const rawLimit =
    overall?.amountMinor ?? categoryLimits.reduce((sum, item) => sum + item.amountMinor, 0);
  const rawSpent =
    overall?.spentMinor ?? categoryLimits.reduce((sum, item) => sum + item.spentMinor, 0);
  const totalLimit = Math.round(rawLimit * scale);
  const totalSpent = Math.round(rawSpent * scale);
  const totalLeft = totalLimit - totalSpent;
  const usedPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 1000) / 10 : 0;
  const usedDisplay = Number.isInteger(usedPct) ? String(usedPct) : usedPct.toFixed(1);
  const under = totalLeft >= 0;
  const days = daysInMonth(month);
  const elapsed = elapsedDaysInMonth(month);
  const avgDaily = Math.round(totalSpent / elapsed);
  const dailyTarget = totalLimit > 0 ? Math.round(totalLimit / days) : 0;

  const dayKeys = dayKeysEnding(new Date(), 7);
  const paceDays = spendByDay(paceQuery.data ?? [], dayKeys);
  const paceTotal = paceDays.reduce((sum, item) => sum + item.minor, 0);
  const paceMax = Math.max(...paceDays.map((item) => item.minor), 1);

  const scaledCategories = categoryLimits.map((budget, index) => {
    const spent = Math.round(budget.spentMinor * scale);
    const limit = Math.round(budget.amountMinor * scale);
    const pct = limit ? Math.round((spent / limit) * 100) : 0;
    const name = budget.categoryName ?? "Category";
    return { budget, spent, limit, pct, name, tone: categoryTone(name, index) };
  });

  const insights = buildInsights(scaledCategories, {
    under,
    totalLeft,
    monthLabel: monthLabel(month),
    currency,
    daysLeft: Math.max(0, days - elapsed),
  });

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setOpen(true);
  };

  return (
    <div className="sl29">
      <header className="sl29-header">
        <div className="sl29-title-icon">
          <UtensilsCrossed />
        </div>
        <div className="sl29-title">
          <h2>Spending Limits</h2>
          <p>Set smart limits, track your spending, and stay in control.</p>
        </div>
        <div className="sl29-head-actions">
          <label className="sl29-date">
            <CalendarDays />
            <b>{monthLabel(month)}</b>
            <ChevronDown />
            <input
              type="month"
              aria-label="Budget month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <ImmersedNotifyButton className="sl29-icon-btn" emptyText="No new spending alerts." />
          <ImmersedThemeButton className="sl29-icon-btn" />
          <button type="button" className="sl29-icon-btn" aria-label="More spending limit options" onClick={() => setManageOpen(true)}>
            <MoreVertical />
          </button>
          <button type="button" className="sl29-add" onClick={openCreate}>
            <Plus />
            <b>Add Category Limit</b>
          </button>
        </div>
      </header>

      <section className="sl29-kpis">
        <article className="sl29-kpi k-green">
          <i>
            <Wallet />
          </i>
          <div>
            <label>Monthly Limit</label>
            <strong>{totalLimit ? money(totalLimit, currency) : "—"}</strong>
            <small>
              Across {categoryLimits.length} active categor
              {categoryLimits.length === 1 ? "y" : "ies"} limit
              {categoryLimits.length === 1 ? "" : "s"}
            </small>
          </div>
        </article>
        <article className="sl29-kpi k-red">
          <i>
            <Receipt />
          </i>
          <div>
            <label>Spent This Month</label>
            <strong>{money(totalSpent, currency)}</strong>
            <small>
              {totalLeft < 0
                ? `${money(Math.abs(totalLeft), currency)} over your monthly plan`
                : totalLimit
                  ? "Within your monthly plan"
                  : "Set a limit to track progress"}
            </small>
          </div>
        </article>
        <article className="sl29-kpi k-gold">
          <i>
            <PieChart />
          </i>
          <div>
            <label>Remaining Budget</label>
            <strong>{totalLimit ? money(totalLeft, currency) : "—"}</strong>
            <small>{totalLimit ? `${usedDisplay}% of total limit used` : "No overall plan yet"}</small>
          </div>
        </article>
        <article className="sl29-kpi k-blue">
          <i>
            <BarChart3 />
          </i>
          <div>
            <label>Avg. Daily Spend</label>
            <strong>{money(avgDaily, currency)}</strong>
            <small>
              {dailyTarget
                ? `${money(dailyTarget, currency)}/day target to stay on plan`
                : "Based on this month’s activity"}
            </small>
          </div>
        </article>
      </section>

      <section className="sl29-topgrid">
        <article className="sl29-panel sl29-progress-panel">
          <div className="sl29-section-head">
            <div>
              <h3>Overall Budget Progress</h3>
              <p>Your spending across all categories this {period === "weekly" ? "week" : "month"}.</p>
            </div>
          </div>
          <div className="sl29-progress-layout">
            <div
              className={`sl29-ring${!under && totalLimit ? " is-over" : ""}`}
              style={{ "--used": `${Math.min(usedPct, 100)}%` } as CSSProperties}
            >
              <div>
                <b>{totalLimit ? `${usedDisplay}%` : "—"}</b>
                <span>used</span>
              </div>
            </div>
            <div className="sl29-progress-stats">
              <div>
                <i className="dot green" />
                <span>Planned Limit</span>
                <b>{totalLimit ? money(totalLimit, currency) : "—"}</b>
              </div>
              <div>
                <i className="dot red" />
                <span>Total Spent</span>
                <b>{money(totalSpent, currency)}</b>
              </div>
              {totalLimit ? (
                under ? (
                  <div className="sl29-underbox">
                    <span>↓</span>
                    <div>
                      <small>Remaining</small>
                      <b>{money(totalLeft, currency)}</b>
                    </div>
                  </div>
                ) : (
                  <div className="sl29-overbox">
                    <span>↑</span>
                    <div>
                      <small>Over Budget</small>
                      <b>{money(Math.abs(totalLeft), currency)}</b>
                    </div>
                  </div>
                )
              ) : null}
            </div>
            <div className="sl29-track-card">
              <div className="sl29-wallet-art">
                <Wallet />
                <span />
              </div>
              <h4>{under ? "You're on track" : "Let's get back on track"}</h4>
              <p>
                {totalLimit
                  ? under
                    ? `${money(totalLeft, currency)} remains for this period. Keep pacing your daily spend.`
                    : "You have exceeded your monthly budget. Review category limits or reduce upcoming expenses."
                  : "Create an overall or category limit to start tracking your spending plan."}
              </p>
              <button type="button" onClick={openCreate}>
                Adjust Limits <ArrowRight />
              </button>
            </div>
          </div>
        </article>

        <article className="sl29-panel sl29-insights">
          <div className="sl29-section-head">
            <div>
              <h3>Spending Insights</h3>
              <p>This {period === "weekly" ? "week" : "month"}</p>
            </div>
            <div className="sl29-segment">
              <button type="button" className={period === "weekly" ? "active" : ""} onClick={() => setPeriod("weekly")}>
                Weekly
              </button>
              <button
                type="button"
                className={period === "monthly" ? "active" : ""}
                onClick={() => setPeriod("monthly")}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="sl29-insight-list">
            {insights.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                type="button"
                onClick={() => (item.budget ? openEdit(item.budget) : openCreate())}
              >                <i className={item.tone}>{item.icon}</i>
                <span>
                  <b>{item.title}</b>
                  <small>{item.text}</small>
                </span>
                <ArrowRight />
              </button>
            ))}
          </div>
        </article>
      </section>

      <article className="sl29-panel sl29-categories">
        <div className="sl29-section-head">
          <div>
            <h3>Category Spending Limits</h3>
            <p>See exactly where each budget stands this month.</p>
          </div>
          <button type="button" className="sl29-manage" onClick={() => setManageOpen(true)}>
            <SlidersHorizontal />
            <b>Manage Limits</b>
          </button>
        </div>
        {scaledCategories.length ? (
          <div className="sl29-cat-grid">
            {scaledCategories.map(({ budget, spent, limit, pct, name, tone }) => {
              const rem = limit - spent;
              const barTone = pct >= 100 ? "red" : pct >= 85 ? "gold" : "green";
              return (
                <div
                  className="sl29-cat"
                  key={budget.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(budget)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEdit(budget);
                    }
                  }}
                >
                  <div className="sl29-cat-head">
                    <i className={tone}>{categoryIcon(name)}</i>
                    <div>
                      <b>{name}</b>
                      <small>{categorySubtitle(name)}</small>
                    </div>
                    <span className={`pct${pct >= 100 ? " danger" : pct >= 85 ? " warn" : ""}`}>{pct}%</span>
                  </div>
                  <div className="sl29-cat-amount">
                    <strong>{money(spent, currency)}</strong>
                    <span>of {money(limit, currency)}</span>
                  </div>
                  <div className="sl29-bar">
                    <i className={barTone} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="sl29-cat-foot">
                    <b className={pct >= 100 ? "red" : "green"}>
                      {pct >= 100
                        ? `${money(Math.abs(rem), currency)} over`
                        : `${money(rem, currency)} remaining`}
                    </b>
                    <span>{Math.max(0, 100 - pct)}% left</span>
                    <div className="sl29-cat-actions" onClick={(event) => event.stopPropagation()}>
                      <button type="button" aria-label={`Edit ${name}`} onClick={() => openEdit(budget)}>
                        <Pencil />
                      </button>
                      <button type="button" aria-label={`Delete ${name}`} onClick={() => setDeleting(budget)}>
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No category limits yet"
            description="Create a focused limit to start tracking your spending."
            action={
              <Button onClick={openCreate}>
                <Plus size={16} /> Add category limit
              </Button>
            }
          />
        )}
      </article>

      <section className="sl29-bottomgrid">
        <article className="sl29-panel sl29-pace">
          <div className="sl29-section-head">
            <div>
              <h3>7-Day Spending Pace</h3>
              <p>Daily expense totals compared with your target pace.</p>
            </div>
            <div className="sl29-total">
              <b>{money(paceTotal, currency)}</b>
              <span>Last 7 days</span>
            </div>
          </div>
          <div className="sl29-bars">
            {paceDays.map((day) => {
              const overPace = dailyTarget > 0 && day.minor > dailyTarget;
              const height = Math.max(18, Math.round((day.minor / paceMax) * 122));
              return (
                <div className="sl29-day" key={day.key} title={money(day.minor, currency)}>
                  <b>{day.minor ? compactMoney(day.minor, currency) : "—"}</b>
                  <i className={overPace ? "gold" : ""} style={{ height }} />
                  <small>{day.label}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="sl29-panel sl29-actions">
          <div className="sl29-section-head">
            <div>
              <h3>Quick Actions</h3>
              <p>Common budget controls.</p>
            </div>
          </div>
          <div className="sl29-action-grid">
            <button type="button" onClick={openCreate}>
              <i>
                <Plus />
              </i>
              <b>Add category limit</b>
              <span>Create a new spending cap</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (overall) openEdit(overall);
                else if (categoryLimits[0]) openEdit(categoryLimits[0]);
                else openCreate();
              }}
            >
              <i>
                <Pencil />
              </i>
              <b>Adjust monthly plan</b>
              <span>Update existing limits</span>
            </button>
            <button type="button" onClick={() => router.push("/reports")}>
              <i>
                <BarChart3 />
              </i>
              <b>View spending analytics</b>
              <span>Explore trends and categories</span>
            </button>
          </div>
        </article>
      </section>

      <Modal
        open={open || Boolean(editing)}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? (editing.categoryId ? "Edit category limit" : "Edit overall budget") : "Create spending limit"}
      >
        <BudgetForm
          month={month}
          categories={categories.data.filter((item) => item.type === "EXPENSE")}
          initial={editing ?? undefined}
          onSaved={done}
        />
      </Modal>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage Limits">
        <div className="grid gap-3">
          {budgets.data.length ? (
            budgets.data.map((budget) => (
              <div
                key={budget.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{budget.categoryName ?? "Overall budget"}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {money(budget.spentMinor, currency)} of {money(budget.amountMinor, currency)} ·{" "}
                    {Math.round(budget.percentageUsed)}% used
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setManageOpen(false);
                    openEdit(budget);
                  }}
                >
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => setDeleting(budget)}>
                  Delete
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">No limits for {monthLabel(month)} yet.</p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setManageOpen(false);
                openCreate();
              }}
            >
              <Plus size={16} /> Add limit
            </Button>
          </div>
        </div>
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

function buildInsights(
  categories: Array<{ budget: Budget; spent: number; limit: number; pct: number; name: string }>,
  opts: {
    under: boolean;
    totalLeft: number;
    monthLabel: string;
    currency: string;
    daysLeft: number;
  },
) {
  const items: Array<{ title: string; text: string; tone: string; icon: ReactNode; budget?: Budget }> = [];

  if (!opts.under) {
    items.push({
      title: "Overall budget exceeded",
      text: `You are ${money(Math.abs(opts.totalLeft), opts.currency)} above the ${opts.monthLabel} plan.`,
      tone: "red",
      icon: <AlertTriangle />,
    });
  } else {
    items.push({
      title: "Budget is healthy",
      text:
        opts.totalLeft > 0
          ? `${money(opts.totalLeft, opts.currency)} is still available this period.`
          : "Set a monthly or category limit to unlock insights.",
      tone: "green",
      icon: <Wallet />,
    });
  }

  const nearly = [...categories].filter((item) => item.pct >= 85).sort((a, b) => b.pct - a.pct)[0];
  if (nearly) {
    items.push({
      title: `${nearly.name} is nearly full`,
      text: `${nearly.pct}% used with ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"} remaining.`,
      tone: "gold",
      icon: categoryIcon(nearly.name),
      budget: nearly.budget,
    });
  }

  const healthy = [...categories].filter((item) => item.pct < 70 && item.limit > 0).sort((a, b) => a.pct - b.pct)[0];
  if (healthy) {
    items.push({
      title: `${healthy.name} budget is healthy`,
      text: `${money(healthy.limit - healthy.spent, opts.currency)} is still available this month.`,
      tone: "green",
      icon: categoryIcon(healthy.name),
      budget: healthy.budget,
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Smart budget suggestions",
      text: "Review your category limits to improve your spending pace.",
      tone: "gold",
      icon: <SlidersHorizontal />,
    });
  } else if (items.length < 3) {
    items.push({
      title: "Improve spending pace",
      text: "Add or adjust category limits so Hisaab can guide weekly spend.",
      tone: "gold",
      icon: <SlidersHorizontal />,
    });
  }

  return items.slice(0, 3);
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
    onError: (error: Error) => toast.error(error.message),
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
        <Button disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save budget"}</Button>
      </div>
    </form>
  );
}
