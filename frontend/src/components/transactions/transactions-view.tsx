"use client";
import type { Transaction } from "@hisaab/types";
import { Button, Card, Input, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CardHead, Chip } from "@/components/layout/chrome";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, NoResults, PageSkeleton } from "@/components/layout/states";
import { dateTime, money, signedMoney } from "@/lib/format";
import { uniqueCatalogAccounts, accountDisplayName, resolveAccountLabel, tidyAccountLabel } from "@/lib/accounts";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";
import { TransactionForm } from "./transaction-form";

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
  const add = manualAdd || searchParams.has("action");
  const defaultType = searchParams.get("action") === "income" ? "INCOME" : "EXPENSE";
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
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const remove = useMutation({
    mutationFn: (id: string) => transactionService.remove(id),
    onSuccess: () => {
      toast.success("Transaction deleted");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  if (transactions.isLoading || accounts.isLoading || categories.isLoading || profile.isLoading)
    return <PageSkeleton />;
  if (
    transactions.isError ||
    !transactions.data ||
    !accounts.data ||
    !categories.data ||
    !profile.data
  )
    return <ErrorState retry={() => void transactions.refetch()} />;
  const saved = () => {
    closeAdd();
    setEditing(null);
    toast.success("Transaction saved");
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const rows = transactions.data.data;
  const groups = groupByDate(rows);
  const expenseCategories = categories.data.filter((item) => item.type === "EXPENSE").slice(0, 6);
  return (
    <div>
      <PageHeader
        eyebrow="Money movement"
        title="Transactions"
        description="Search, filter, review, and maintain every expense and income with a cleaner premium layout."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => exportCsv(rows)}
            >
              ⇩ Export CSV
            </Button>
            <Button onClick={() => setManualAdd(true)}>
              <Plus size={17} />
              Add transaction
            </Button>
          </>
        }
      />
      <Card className="transaction-filters-card p-[22px]">
        <CardHead
          title="Smart filters"
          description="Use search, period, type, account, and category filters to find entries clearly."
          action={
            <button
              type="button"
              className="min-h-11 text-[11px] font-bold text-[var(--muted-foreground)]"
              onClick={() => {
                setSearch("");
                setType("");
                setCategory("");
                setAccount("");
                setPeriod("all");
                setPage(1);
              }}
            >
              Reset all
            </button>
          }
        />
        <div className="filters-grid">
          <label className="filter-field">
            <span>Search</span>
            <Input
              placeholder="Search merchant, category, note or account..."
              aria-label="Search merchant or notes"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>Period</span>
            <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="all">All dates</option>
              <option value="month">This month</option>
              <option value="week">This week</option>
              <option value="today">Today</option>
            </Select>
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
              {uniqueCatalogAccounts(accounts.data).map((item) => (
                <option key={item.id} value={item.id}>
                  {accountDisplayName(item)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="chip-row tx-category-row">
          <Chip
            active={!category}
            onClick={() => {
              setCategory("");
              setPage(1);
            }}
          >
            All categories
          </Chip>
          {expenseCategories.map((item) => (
            <Chip
              key={item.id}
              active={category === item.id}
              onClick={() => {
                setCategory(item.id);
                setPage(1);
              }}
            >
              {item.name}
            </Chip>
          ))}
        </div>
        <div className="tx-summary">
          <div>
            <b>
              Showing {Number(transactions.data.meta?.total ?? rows.length)} transaction
              {Number(transactions.data.meta?.total ?? rows.length) === 1 ? "" : "s"}
            </b>
            <small>
              Category: {categories.data.find((item) => item.id === category)?.name ?? "All"} · Period:{" "}
              {period === "all" ? "All dates" : period === "month" ? "This month" : period === "week" ? "This week" : "Today"}{" "}
              · Type: {type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expense" : "All types"}
            </small>
          </div>
          <Button variant="secondary" onClick={() => setManualAdd(true)}>
            ＋ New transaction
          </Button>
        </div>
      </Card>
      {rows.length ? (
        <Card className="table-card overflow-hidden">
          {groups.map((group) => (
            <div key={group.key} className="px-[18px] pb-0.5 pt-[17px]">
              <div className="mb-1.5 flex justify-between text-[11px] font-extrabold text-[var(--muted-foreground)]">
                <span>{group.label}</span>
                <span>
                  {group.total >= 0 ? "+ " : "− "}
                  {money(Math.abs(group.total), profile.data.defaultCurrency)}
                </span>
              </div>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[44px_minmax(0,1fr)_auto_44px] items-center gap-3 border-b border-[var(--border)] py-3 last:border-0 lg:grid-cols-[44px_minmax(160px,1.3fr)_minmax(110px,.7fr)_minmax(90px,.5fr)_44px]"
                >
                  <span className={`tx-icon${item.type === "INCOME" ? " income" : ""}`}>
                    {item.categoryIcon ?? (item.type === "INCOME" ? "₹" : "↘")}
                  </span>
                  <div className="min-w-0">
                    <b className="block truncate text-xs">
                      {item.merchant || item.notes || "Untitled transaction"}
                    </b>
                    <small className="block truncate text-[11px] text-[var(--muted-foreground)]">
                      {item.categoryName} · {resolveAccountLabel(accounts.data, item.accountId, item.accountName)} · {dateTime(item.transactionAt)}
                    </small>
                  </div>
                  <div className="hidden lg:block">
                    <span className="category-tag">{item.categoryName}</span>
                  </div>
                  <span
                    className={`shrink-0 text-right text-xs font-extrabold ${item.type === "INCOME" ? "text-[var(--primary)]" : ""}`}
                  >
                    {signedMoney(item.amountMinor, item.currency, item.type)}
                  </span>
                  <div className="relative">
                    <button
                      className="grid size-11 place-items-center rounded-[10px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      aria-label="Edit"
                      onClick={() => setMenu(menu === item.id ? null : item.id)}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menu === item.id ? (
                      <div className="absolute right-0 z-10 mt-1 w-36 rounded-xl border bg-[var(--surface)] p-1 shadow-[var(--shadow)]">
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-[var(--muted)]"
                          onClick={() => {
                            setEditing(item);
                            setMenu(null);
                          }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                          aria-label="Delete"
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
          onClear={() => {
            setSearch("");
            setType("");
            setCategory("");
            setAccount("");
            setPage(1);
          }}
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
      <Modal open={add} onClose={closeAdd} title="Add transaction" size="lg">
        <TransactionForm
          accounts={accounts.data}
          categories={categories.data}
          currency={profile.data.defaultCurrency}
          defaultType={defaultType}
          onSaved={saved}
        />
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit transaction" size="lg">
        <TransactionForm
          accounts={accounts.data}
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
        label: new Intl.DateTimeFormat("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(date),
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
