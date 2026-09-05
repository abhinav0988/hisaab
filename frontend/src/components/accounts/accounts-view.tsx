"use client";

import type { Account, AccountCatalogItem, AccountType, Transaction } from "@hisaab/types";
import { Button, Field, Input } from "@hisaab/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CreditCard,
  Gem,
  Landmark,
  Link2,
  MoreVertical,
  Plus,
  Smartphone,
  Sparkles,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { ImmersedNotifyButton, ImmersedThemeButton } from "@/components/layout/immersed-chrome";
import { Modal } from "@/components/layout/modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import {
  accountDisplayName,
  accountTypeLabel,
  uniqueCatalogAccounts,
} from "@/lib/accounts";
import { bankAbbrev, bankLabel, bankLast4 } from "@/lib/bank";
import { money, signedMoney } from "@/lib/format";
import { accountService } from "@/services/account.service";
import { dashboardService } from "@/services/dashboard.service";
import { profileService } from "@/services/profile.service";
import "../../app/accounts33.css";

type FilterTab = "all" | "bank" | "upi" | "wallet" | "cards" | "cash";

const MIX_COLORS: Record<string, string> = {
  BANK: "#42df91",
  DEBIT_CARD: "#2d91e7",
  UPI: "#7f63e8",
  MOBILE_WALLET: "#e7bd53",
  CASH: "#f05858",
  CREDIT_CARD: "#ff6670",
  OTHER: "#8ca398",
};

function cardTone(type: AccountType) {
  switch (type) {
    case "CASH":
      return "cash";
    case "BANK":
      return "bank";
    case "UPI":
      return "upi";
    case "MOBILE_WALLET":
      return "wallet";
    case "CREDIT_CARD":
      return "credit";
    case "DEBIT_CARD":
      return "debit";
    default:
      return "bank";
  }
}

function accountIcon(type: AccountType) {
  switch (type) {
    case "CASH":
      return <Banknote />;
    case "BANK":
      return <Landmark />;
    case "UPI":
      return <Smartphone />;
    case "MOBILE_WALLET":
      return <Wallet />;
    case "CREDIT_CARD":
    case "DEBIT_CARD":
      return <CreditCard />;
    default:
      return <WalletCards />;
  }
}

function accountDescription(account: Account, meta?: AccountCatalogItem) {
  if (meta?.description) return meta.description;
  switch (account.type) {
    case "CASH":
      return "Physical cash and day-to-day notes";
    case "BANK":
      return "Savings or current account";
    case "UPI":
      return "UPI apps and linked bank handles";
    case "MOBILE_WALLET":
      return "Mobile wallets and prepaid balances";
    case "CREDIT_CARD":
      return "Credit card spending";
    case "DEBIT_CARD":
      return "Debit card linked to your bank";
    default:
      return accountTypeLabel(account.type);
  }
}

function accountChip(account: Account) {
  if (account.type === "BANK") {
    const label = bankLabel(account);
    const last4 = bankLast4(account.name);
    const letter = bankAbbrev(label).slice(0, 1) || "B";
    return (
      <span className="ac33-chip">
        <i className="bankdot">{letter}</i>
        {label}
        {last4 ? ` •••• ${last4}` : ""}
      </span>
    );
  }
  if (account.institutionName) {
    const last4 = bankLast4(account.name);
    return (
      <span className="ac33-chip">
        {account.institutionName}
        {last4 ? ` •••• ${last4}` : ""}
      </span>
    );
  }
  return <span className="ac33-chip">{accountTypeLabel(account.type)}</span>;
}

function displayBalance(account: Account) {
  if (account.type === "CREDIT_CARD" && account.currentBalanceMinor > 0) {
    return -account.currentBalanceMinor;
  }
  return account.currentBalanceMinor;
}

function pctChange(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : current < 0 ? -100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function matchesFilter(account: Account, filter: FilterTab) {
  if (filter === "all") return true;
  if (filter === "bank") return account.type === "BANK";
  if (filter === "upi") return account.type === "UPI";
  if (filter === "wallet") return account.type === "MOBILE_WALLET";
  if (filter === "cards") return account.type === "CREDIT_CARD" || account.type === "DEBIT_CARD";
  if (filter === "cash") return account.type === "CASH";
  return true;
}

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

function compactMoney(minor: number, currency: string) {
  return money(minor, currency).replace(".00", "");
}

export function AccountsView() {
  const router = useRouter();
  const client = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [editing, setEditing] = useState<Account | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list(),
  });
  const catalog = useQuery({
    queryKey: ["account-catalog"],
    queryFn: () => accountService.catalog(),
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.get(),
  });
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.summary(),
  });

  const listed = useMemo(
    () => (accounts.data ? uniqueCatalogAccounts(accounts.data) : []),
    [accounts.data],
  );
  const filtered = listed.filter((item) => matchesFilter(item, filter));

  const counts = useMemo(() => {
    const bank = listed.filter((item) => item.type === "BANK").length;
    const upi = listed.filter((item) => item.type === "UPI").length;
    const wallet = listed.filter((item) => item.type === "MOBILE_WALLET").length;
    const cards = listed.filter((item) => item.type === "CREDIT_CARD" || item.type === "DEBIT_CARD").length;
    const cash = listed.filter((item) => item.type === "CASH").length;
    return { all: listed.length, bank, upi, wallet, cards, cash };
  }, [listed]);

  if (accounts.isLoading || catalog.isLoading || profile.isLoading) return <PageSkeleton />;
  if (!accounts.data || !catalog.data || !profile.data)
    return <ErrorState retry={() => void accounts.refetch()} />;

  const currency = profile.data.defaultCurrency;
  const dash = dashboard.data;
  const monthly = dash?.monthlyComparison ?? [];
  const lastMonth = monthly.at(-2);
  const income = dash?.incomeThisMonth ?? 0;
  const spent = dash?.spentThisMonth ?? 0;
  const net = dash?.netSavings ?? income - spent;
  const totalBalance = listed.reduce((sum, item) => sum + displayBalance(item), 0);
  const incomeDelta = pctChange(income, lastMonth?.income ?? 0);
  const spendDelta = pctChange(spent, lastMonth?.expense ?? 0);
  const netDelta = pctChange(net, lastMonth ? lastMonth.income - lastMonth.expense : 0);

  const mix = buildMix(listed);
  const donutStops = buildDonutStops(mix);
  const recent = (dash?.recentTransactions ?? []).slice(0, 6);
  const insights = buildInsights(listed, { income, spent, net, currency });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["accounts"] });
    void client.invalidateQueries({ queryKey: ["account-catalog"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const openManage = () => setManageOpen(true);
  const openAdd = () => {
    toast.info("Link bank accounts from Bank, or edit catalog accounts here.");
    router.push("/bank");
  };

  return (
    <div className="ac33">
      <section className="ac33-head">
        <div className="ac33-head-left">
          <div className="ac33-page-icon">
            <Landmark />
          </div>
          <div>
            <h1>Accounts</h1>
            <p>Manage all your financial accounts in one place.</p>
          </div>
        </div>
        <div className="ac33-head-actions">
          <ImmersedNotifyButton className="ac33-btn" emptyText="No new account alerts." />
          <ImmersedThemeButton className="ac33-btn" />
          <button type="button" className="ac33-btn" onClick={openManage}>
            <Link2 /> Manage accounts
          </button>
        </div>
      </section>

      <section className="ac33-kpis">
        <article className="ac33-kpi green">
          <div>
            <span className="ac33-kpi-label">Total Balance</span>
            <strong>{money(totalBalance, currency)}</strong>
            <small>
              Across {listed.length} account{listed.length === 1 ? "" : "s"}
            </small>
          </div>
          <div className="ac33-kpi-icon">
            <Wallet />
          </div>
        </article>
        <article className="ac33-kpi blue">
          <div>
            <span className="ac33-kpi-label">Money In</span>
            <strong>{money(income, currency)}</strong>
            <small>
              This month{" "}
              {incomeDelta ? (
                <span className={`ac33-delta${incomeDelta < 0 ? " down" : ""}`}>
                  {incomeDelta >= 0 ? "↑" : "↓"} {Math.abs(incomeDelta)}%
                </span>
              ) : null}
            </small>
          </div>
          <div className="ac33-kpi-icon">
            <ArrowDownLeft />
          </div>
        </article>
        <article className="ac33-kpi purple">
          <div>
            <span className="ac33-kpi-label">Money Out</span>
            <strong>{money(spent, currency)}</strong>
            <small>
              This month{" "}
              {spendDelta ? (
                <span className={`ac33-delta${spendDelta > 0 ? " down" : ""}`}>
                  {spendDelta > 0 ? "↑" : "↓"} {Math.abs(spendDelta)}%
                </span>
              ) : null}
            </small>
          </div>
          <div className="ac33-kpi-icon">
            <ArrowUpRight />
          </div>
        </article>
        <article className="ac33-kpi gold">
          <div>
            <span className="ac33-kpi-label">Net Savings</span>
            <strong>{money(net, currency)}</strong>
            <small>
              This month{" "}
              {netDelta ? (
                <span className={`ac33-delta${netDelta < 0 ? " down" : ""}`}>
                  {netDelta >= 0 ? "↑" : "↓"} {Math.abs(netDelta)}%
                </span>
              ) : null}
            </small>
          </div>
          <div className="ac33-kpi-icon">
            <Banknote />
          </div>
        </article>
      </section>

      <section className="ac33-main">
        <article className="ac33-panel">
          <div className="ac33-panel-head">
            <div>
              <h2>Your Accounts</h2>
              <p>All your linked accounts at a glance.</p>
            </div>
            <div className="ac33-tabs">
              {(
                [
                  ["all", `All (${counts.all})`],
                  ["bank", `Bank (${counts.bank})`],
                  ["upi", `UPI (${counts.upi})`],
                  ["wallet", `Wallet (${counts.wallet})`],
                  ["cards", `Cards (${counts.cards})`],
                  ["cash", `Cash (${counts.cash})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`ac33-tab${filter === key ? " active" : ""}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <div className="ac33-cards">
              {filtered.map((account) => {
                const meta = catalog.data.find(
                  (item) => item.id === account.catalogId || item.type === account.type,
                );
                const balance = displayBalance(account);
                return (
                  <article
                    key={account.id}
                    className={`ac33-card ${cardTone(account.type)}${account.isActive ? "" : " is-inactive"}`}
                    onClick={() => setEditing(account)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setEditing(account);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ac33-card-top">
                      <div className="ac33-card-icon">{accountIcon(account.type)}</div>
                      <button
                        type="button"
                        className="ac33-more"
                        aria-label={`Edit ${accountDisplayName(account)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(account);
                        }}
                      >
                        <MoreVertical />
                      </button>
                    </div>
                    <h3>{accountDisplayName(account)}</h3>
                    <div className="desc">{accountDescription(account, meta)}</div>
                    <div className={`amount${balance < 0 ? " negative" : ""}`}>
                      {balance < 0
                        ? `−${money(Math.abs(balance), account.currency)}`
                        : money(balance, account.currency)}
                    </div>
                    <div className="ac33-tagrow">
                      {accountChip(account)}
                      <span className={`ac33-status${account.isActive ? "" : " inactive"}`}>
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={listed.length ? "No accounts in this filter" : "Accounts are loading"}
              description={
                listed.length
                  ? "Try another tab or manage your linked accounts."
                  : "Hisaab assigns Cash, Bank, UPI, Wallet, and card accounts automatically."
              }
              action={
                listed.length ? (
                  <Button onClick={() => setFilter("all")}>Show all</Button>
                ) : (
                  <Button onClick={() => void accounts.refetch()}>Refresh accounts</Button>
                )
              }
            />
          )}
        </article>

        <aside className="ac33-side">
          <article className="ac33-panel ac33-mix">
            <div className="ac33-panel-head" style={{ padding: 0 }}>
              <div>
                <h2>Account Mix</h2>
                <p>Distribution of your total funds</p>
              </div>
            </div>
            <div className="ac33-mix-grid">
              <div
                className="ac33-donut"
                style={{ "--donut-stops": donutStops } as CSSProperties}
              >
                <div>
                  <strong>{compactMoney(totalBalance, currency)}</strong>
                  <small>Total Balance</small>
                </div>
              </div>
              <div className="ac33-legend">
                {mix.length ? (
                  mix.map((item) => (
                    <div className="ac33-legend-row" key={item.key}>
                      <i style={{ background: item.color }} />
                      <span>{item.label}</span>
                      <b style={item.pct < 0 ? { color: "#ff6670" } : undefined}>
                        {item.pct < 0 ? `−${Math.abs(item.pct).toFixed(1)}%` : `${item.pct.toFixed(1)}%`}
                      </b>
                    </div>
                  ))
                ) : (
                  <p className="ac33-empty">No balances to chart yet.</p>
                )}
              </div>
            </div>
          </article>

          <article className="ac33-panel">
            <div className="ac33-panel-head">
              <div>
                <h2>Account Insights</h2>
              </div>
            </div>
            <div className="ac33-insights">
              {insights.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className={`ac33-insight${item.tone ? ` ${item.tone}` : ""}`}
                  onClick={() => (item.href ? router.push(item.href) : openManage())}
                >
                  <div className="ac33-insight-icon">{item.icon}</div>
                  <div>
                    <b>{item.title}</b>
                    <small>{item.text}</small>
                  </div>
                  <ArrowRight />
                </button>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="ac33-bottom">
        <article className="ac33-panel">
          <div className="ac33-panel-head">
            <div>
              <h2>Recent Account Activity</h2>
              <p>Latest updates from your accounts.</p>
            </div>
            <button type="button" className="ac33-btn" onClick={() => router.push("/transactions")}>
              View all
            </button>
          </div>
          <div className="ac33-activity">
            {recent.length ? (
              recent.map((item) => (
                <ActivityRow key={item.id} item={item} accounts={accounts.data} currency={currency} />
              ))
            ) : (
              <p className="ac33-empty">Recent transactions will show here once you start recording activity.</p>
            )}
          </div>
        </article>

        <article className="ac33-panel">
          <div className="ac33-panel-head">
            <div>
              <h2>Quick Actions</h2>
              <p>Common account tasks.</p>
            </div>
          </div>
          <div className="ac33-actions">
            <button type="button" className="ac33-action" onClick={openAdd}>
              <div className="ac33-action-icon">
                <Plus />
              </div>
              <b>Add account</b>
              <small>Link a new account</small>
            </button>
            <button type="button" className="ac33-action" onClick={openManage}>
              <div className="ac33-action-icon">
                <Link2 />
              </div>
              <b>Manage accounts</b>
              <small>Edit or unlink</small>
            </button>
            <button
              type="button"
              className="ac33-action"
              onClick={() => router.push("/transactions?action=add")}
            >
              <div className="ac33-action-icon">
                <ArrowLeftRight />
              </div>
              <b>Transfer money</b>
              <small>Move between accounts</small>
            </button>
            <button type="button" className="ac33-action" onClick={() => router.push("/reports")}>
              <div className="ac33-action-icon">
                <BarChart3 />
              </div>
              <b>View analytics</b>
              <small>See trends & insights</small>
            </button>
          </div>
          <div className="ac33-premium">
            <div className="ac33-premium-icon">
              <Gem />
            </div>
            <div>
              <b>Get more with Premium</b>
              <small>Link unlimited accounts, get smart insights and personalized recommendations.</small>
            </div>
            <button type="button" className="ac33-upgrade" onClick={() => router.push("/premium")}>
              Upgrade Now →
            </button>
          </div>
        </article>
      </section>

      <Modal open={Boolean(editing)} title="Edit account" onClose={() => setEditing(null)}>
        {editing ? (
          <AccountForm
            key={editing.id}
            catalog={catalog.data}
            currency={currency}
            initial={editing}
            onSaved={() => {
              setEditing(null);
              toast.success("Account saved");
              refresh();
            }}
          />
        ) : null}
      </Modal>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Manage accounts">
        <div className="grid gap-3">
          {listed.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-[var(--mint)] text-[var(--primary)]">
                {accountIcon(account.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{accountDisplayName(account)}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {money(displayBalance(account), account.currency)} · {account.isActive ? "Active" : "Inactive"}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setManageOpen(false);
                  setEditing(account);
                }}
              >
                Edit
              </Button>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setManageOpen(false);
                openAdd();
              }}
            >
              <Plus size={16} /> Add bank
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function buildMix(accounts: Account[]) {
  const byType = new Map<AccountType, number>();
  for (const account of accounts) {
    const value = displayBalance(account);
    byType.set(account.type, (byType.get(account.type) ?? 0) + value);
  }
  const positiveTotal = [...byType.values()].filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const basis = positiveTotal || Math.abs([...byType.values()].reduce((sum, value) => sum + value, 0)) || 1;
  return [...byType.entries()]
    .map(([type, value]) => ({
      key: type,
      label: accountTypeLabel(type),
      value,
      color: MIX_COLORS[type] ?? MIX_COLORS.OTHER!,
      pct: (value / basis) * 100,
    }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}

function buildDonutStops(mix: Array<{ value: number; color: string; pct: number }>) {
  const positive = mix.filter((item) => item.value > 0);
  if (!positive.length) return "#153427 0 100%";
  let cursor = 0;
  const parts: string[] = [];
  for (const item of positive) {
    const next = cursor + Math.max(0, item.pct);
    parts.push(`${item.color} ${cursor}% ${next}%`);
    cursor = next;
  }
  if (cursor < 100) parts.push(`#153427 ${cursor}% 100%`);
  return parts.join(", ");
}

function buildInsights(
  accounts: Account[],
  opts: { income: number; spent: number; net: number; currency: string },
) {
  const items: Array<{ title: string; text: string; tone?: string; icon: ReactNode; href?: string }> = [];
  const bank = accounts.find((item) => item.type === "BANK");
  const credit = accounts.find((item) => item.type === "CREDIT_CARD");
  const upi = accounts.find((item) => item.type === "UPI");

  if (bank && bank.currentBalanceMinor > 0) {
    items.push({
      title: "Bank balance is healthy",
      text: `You have ${money(bank.currentBalanceMinor, bank.currency)} available in ${accountDisplayName(bank)}.`,
      icon: <Sparkles />,
      href: "/bank",
    });
  } else {
    items.push({
      title: "Keep an eye on liquidity",
      text: "Link a bank account or update opening balances to track cash more accurately.",
      icon: <Sparkles />,
      href: "/bank",
    });
  }

  if (credit && credit.currentBalanceMinor > 0) {
    items.push({
      title: "Credit card spending is elevated",
      text: `${money(credit.currentBalanceMinor, credit.currency)} is outstanding on ${accountDisplayName(credit)}.`,
      tone: "blue",
      icon: <CreditCard />,
      href: "/cards",
    });
  } else {
    items.push({
      title: "Cards look manageable",
      text: "No large credit balances are showing right now.",
      tone: "blue",
      icon: <CreditCard />,
      href: "/cards",
    });
  }

  items.push({
    title: opts.net >= 0 ? "Net savings are positive" : "Spending outpaced income",
    text:
      opts.net >= 0
        ? `You saved ${money(opts.net, opts.currency)} this month so far.`
        : `Net is ${money(opts.net, opts.currency)} this month — review transfers and top categories.`,
    tone: "purple",
    icon: <Smartphone />,
    href: "/reports",
  });

  if (!upi) {
    items.push({
      title: "Consider adding another account",
      text: "Link your investment, UPI, or savings account for a fuller picture.",
      tone: "gold",
      icon: <Plus />,
      href: "/bank",
    });
  } else {
    items.push({
      title: "UPI is ready for everyday spend",
      text: `${accountDisplayName(upi)} is linked and active for quick payments.`,
      tone: "gold",
      icon: <Plus />,
      href: "/upi-credit",
    });
  }

  return items.slice(0, 4);
}

function ActivityRow({
  item,
  accounts,
  currency,
}: {
  item: Transaction;
  accounts: Account[];
  currency: string;
}) {
  const account = accounts.find((entry) => entry.id === item.accountId);
  const title = account
    ? account.type === "BANK"
      ? bankLabel(account)
      : accountDisplayName(account)
    : item.merchant || "Account";
  const detail =
    item.type === "INCOME"
      ? item.merchant || "Money received"
      : item.type === "TRANSFER"
        ? "Transfer"
        : item.merchant
          ? `Paid to ${item.merchant}`
          : item.categoryName || "Expense";
  const inflow = item.type === "INCOME";
  return (
    <div className="ac33-activity-row">
      <div className="ac33-activity-icon">{account ? accountIcon(account.type) : <WalletCards />}</div>
      <div>
        <b>{title}</b>
        <small>{detail}</small>
      </div>
      <strong className={inflow ? "in" : "out"}>
        {signedMoney(item.amountMinor, item.currency || currency, item.type === "TRANSFER" ? "EXPENSE" : item.type)}
      </strong>
      <span className="ac33-date">{formatActivityDate(item.transactionAt)}</span>
    </div>
  );
}

function AccountForm({
  catalog,
  currency,
  initial,
  onSaved,
}: {
  catalog: AccountCatalogItem[];
  currency: string;
  initial: Account;
  onSaved: () => void;
}) {
  const meta = catalog.find((item) => item.id === initial.catalogId || item.type === initial.type);
  const [name, setName] = useState(initial.name);
  const [institutionName, setInstitution] = useState(initial.institutionName ?? "");
  const [opening, setOpening] = useState(String((initial.openingBalanceMinor ?? 0) / 100));
  const [active, setActive] = useState(initial.isActive);
  const mutation = useMutation({
    mutationFn: () =>
      accountService.update(initial.id, {
        name,
        institutionName: institutionName || null,
        openingBalanceMinor: Math.round(Number(opening) * 100),
        currency,
        isActive: active,
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
      <p className="rounded-[15px] border border-[var(--border)] bg-[var(--muted)] p-3.5 text-[12px] font-medium leading-relaxed text-[var(--muted-foreground)]">
        {meta?.description ?? "This account comes from the Hisaab catalog."} Type cannot be changed.
      </p>
      <Field label="Account name">
        <Input required value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Opening balance">
        <Input
          inputMode="decimal"
          required
          value={opening}
          onChange={(event) => setOpening(event.target.value)}
        />
      </Field>
      <Field label="Institution (optional)">
        <Input value={institutionName} onChange={(event) => setInstitution(event.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="accent-[var(--primary)]"
        />
        Account is active
      </label>
      {mutation.error ? <p className="text-sm text-[var(--danger)]">{mutation.error.message}</p> : null}
      <Button disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save account"}</Button>
    </form>
  );
}
