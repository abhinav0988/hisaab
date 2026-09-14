"use client";
import type { Category, CreditSpendImpact, Transaction } from "@hisaab/types";
import { Button, Select } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChartNoAxesCombined,
  CircleHelp,
  Download,
  Layers,
  Moon,
  MoreVertical,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Wallet,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Modal } from "@/components/layout/modal";
import { EmptyState, ErrorState, NoResults, PageSkeleton } from "@/components/layout/states";
import { CategoryGlyph } from "@/components/finance/category-glyph";
import { compactTime, dayGroupLabel, localDateKey, money, signedMoney } from "@/lib/format";
import {
  accountDisplayName,
  accountTypeLabel,
  resolveAccountLabel,
  tidyAccountLabel,
  accountsForTransactions,
} from "@/lib/accounts";
import { creditSpendCopy } from "@/lib/finance-modules";
import {
  axisLabel,
  lastTenDaySpend,
  merchantTone,
  niceAxis,
  paymentMode,
  percentChange,
  previousTenDaySpend,
  topExpenseCategory,
  visiblePageNumbers,
} from "@/lib/tx-insights";
import { accountService } from "@/services/account.service";
import { categoryService } from "@/services/category.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";
import { TransactionForm } from "./transaction-form";
import "../../app/tx16.css";

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
  if (period === "today") {
    const day = localDateKey(startOfDay);
    return { from: day, to: day };
  }
  if (period === "week") {
    const from = new Date(startOfDay);
    from.setDate(from.getDate() - 6);
    return { from: localDateKey(from), to: localDateKey(startOfDay) };
  }
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: localDateKey(from), to: localDateKey(startOfDay) };
  }
  return { from: "", to: "" };
}

function isoDayStart(day: string) {
  return new Date(`${day}T00:00:00`).toISOString();
}
/** Exclusive end bound for `transaction_at < to` on the API. */
function isoDayEndExclusive(day: string) {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function rangeQuery(from: string, to: string, extra = "") {
  const value = new URLSearchParams({ page: "1", limit: "500", sort: "newest" });
  if (from) value.set("from", isoDayStart(from));
  if (to) value.set("to", isoDayEndExclusive(to));
  if (extra) {
    const more = new URLSearchParams(extra);
    more.forEach((item, key) => value.set(key, item));
  }
  return value.toString();
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === "" || value === null || value === undefined) {
      setDebounced(value);
      return;
    }
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function TxThemeButton() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && theme === "dark";
  return (
    <button
      type="button"
      className="tx16-icon-btn"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

function TxNotifyButton({ notices }: { notices: Array<{ title: string; body: string }> }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="tx16-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className="tx16-icon-btn tx16-notify"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
        {notices.length ? <span className="tx16-notify-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="tx16-notify-panel" role="dialog" aria-label="Transaction notifications">
          <header>
            <div>
              <h2>Notifications</h2>
              <p>{notices.length ? `${notices.length} alert${notices.length === 1 ? "" : "s"}` : "You're all caught up"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              Mark read
            </button>
          </header>
          {notices.length ? (
            <ul className="m-0 grid list-none gap-1 p-0">
              {notices.map((item) => (
                <li key={`${item.title}-${item.body}`} className="rounded-xl px-2 py-2.5 hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]">
                  <strong className="block text-xs">{item.title}</strong>
                  <small className="mt-1 block text-[10.5px] text-[var(--muted-foreground)]">{item.body}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tx16-notify-empty">No transaction alerts yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TransactionsView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
  const today = localDateKey(new Date());
  const lookbackStart = localDateKey(
    new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 19),
  );
  const monthStart = localDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const filterSignature = useMemo(() => {
    const value = new URLSearchParams();
    if (debouncedSearch) value.set("search", debouncedSearch);
    if (type) value.set("type", type);
    if (category) value.set("category_id", category);
    if (account) value.set("account_id", account);
    if (from) value.set("from", isoDayStart(from));
    if (to) value.set("to", isoDayEndExclusive(to));
    value.set("sort", sort);
    return value.toString();
  }, [debouncedSearch, type, category, account, from, to, sort]);
  const filters = useMemo(() => {
    const value = new URLSearchParams(filterSignature);
    value.set("page", String(page));
    value.set("limit", "20");
    return value.toString();
  }, [filterSignature, page]);
  const analyticsExtra = useMemo(() => {
    const value = new URLSearchParams();
    if (debouncedSearch) value.set("search", debouncedSearch);
    if (type) value.set("type", type);
    if (category) value.set("category_id", category);
    if (account) value.set("account_id", account);
    return value.toString();
  }, [debouncedSearch, type, category, account]);
  const transactions = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => transactionService.list(filters),
    // Keep prior rows only when paging/sorting within the same filters — never for new filters.
    placeholderData: (previousData, previousQuery) => {
      const previousFilters = previousQuery?.queryKey[1];
      if (typeof previousFilters !== "string" || !previousData) return undefined;
      const previous = new URLSearchParams(previousFilters);
      const next = new URLSearchParams(filters);
      previous.delete("page");
      next.delete("page");
      return previous.toString() === next.toString() ? previousData : undefined;
    },
  });
  const monthRows = useQuery({
    queryKey: ["transactions-month", monthStart, today, analyticsExtra],
    queryFn: () => transactionService.list(rangeQuery(monthStart, today, analyticsExtra)),
  });
  const lookbackRows = useQuery({
    queryKey: ["transactions-lookback", lookbackStart, today, analyticsExtra],
    queryFn: () => transactionService.list(rangeQuery(lookbackStart, today, analyticsExtra)),
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
      void queryClient.invalidateQueries({ queryKey: ["transactions-month"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions-lookback"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-facilities"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-dashboard"] });
    },
  });
  const shellReady = Boolean(accounts.data && bankAccounts.data && categories.data && profile.data);
  const bootstrapping =
    accounts.isLoading ||
    bankAccounts.isLoading ||
    categories.isLoading ||
    profile.isLoading ||
    (transactions.isPending && !transactions.data && !shellReady);
  if (bootstrapping) return <PageSkeleton />;
  if (
    accounts.isError ||
    bankAccounts.isError ||
    categories.isError ||
    profile.isError ||
    !accounts.data ||
    !bankAccounts.data ||
    !categories.data ||
    !profile.data
  )
    return <ErrorState retry={() => void accounts.refetch()} />;
  if (transactions.isError && !transactions.data)
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
    void queryClient.invalidateQueries({ queryKey: ["transactions-month"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions-lookback"] });
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
  const rows = transactions.data?.data ?? [];
  const groups = groupByDate(rows);
  const { featured, extra } = splitCategoryChips(categories.data);
  const visibleCategories = showMoreCategories ? [...featured, ...extra] : featured;
  const monthItems = monthRows.data?.data ?? [];
  const lookbackItems = lookbackRows.data?.data ?? [];
  const moneyIn = monthItems.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amountMinor, 0);
  const moneyOut = monthItems.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amountMinor, 0);
  const net = moneyIn - moneyOut;
  const totalBalance = allAccounts.reduce((sum, item) => sum + Number(item.currentBalanceMinor ?? 0), 0);
  const daily = lastTenDaySpend(lookbackItems);
  const spend10 = daily.reduce((sum, item) => sum + item.minor, 0);
  const previous10 = previousTenDaySpend(lookbackItems);
  const spendChange = percentChange(spend10, previous10);
  const maxSpend = Math.max(...daily.map((item) => item.minor), 0);
  const axisMax = niceAxis(Math.max(maxSpend, 1));
  const topCategory = topExpenseCategory(lookbackItems);
  const highDay = daily.reduce((best, item) => (item.minor > best.minor ? item : best), daily[0]!);
  const avg10 = Math.round(spend10 / 10);
  const total = Number(transactions.data?.meta?.total ?? rows.length);
  const totalPages = Number(transactions.data?.meta?.totalPages ?? 1);
  const showingFrom = total ? (page - 1) * 20 + 1 : 0;
  const showingTo = Math.min(page * 20, total);
  const filtered = Boolean(debouncedSearch || type || category || account || period !== "all");
  const chartLoading = lookbackRows.isPending && !lookbackRows.data;
  const listRefreshing = transactions.isFetching;
  const listWaiting = transactions.isFetching && !transactions.data;
  const notices: Array<{ title: string; body: string }> = [];
  if (spendChange.down && spend10 > 0) {
    notices.push({
      title: "Spending up vs prior 10 days",
      body: spendChange.label,
    });
  }
  if (topCategory.minor > 0) {
    notices.push({
      title: `Top category · ${topCategory.name}`,
      body: money(topCategory.minor, currency),
    });
  }

  return (
    <div className="tx16">
      <header className="tx16-head">
        <div>
          <h1>Transactions</h1>
          <p>Search, filter, review and manage your transactions</p>
        </div>
        <div className="tx16-head-actions">
          <button type="button" className="tx16-add" onClick={() => setManualAdd(true)}>
            <Plus size={16} />
            Add transaction
          </button>
          <TxNotifyButton notices={notices.slice(0, 3)} />
          <TxThemeButton />
          <button
            type="button"
            className="tx16-icon-btn"
            aria-label="More actions"
            onClick={() => toast.info("Use Smart Filters below to refine your ledger.")}
          >
            <MoreVertical size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="tx16-kpis">
        <article className="tx16-kpi in">
          <div>
            <span>Money In</span>
            <b>{money(moneyIn, currency)}</b>
            <small>This calendar month</small>
          </div>
          <i>
            <ArrowDownLeft size={20} aria-hidden />
          </i>
        </article>
        <article className="tx16-kpi out">
          <div>
            <span>Money Out</span>
            <b>{money(moneyOut, currency)}</b>
            <small>This calendar month</small>
          </div>
          <i>
            <ArrowUpRight size={20} aria-hidden />
          </i>
        </article>
        <article className="tx16-kpi net">
          <div>
            <span>Net Flow</span>
            <b>
              {net < 0 ? "−" : "+"}
              {money(Math.abs(net), currency)}
            </b>
            <small>Income minus expenses</small>
          </div>
          <i>
            <ChartNoAxesCombined size={20} aria-hidden />
          </i>
        </article>
        <article className="tx16-kpi bal">
          <div>
            <span>Total Balance</span>
            <b>{money(totalBalance, currency)}</b>
            <small>Updated just now</small>
          </div>
          <i>
            <WalletCards size={20} aria-hidden />
          </i>
        </article>
      </section>

      <section className="tx16-mid">
        <article className="tx16-panel tx16-spend">
          <div className="tx16-panel-head">
            <div>
              <h3>
                Daily Spending Overview <small>(Last 10 Days)</small>
              </h3>
            </div>
            <span className="tx21-inline-icon" aria-hidden>
              <CircleHelp size={13} />
            </span>
          </div>
          <div className="tx16-spend-total">
            <b>{chartLoading ? "…" : money(spend10, currency)}</b>
            <span>Total spent in last 10 days</span>
            <em className={spendChange.down ? "is-down" : undefined}>
              {chartLoading ? "Loading spending…" : spendChange.label}
            </em>
          </div>
          <div className="tx16-chart">
            <div className="tx16-y">
              <span>{axisLabel(axisMax, currency)}</span>
              <span>{axisLabel(Math.round(axisMax * 0.66), currency)}</span>
              <span>{axisLabel(Math.round(axisMax * 0.33), currency)}</span>
              <span>₹0</span>
            </div>
            <div className="tx16-plot">
              {daily.map((item) => (
                <div key={item.key} className="tx16-bar-col" title={money(item.minor, currency)}>
                  <b>{item.minor ? money(item.minor, currency).replace(".00", "") : ""}</b>
                  <i
                    style={{
                      height: item.minor
                        ? `${Math.max(4, Math.round((item.minor / axisMax) * 78))}%`
                        : "2px",
                    }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="tx16-panel tx16-filters">
          <div className="tx16-panel-head">
            <h3>
              Smart Filters{" "}
              <span className="tx16-spark" aria-hidden>
                <Sparkles size={13} />
              </span>
            </h3>
            <button type="button" className="tx16-clear" onClick={resetFilters}>
              Clear all
            </button>
          </div>
          <label className={`tx16-search${listRefreshing ? " is-refreshing" : ""}`}>
            <Search size={16} aria-hidden />
            <input
              placeholder="Search merchant, category, account..."
              aria-label="Search merchant, category, or account"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="tx16-selects">
            <Select aria-label="Period" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }}>
              <option value="all">All dates</option>
              <option value="month">This month</option>
              <option value="week">This week</option>
              <option value="today">Today</option>
            </Select>
            <Select aria-label="Transaction type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
              <option value="">All types</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="TRANSFER">Transfer</option>
            </Select>
            <Select aria-label="Account" value={account} onChange={(event) => { setAccount(event.target.value); setPage(1); }}>
              <option value="">All accounts</option>
              {allAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {accountDisplayName(item)}
                </option>
              ))}
            </Select>
          </div>
          <div className="tx16-cats">
            <CategoryFilterChip
              active={!category}
              onClick={() => {
                setCategory("");
                setPage(1);
              }}
              icon={<Layers size={13} />}
            >
              All
            </CategoryFilterChip>
            {visibleCategories.map((item) => (
              <CategoryFilterChip
                key={item.id}
                active={category === item.id}
                onClick={() => {
                  setCategory((current) => (current === item.id ? "" : item.id));
                  setPage(1);
                }}
                icon={<CategoryGlyph name={item.icon} size={13} />}
              >
                {item.name}
              </CategoryFilterChip>
            ))}
            {extra.length ? (
              <CategoryFilterChip active={showMoreCategories} onClick={() => setShowMoreCategories((value) => !value)}>
                {showMoreCategories ? "Show less" : "More"}
                <Plus size={13} />
              </CategoryFilterChip>
            ) : null}
          </div>
        </article>
      </section>

      {listWaiting ? (
        <div className="tx16-ledger tx16-empty">
          <p className="tx16-filter-status">Updating results…</p>
        </div>
      ) : rows.length ? (
        <section className={`tx16-bottom${listRefreshing ? " is-refreshing" : ""}`}>
          <div className="tx16-ledger">
            {filtered ? (
              <div className="tx16-filter-banner">
                Showing filtered results
                {listRefreshing ? "…" : ` · ${total} match${total === 1 ? "" : "es"}`}
                <button type="button" onClick={resetFilters}>
                  Clear filters
                </button>
              </div>
            ) : null}
            <div className="tx16-table-head">
              <span>DATE</span>
              <span>MERCHANT / CATEGORY</span>
              <span>ACCOUNT</span>
              <span>PAYMENT MODE</span>
              <span>AMOUNT</span>
            </div>
            {groups.map((group) => {
              const daySpend = group.items
                .filter((item) => item.type === "EXPENSE")
                .reduce((sum, item) => sum + item.amountMinor, 0);
              const isCollapsed = collapsed[group.key];
              return (
                <div key={group.key} className="tx16-daygroup">
                  <div className="tx16-daybar">
                    <div>
                      <span className="cal" aria-hidden>
                        <CalendarDays size={13} />
                      </span>
                      <b>{group.label}</b>
                      <em>Daily spending: {money(daySpend, currency)}</em>
                    </div>
                    <small>
                      {group.items.length} transaction{group.items.length === 1 ? "" : "s"}
                      <button
                        type="button"
                        className="tx19-collapse"
                        aria-label={isCollapsed ? "Expand day" : "Collapse day"}
                        onClick={() =>
                          setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))
                        }
                      >
                        {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                      </button>
                    </small>
                  </div>
                  {isCollapsed
                    ? null
                    : group.items.map((item) => {
                        const accountRow = allAccounts.find((row) => row.id === item.accountId);
                        const pay = paymentMode(accountRow);
                        return (
                          <div key={item.id} className="tx16-row">
                            <span className="tx16-time">{compactTime(item.transactionAt)}</span>
                            <div className="tx16-merchant">
                              <i className={merchantTone(item)}>
                                <CategoryGlyph
                                  name={item.categoryIcon ?? (item.type === "INCOME" ? "₹" : undefined)}
                                  size={17}
                                />
                              </i>
                              <div>
                                <b>{item.merchant || item.notes || "Untitled transaction"}</b>
                                <small>
                                  <u />
                                  {item.categoryName}
                                </small>
                              </div>
                            </div>
                            <div className="tx16-account">
                              <b>{resolveAccountLabel(allAccounts, item.accountId, item.accountName)}</b>
                              <small>{accountRow ? accountTypeLabel(accountRow.type) : "Account"}</small>
                            </div>
                            <div className="tx16-pay">
                              <b>{pay.method}</b>
                              <small>{pay.provider}</small>
                            </div>
                            <div className={`tx16-amt ${item.type === "INCOME" ? "in" : "out"}`}>
                              {signedMoney(item.amountMinor, item.currency, item.type)}
                              <button
                                type="button"
                                className="tx19-row-arrow"
                                aria-label="Edit transaction"
                                onClick={() => setEditing(item)}
                              >
                                <ChevronRight size={13} />
                              </button>
                              <button
                                type="button"
                                className="tx19-row-arrow"
                                aria-label="Delete"
                                onClick={() => setDeleting(item)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                </div>
              );
            })}
            <div className="tx16-pagination">
              <div className="tx16-page-info">
                <b>
                  Showing {showingFrom}–{showingTo} of {total} transactions
                </b>
                <small>
                  Page {page} of {totalPages}
                </small>
              </div>
              <div className="tx16-page-actions">
                <button
                  type="button"
                  className="tx16-page-btn nav"
                  disabled={page === 1}
                  aria-label="Previous page"
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                {visiblePageNumbers(page, totalPages).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`tx16-page-btn${page === item ? " active" : ""}`}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ))}
                <button
                  type="button"
                  className="tx16-page-btn nav"
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight size={14} />
                </button>
                <Select className="w-[132px]" aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="amount_desc">Highest amount</option>
                  <option value="amount_asc">Lowest amount</option>
                </Select>
              </div>
            </div>
          </div>
          <aside className="tx16-side">
            <article className="tx16-panel tx16-export">
              <div>
                <h3>Export & Reports</h3>
                <p>Download your transaction data</p>
                <button type="button" onClick={() => exportCsv(rows)}>
                  Export CSV
                  <Download size={14} />
                </button>
              </div>
              <div className="tx16-wallet" aria-hidden>
                <Wallet size={29} />
              </div>
            </article>
            <article className="tx16-panel tx16-insights">
              <div className="tx16-panel-head">
                <h3>Insights</h3>
                <span className="tx21-select-btn">Last 10 days</span>
              </div>
              <div className="tx16-insight">
                <i>
                  <Receipt size={17} />
                </i>
                <div>
                  <small>Top Category</small>
                  <b>{topCategory.name}</b>
                </div>
                <strong>{money(topCategory.minor, currency)}</strong>
              </div>
              <div className="tx16-insight">
                <i>
                  <CalendarDays size={17} />
                </i>
                <div>
                  <small>Highest Spending Day</small>
                  <b>{highDay.longLabel}</b>
                </div>
                <strong>{money(highDay.minor, currency)}</strong>
              </div>
              <div className="tx16-insight">
                <i>
                  <BarChart3 size={17} />
                </i>
                <div>
                  <small>Avg. Daily Spending</small>
                  <b>{money(avg10, currency)}</b>
                </div>
                <strong />
              </div>
              <Link href="/reports">
                View all insights
                <span className="tx21-link-arrow" aria-hidden>
                  <ChevronRight size={13} />
                </span>
              </Link>
            </article>
          </aside>
        </section>
      ) : filtered ? (
        <NoResults query={debouncedSearch || "these filters"} onClear={resetFilters} />
      ) : (
        <div className="tx16-ledger tx16-empty">
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
        </div>
      )}

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
  icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={active ? "active" : undefined}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function groupByDate(items: Transaction[]) {
  const groups: Array<{ key: string; label: string; total: number; items: Transaction[] }> = [];
  for (const item of items) {
    const key = localDateKey(item.transactionAt);
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
