"use client";
import type { Category, CreditSpendImpact, Transaction } from "@hisaab/types";
import { Button, Card, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Headset,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CardHead, Eyebrow } from "@/components/layout/chrome";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { EmptyState, ErrorState, NoResults, PageSkeleton } from "@/components/layout/states";
import { CategoryGlyph } from "@/components/finance/category-glyph";
import { dayGroupLabel, money, signedMoney, transactionStamp } from "@/lib/format";
import { accountDisplayName, resolveAccountLabel, tidyAccountLabel, accountsForTransactions } from "@/lib/accounts";
import { creditSpendCopy } from "@/lib/finance-modules";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";
import { TransactionForm } from "./transaction-form";

const FEATURED_CATEGORY_NAMES = [
  "Education",
  "Entertainment",
  "Family",
  "Food and Dining",
  "Groceries",
  "Healthcare",
];

function periodBounds(period: string) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return { from: startOfDay.toISOString().slice(0, 10), to: startOfDay.toISOString().slice(0, 10) };
  if (period === "week") {
    const from = new Date(startOfDay);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().slice(0, 10), to: startOfDay.toISOString().slice(0, 10) };
  }
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: startOfDay.toISOString().slice(0, 10) };
  }
  return { from: "", to: "" };
}

export function TransactionsView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [manualAdd, setManualAdd] = useState(false);
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const add = manualAdd || searchParams.has("action");
  const defaultType = searchParams.get("action") === "income" ? "INCOME" : "EXPENSE";
  const defaultBankAccountId = searchParams.get("bank_account") ?? searchParams.get("bank") ?? "";
  const closeAdd = () => {
    setManualAdd(false);
    if (searchParams.has("action")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("action");
      const qs = next.toString();
      router.replace(qs ? `/transactions?${qs}` : "/transactions");
    }
  };
  const { from, to } = periodBounds(period);
  const filters = useMemo(() => {
    const value = new URLSearchParams({ page: String(page), limit: "20", sort });
    if (search) value.set("search", search);
    if (type) value.set("type", type);
    if (category) value.set("category_id", category);
    if (account) value.set("account_id", account);
    if (from) value.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) value.set("to", new Date(`${to}T23:59:59`).toISOString());
    return value.toString();
  }, [page, sort, search, type, category, account, from, to]);
  const transactions = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => transactionService.list(filters),
  });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountService.list() });
  const bankAccounts = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => accountService.listBanks(),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const remove = useMutation({
    mutationFn: (id: string) => transactionService.remove(id),
    onSuccess: () => {
      toast.success("Transaction deleted");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-facilities"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-dashboard"] });
    },
  });
  if (transactions.isLoading || accounts.isLoading || bankAccounts.isLoading || categories.isLoading || profile.isLoading)
    return <PageSkeleton />;
  if (
    transactions.isError ||
    !transactions.data ||
    !accounts.data ||
    !bankAccounts.data ||
    !categories.data ||
    !profile.data
  )
    return <ErrorState retry={() => void transactions.refetch()} />;
  const currency = profile.data.defaultCurrency;
  const { channelOptions, bankAccounts: banks, allAccounts } = accountsForTransactions(
    accounts.data,
    bankAccounts.data,
  );
  const saved = (credit?: CreditSpendImpact | null, bankMessage?: string) => {
    closeAdd();
    setEditing(null);
    toast.success(
      credit ? creditSpendCopy(credit, currency) : bankMessage ?? "Transaction saved",
    );
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["credit-facilities"] });
    void queryClient.invalidateQueries({ queryKey: ["credit-dashboard"] });
  };
  const resetFilters = () => {
    setSearch("");
    setType("");
    setCategory("");
    setAccount("");
    setPeriod("all");
    setPage(1);
  };
  const rows = transactions.data.data;
  const groups = groupByDate(rows);
  const { featured, extra } = splitCategoryChips(categories.data);
  const visibleCategories = showMoreCategories ? [...featured, ...extra] : featured;
  const periodLabel =
    period === "all" ? "All dates" : period === "month" ? "This month" : period === "week" ? "This week" : "Today";
  const typeLabel = type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expense" : "All types";
  return (
    <div>
      <header className="tx-hero">
        <div>
          <Eyebrow>Money movement</Eyebrow>
          <h1 className="m-0 text-[clamp(26px,7vw,38px)] font-semibold leading-[1.08] tracking-[-0.055em]">
            Transactions
          </h1>
          <p className="mt-[9px] max-w-[620px] text-[14px] leading-[1.65] text-[var(--muted-foreground)]">
            Search, filter, review, and maintain every expense and income with a cleaner premium layout.
          </p>
        </div>
        <div className="tx-hero-side">
          <div className="tx-hero-art" aria-hidden>
            <picture>
              <source srcSet="/images/transactions-hero-wallet.webp" type="image/webp" />
              <img
                src="/images/transactions-hero-wallet.png"
                alt=""
                width={720}
                height={480}
              />
            </picture>
          </div>
          <div className="tx-hero-actions">
            <Button variant="secondary" onClick={() => exportCsv(rows)}>
              <Download size={16} />
              Export CSV
            </Button>
            <Button onClick={() => setManualAdd(true)}>
              <Plus size={17} />
              Add transaction
            </Button>
          </div>
        </div>
      </header>
      <Card className="transaction-filters-card p-[22px]">
        <CardHead
          title={
            <span className="inline-flex items-center gap-2">
              Smart filters
              <Sparkles size={16} className="text-[var(--primary)]" aria-hidden />
            </span>
          }
          description="Use search, period, type, account, and category filters to find entries clearly."
          action={
            <button
              type="button"
              className="min-h-11 text-[11px] font-bold text-[var(--muted-foreground)]"
              onClick={resetFilters}
            >
              Reset all
            </button>
          }
        />
        <div className="filters-grid">
          <label className="filter-field">
            <span>Search</span>
            <div className="date-shell">
              <span className="calendar-icon" aria-hidden>
                <Search size={13} />
              </span>
              <Input
                placeholder="Search merchant, category, note or account..."
                aria-label="Search merchant or notes"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </label>
          <label className="filter-field">
            <span>Period</span>
            <div className="date-shell">
              <span className="calendar-icon" aria-hidden>
                <CalendarDays size={13} />
              </span>
              <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
                <option value="all">All dates</option>
                <option value="month">This month</option>
                <option value="week">This week</option>
                <option value="today">Today</option>
              </Select>
            </div>
          </label>
          <label className="filter-field">
            <span>Type</span>
            <Select aria-label="Transaction type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All types</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </Select>
          </label>
          <label className="filter-field">
            <span>Account</span>
            <Select aria-label="Account" value={account} onChange={(event) => setAccount(event.target.value)}>
              <option value="">All accounts</option>
              {allAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {accountDisplayName(item)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="chip-row tx-category-row">
          <CategoryFilterChip
            active={!category}
            onClick={() => {
              setCategory("");
              setPage(1);
            }}
            icon={<Layers size={14} />}
          >
            All categories
          </CategoryFilterChip>
          {visibleCategories.map((item) => (
            <CategoryFilterChip
              key={item.id}
              active={category === item.id}
              colour={item.colour}
              onClick={() => {
                setCategory(item.id);
                setPage(1);
              }}
              icon={<CategoryGlyph name={item.icon} size={14} />}
            >
              {item.name}
            </CategoryFilterChip>
          ))}
          {extra.length ? (
            <CategoryFilterChip
              active={showMoreCategories}
              onClick={() => setShowMoreCategories((value) => !value)}
            >
              {showMoreCategories ? "Show less" : `+ More`}
            </CategoryFilterChip>
          ) : null}
        </div>
        <div className="tx-summary">
          <div>
            <b>
              Showing {Number(transactions.data.meta?.total ?? rows.length)} transaction
              {Number(transactions.data.meta?.total ?? rows.length) === 1 ? "" : "s"}
            </b>
            <small>
              Category: {categories.data.find((item) => item.id === category)?.name ?? "All"} · Period:{" "}
              {periodLabel} · Type: {typeLabel}
            </small>
          </div>
          <Button
            variant="secondary"
            className="bg-[var(--mint)] hover:bg-[color-mix(in_srgb,var(--mint)_80%,var(--surface))]"
            onClick={() => setManualAdd(true)}
          >
            <Plus size={16} aria-hidden="true" /> New transaction
          </Button>
        </div>
      </Card>
      {rows.length ? (
        <Card className="table-card">
          {groups.map((group) => (
            <div key={group.key} className="tx-date-group">
              <div className="tx-date-bar">
                <span className="tx-date-bar-label">
                  <CalendarDays size={14} aria-hidden />
                  <span className="truncate">{group.label}</span>
                </span>
                <span className="tx-date-bar-total">
                  {group.total >= 0 ? "+ " : "− "}
                  {money(Math.abs(group.total), profile.data.defaultCurrency)}
                </span>
              </div>
              {group.items.map((item) => (
                <div key={item.id} className="transaction-row">
                  <span className={`tx-icon${item.type === "INCOME" ? " income" : ""}`}>
                    <CategoryGlyph
                      name={item.categoryIcon ?? (item.type === "INCOME" ? "₹" : "↘")}
                    />
                  </span>
                  <div className="min-w-0">
                    <b className="block truncate text-[13px]">
                      {item.merchant || item.notes || "Untitled transaction"}
                    </b>
                    <small className="mt-1 block truncate text-[11px] text-[var(--muted-foreground)]">
                      {item.categoryName} • {resolveAccountLabel(allAccounts, item.accountId, item.accountName)} •{" "}
                      {transactionStamp(item.transactionAt)}
                    </small>
                  </div>
                  <div className="hide-mobile shrink-0">
                    <span className="category-tag">{item.categoryName}</span>
                  </div>
                  <span
                    className={`shrink-0 whitespace-nowrap text-right text-[13px] font-extrabold tabular-nums ${item.type === "INCOME" ? "text-[var(--primary)]" : ""}`}
                  >
                    {signedMoney(item.amountMinor, item.currency, item.type)}
                  </span>
                  <div className="relative row-menu">
                    <button
                      className="grid size-11 place-items-center rounded-[10px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      aria-label="Transaction actions"
                      aria-haspopup="menu"
                      aria-expanded={menu === item.id}
                      onClick={() => setMenu(menu === item.id ? null : item.id)}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menu === item.id ? (
                      <div
                        className="absolute end-0 top-full z-40 mt-1 w-40 max-w-[calc(100vw-2rem)] rounded-2xl border bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]"
                        role="menu"
                        aria-label="Transaction actions"
                      >
                        <button
                          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs hover:bg-[var(--muted)]"
                          role="menuitem"
                          onClick={() => {
                            setEditing(item);
                            setMenu(null);
                          }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                          aria-label="Delete"
                          role="menuitem"
                          onClick={() => {
                            setMenu(null);
                            setDeleting(item);
                          }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[var(--muted-foreground)]">
              Page {page} of {Number(transactions.data.meta?.totalPages ?? 1)}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" className="px-3" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft size={17} />
              </Button>
              <Button
                variant="secondary"
                className="px-3"
                disabled={page >= Number(transactions.data.meta?.totalPages ?? 1)}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight size={17} />
              </Button>
              <Select className="w-full sm:w-40" aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
              </Select>
            </div>
          </div>
        </Card>
      ) : search || type || category || account ? (
        <NoResults
          query={search || "these filters"}
          onClear={resetFilters}
        />
      ) : (
        <EmptyState
          title="No transactions yet"
          description="Add your first transaction to start tracking money movement."
          action={
            <Button onClick={() => setManualAdd(true)}>
              <Plus size={17} />
              Add transaction
            </Button>
          }
        />
      )}
      <div className="tx-proofs">
        <Link href="/privacy" className="tx-proof">
          <span className="tx-proof-icon">
            <Shield size={16} />
          </span>
          <span>
            <b>Secure & Private</b>
            <small>Your ledger stays on your Hisaab account.</small>
          </span>
        </Link>
        <Link href="/settings" className="tx-proof">
          <span className="tx-proof-icon" style={{ background: "color-mix(in srgb, #2563EB 14%, var(--surface))", color: "#2563EB" }}>
            <RefreshCw size={16} />
          </span>
          <span>
            <b>Real-time Sync</b>
            <small>Balances update as soon as you save.</small>
          </span>
        </Link>
        <Link href="/reports" className="tx-proof">
          <span className="tx-proof-icon" style={{ background: "color-mix(in srgb, #7C3AED 14%, var(--surface))", color: "#7C3AED" }}>
            <BarChart3 size={16} />
          </span>
          <span>
            <b>Smart Reports</b>
            <small>See spending trends and monthly health.</small>
          </span>
        </Link>
        <Link href="/premium" className="tx-proof">
          <span className="tx-proof-icon" style={{ background: "color-mix(in srgb, #EA580C 14%, var(--surface))", color: "#EA580C" }}>
            <Headset size={16} />
          </span>
          <span>
            <b>Premium Support</b>
            <small>Priority help when you need it.</small>
          </span>
        </Link>
      </div>
      <Modal open={add} onClose={closeAdd} title="Add transaction" size="lg">
        <TransactionForm
          accounts={channelOptions}
          bankAccounts={banks}
          categories={categories.data}
          currency={profile.data.defaultCurrency}
          defaultType={defaultType}
          defaultBankAccountId={defaultBankAccountId || undefined}
          onSaved={saved}
        />
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit transaction" size="lg">
        <TransactionForm
          accounts={channelOptions}
          bankAccounts={banks}
          categories={categories.data}
          currency={profile.data.defaultCurrency}
          initial={editing ?? undefined}
          onSaved={saved}
        />
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete transaction?"
        description={`${deleting?.merchant || deleting?.categoryName || "This transaction"} will be removed and account balances will be recalculated.`}
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function splitCategoryChips(items: Category[]) {
  const featured = FEATURED_CATEGORY_NAMES.map((name) => items.find((item) => item.name === name)).filter(
    (item): item is Category => Boolean(item),
  );
  if (featured.length < 4) {
    const extras = items.filter((item) => item.type === "EXPENSE" && !featured.some((row) => row.id === item.id));
    featured.push(...extras.slice(0, Math.max(0, 6 - featured.length)));
  }
  const extra = items.filter((item) => !featured.some((row) => row.id === item.id));
  return { featured, extra };
}

function CategoryFilterChip({
  active,
  colour,
  icon,
  children,
  onClick,
}: {
  active?: boolean;
  colour?: string;
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tx-category-chip${active ? " active" : ""}`}
      style={!active && colour ? { borderColor: colour } : undefined}
    >
      {icon ? (
        <span
          className="tx-category-chip-icon"
          style={!active && colour ? { color: colour } : undefined}
        >
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

function groupByDate(items: Transaction[]) {
  const groups: Array<{ key: string; label: string; total: number; items: Transaction[] }> = [];
  for (const item of items) {
    const date = new Date(item.transactionAt);
    const key = date.toISOString().slice(0, 10);
    const signed = item.type === "INCOME" ? item.amountMinor : -item.amountMinor;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.items.push(item);
      existing.total += signed;
    } else {
      groups.push({
        key,
        label: dayGroupLabel(item.transactionAt),
        total: signed,
        items: [item],
      });
    }
  }
  return groups;
}

function exportCsv(rows: Transaction[]) {
  const header = "Date,Merchant,Category,Account,Type,Amount\n";
  const body = rows
    .map((item) =>
      [
        item.transactionAt,
        `"${(item.merchant ?? "").replaceAll('"', '""')}"`,
        item.categoryName,
        tidyAccountLabel(item.accountName),
        item.type,
        (item.amountMinor / 100).toFixed(2),
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hisaab-transactions.csv";
  link.click();
  URL.revokeObjectURL(url);
}
