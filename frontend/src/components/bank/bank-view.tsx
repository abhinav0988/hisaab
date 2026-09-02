"use client";

import type { Account, Transaction } from "@hisaab/types";
import { Button, Card, Field, Input, Select } from "@hisaab/ui";
import { majorToMinor } from "@hisaab/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  MoreVertical,
  Plus,
  ShieldCheck,
  Trophy,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Modal } from "@/components/layout/modal";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/states";
import { ApiError } from "@/lib/api-client";
import {
  BANK_ACCOUNT_TYPES,
  avgMonthlyBalance,
  bankAbbrev,
  bankBrandTone,
  bankLabel,
  bankLast4,
  bankSubtype,
  deltaPct,
  downloadBankCsv,
  formatBankAccountName,
  INDIAN_BANKS,
} from "@/lib/bank";
import { displayDateLong } from "@/lib/finance-modules";
import { money, signedMoney } from "@/lib/format";
import { accountService } from "@/services/account.service";
import { dashboardService } from "@/services/dashboard.service";
import { profileService } from "@/services/profile.service";
import { transactionService } from "@/services/transaction.service";

function failMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save. Try again.";
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function sparkline(balanceMinor: number, points = 7) {
  const base = Math.max(balanceMinor, 1);
  const values: number[] = [];
  let running = base;
  for (let index = 0; index < points; index += 1) {
    const drift = ((index - points / 2) / points) * 0.04;
    running = Math.round(base * (1 + drift + (Math.sin(index) * 0.02)));
    values.push(running);
  }
  values[points - 1] = balanceMinor;
  return values.map((value, index) => ({ index, value }));
}

function buildBalanceTrend(totalMinor: number, transactions: Transaction[], bankIds: Set<string>) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthNet = transactions
    .filter((item) => bankIds.has(item.accountId))
    .reduce(
      (sum, item) => sum + (item.type === "INCOME" ? item.amountMinor : -item.amountMinor),
      0,
    );
  let running = totalMinor - monthNet;
  const byDay = new Map<number, number>();
  for (let day = 1; day <= daysInMonth; day += 1) byDay.set(day, running);
  const sorted = [...transactions]
    .filter((item) => bankIds.has(item.accountId))
    .sort((left, right) => left.transactionAt.localeCompare(right.transactionAt));
  for (const item of sorted) {
    const date = new Date(item.transactionAt);
    if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) continue;
    const delta = item.type === "INCOME" ? item.amountMinor : -item.amountMinor;
    for (let day = date.getDate(); day <= daysInMonth; day += 1) {
      byDay.set(day, (byDay.get(day) ?? running) + delta);
    }
    running += delta;
  }
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const label = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
      new Date(now.getFullYear(), now.getMonth(), day),
    );
    return { label, balance: byDay.get(day) ?? totalMinor };
  });
}

function DeltaNote({ value, invert }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : ArrowLeftRight;
  return (
    <span
      className={
        positive
          ? "text-[var(--primary)]"
          : negative
            ? "text-[var(--warning)]"
            : "text-[var(--muted-foreground)]"
      }
    >
      <Icon size={12} className="inline me-0.5" aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

export function BankView() {
  const router = useRouter();
  const client = useQueryClient();
  const [hideBalance, setHideBalance] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const banks = useQuery({ queryKey: ["bank-accounts"], queryFn: () => accountService.listBanks() });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.summary() });
  const transactions = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: async () => {
      const from = monthStartIso();
      const result = await transactionService.list(
        new URLSearchParams({
          from,
          limit: "100",
          sort: "newest",
        }).toString(),
      );
      return result.data;
    },
  });

  if (profile.isLoading || banks.isLoading || dashboard.isLoading) return <PageSkeleton />;
  if (!profile.data || !banks.data || !dashboard.data)
    return <ErrorState retry={() => void banks.refetch()} />;

  const currency = profile.data.defaultCurrency;
  const accounts = banks.data;
  const bankIds = new Set(accounts.map((item) => item.id));
  const totalMinor = accounts.reduce((sum, item) => sum + item.currentBalanceMinor, 0);
  const data = dashboard.data;
  const monthly = data.monthlyComparison;
  const lastMonth = monthly.at(-2);
  const incomeDelta = lastMonth ? deltaPct(data.incomeThisMonth, lastMonth.income) : 0;
  const expenseDelta = lastMonth ? deltaPct(data.spentThisMonth, lastMonth.expense) : 0;
  const lastNet = lastMonth ? lastMonth.income - lastMonth.expense : 0;
  const savingsDelta = lastNet ? deltaPct(data.netSavings, lastNet) : 0;
  const avgBalance = avgMonthlyBalance(totalMinor, monthly);
  const prevAvg = lastMonth
    ? avgMonthlyBalance(totalMinor - (data.incomeThisMonth - data.spentThisMonth), monthly.slice(0, -1))
    : avgBalance;
  const avgDelta = prevAvg ? deltaPct(avgBalance, prevAvg) : 0;
  const txns = transactions.data ?? [];
  const bankTxns = txns.filter((item) => bankIds.has(item.accountId));
  const recent = bankTxns.slice(0, 5);
  const cashFlow = monthly.map((item) => ({
    month: item.month,
    income: item.income,
    expense: item.expense,
    savings: item.income - item.expense,
  }));
  const balanceTrend = buildBalanceTrend(totalMinor, bankTxns, bankIds);
  const primaryId =
    accounts.find((item) => (item as Account & { catalogId?: string | null }).catalogId)?.id ??
    accounts[0]?.id;

  function refresh() {
    void client.invalidateQueries({ queryKey: ["bank-accounts"] });
    void client.invalidateQueries({ queryKey: ["accounts"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
    void client.invalidateQueries({ queryKey: ["bank-transactions"] });
  }

  function handleDownload() {
    downloadBankCsv(accounts, currency, totalMinor);
    toast.success("Bank summary downloaded");
  }

  return (
    <div>
      <PageHeader
        title="Bank"
        description="Your linked bank balances. Use this account when salary, transfers, or bank payments move through your account."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus size={14} />
              Add account
            </Button>
            <Button onClick={() => router.push("/transactions?action=add")}>
              <Plus size={14} />
              Add transaction
            </Button>
          </>
        }
      />

      <Card className="bank-hero">
        <div className="bank-hero-copy">
          <small>Total Bank Balance</small>
          <div className="bank-hero-row">
            <strong>{hideBalance ? "₹ ••••••" : money(totalMinor, currency)}</strong>
            <button
              type="button"
              className="bank-hero-eye"
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
              onClick={() => setHideBalance((value) => !value)}
            >
              {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span>Across {accounts.length} linked account{accounts.length === 1 ? "" : "s"}</span>
        </div>
        <div className="bank-hero-art" aria-hidden="true">
          <Landmark size={72} strokeWidth={1.2} />
        </div>
      </Card>

      <div className="bank-kpis">
        {(
          [
            {
              label: "Income This Month",
              value: money(data.incomeThisMonth, currency),
              delta: incomeDelta,
              invert: false,
              icon: Wallet,
              tone: "green",
            },
            {
              label: "Expense This Month",
              value: money(data.spentThisMonth, currency),
              delta: expenseDelta,
              invert: true,
              icon: ArrowDownRight,
              tone: "orange",
            },
            {
              label: "Net Savings",
              value: money(data.netSavings, currency),
              delta: savingsDelta,
              invert: false,
              icon: Trophy,
              tone: "purple",
            },
            {
              label: "Avg. Monthly Balance",
              value: money(avgBalance, currency),
              delta: avgDelta,
              invert: false,
              icon: BarChart3,
              tone: "blue",
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="loans-kpi">
              <span className={`loans-kpi-icon is-${item.tone}`}>
                <Icon size={16} />
              </span>
              <div>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <span>
                  <DeltaNote value={item.delta} invert={item.invert} /> vs last month
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="bank-board">
        <div className="bank-board-main">
          <Card className="bank-accounts">
            <header>
              <div>
                <h2>Your Bank Accounts</h2>
                <small>Balances, account type and recent movement.</small>
              </div>
            </header>
            {accounts.length ? (
              <ul>
                {accounts.map((account) => (
                  <BankAccountRow
                    key={account.id}
                    account={account}
                    currency={currency}
                    primary={account.id === primaryId}
                    menuOpen={menuId === account.id}
                    onMenu={() => setMenuId(menuId === account.id ? null : account.id)}
                    onEdit={() => router.push("/accounts")}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No bank accounts yet"
                description="Add your first bank account to track balances and transactions here."
                action={
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus size={14} />
                    Add bank account
                  </Button>
                }
              />
            )}
            <button type="button" className="bank-add-link" onClick={() => setAddOpen(true)}>
              <Plus size={14} />
              Add New Bank Account
            </button>
          </Card>

          <Card className="bank-chart">
            <header>
              <div>
                <h2>Monthly Cash Flow</h2>
                <small>Income, expense and net savings by month.</small>
              </div>
            </header>
            <div className="bank-chart-body">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={cashFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `₹${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      money(Number(value ?? 0), currency),
                      name === "income" ? "Income" : name === "expense" ? "Expense" : "Net savings",
                    ]}
                  />
                  <Bar dataKey="income" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="expense" fill="var(--danger)" radius={[4, 4, 0, 0]} barSize={18} />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="#f0f4f8"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="bank-board-side">
          <Card className="bank-side-chart">
            <header>
              <div>
                <h2>Balance Trend</h2>
                <small>This month</small>
              </div>
              <strong>{hideBalance ? "••••" : money(totalMinor, currency)}</strong>
            </header>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={balanceTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bankBalanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => money(Number(value ?? 0), currency)} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--primary)"
                  fill="url(#bankBalanceFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="bank-recent">
            <header>
              <div>
                <h2>Recent Transactions</h2>
                <small>Latest activity on bank accounts.</small>
              </div>
              <Link href="/transactions" className="bank-link">View all</Link>
            </header>
            {recent.length ? (
              <ul>
                {recent.map((item) => (
                  <li key={item.id}>
                    <span className="bank-txn-icon" data-tone={item.type === "INCOME" ? "in" : "out"}>
                      {item.categoryIcon ?? (item.type === "INCOME" ? "+" : "−")}
                    </span>
                    <div>
                      <strong>{item.merchant || item.categoryName || "Transaction"}</strong>
                      <small>
                        {bankLabel({
                          name: item.accountName ?? "Bank",
                          institutionName: item.accountName ?? null,
                        })}{" "}
                        · {displayDateLong(item.transactionAt.slice(0, 10))}
                      </small>
                    </div>
                    <b className={item.type === "INCOME" ? "is-in" : "is-out"}>
                      {signedMoney(item.amountMinor, currency, item.type)}
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bank-empty-note">Add a transaction on a bank account to see activity here.</p>
            )}
          </Card>

          <Card className="bank-insight">
            <div className="bank-insight-art" aria-hidden="true">
              <Trophy size={28} />
            </div>
            <div>
              <small>Smart Insights</small>
              <strong>
                You saved {money(data.netSavings, currency)} this month
                {savingsDelta > 0 ? ` — ${savingsDelta}% higher than last month.` : "."}
              </strong>
              <p>Keep salary and big transfers tagged to bank accounts for clearer cash-flow charts.</p>
            </div>
          </Card>

          <Card className="bank-actions">
            <h2>Quick Actions</h2>
            <div className="bank-actions-grid">
              <QuickAction icon={Plus} label="Add Account" onClick={() => setAddOpen(true)} />
              <QuickAction
                icon={ArrowLeftRight}
                label="Fund Transfer"
                onClick={() => router.push("/transactions?action=add")}
              />
              <QuickAction icon={FileText} label="Account Summary" onClick={handleDownload} />
              <QuickAction icon={Download} label="Download Report" onClick={handleDownload} />
            </div>
          </Card>
        </div>
      </div>

      <AddBankAccountModal
        open={addOpen}
        currency={currency}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          refresh();
          toast.success("Bank account added");
        }}
      />
    </div>
  );
}

function BankAccountRow({
  account,
  currency,
  primary,
  menuOpen,
  onMenu,
  onEdit,
}: {
  account: Account;
  currency: string;
  primary: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  onEdit: () => void;
}) {
  const label = bankLabel(account);
  const tone = bankBrandTone(label);
  const spark = sparkline(account.currentBalanceMinor);
  const last4 = bankLast4(account.name);

  return (
    <li className="bank-account-row">
      <span className={`bank-badge is-${tone}`}>{bankAbbrev(label)}</span>
      <div className="bank-account-copy">
        <strong>
          {label}
          {primary ? <span className="bank-pill">Primary</span> : null}
        </strong>
        <small>
          {bankSubtype(account)}
          {last4 ? ` ···${last4}` : ""}
        </small>
      </div>
      <div className="bank-account-chart">
        <ResponsiveContainer width="100%" height={36}>
          <AreaChart data={spark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              fill="color-mix(in srgb, var(--primary) 12%, transparent)"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="bank-account-balance">
        <strong>{money(account.currentBalanceMinor, currency)}</strong>
      </div>
      <div className="bank-account-menu">
        <button type="button" aria-label="Account options" onClick={onMenu}>
          <MoreVertical size={16} />
        </button>
        {menuOpen ? (
          <div className="bank-menu-pop">
            <button type="button" onClick={onEdit}>Edit account</button>
            <Link href="/transactions?action=add">Add transaction</Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="bank-quick" onClick={onClick}>
      <span><Icon size={18} /></span>
      <small>{label}</small>
    </button>
  );
}

function AddBankAccountModal({
  open,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bank, setBank] = useState<string>(INDIAN_BANKS[0]);
  const [holder, setHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [showNumber, setShowNumber] = useState(false);
  const [ifsc, setIfsc] = useState("");
  const [accountType, setAccountType] = useState<string>(BANK_ACCOUNT_TYPES[0]);
  const [nickname, setNickname] = useState("");
  const [opening, setOpening] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const last4 = accountNumber.replace(/\D/g, "").slice(-4);
      if (!last4 || last4.length < 4) throw new Error("Enter a valid account number.");
      const openingMinor = opening.trim() ? majorToMinor(opening.replace(/,/g, "")) : 0;
      return accountService.createBank({
        name: formatBankAccountName(accountType, last4, nickname || holder),
        type: "BANK",
        institutionName: bank,
        openingBalanceMinor: openingMinor,
        currency,
        isActive: true,
      });
    },
    onSuccess: onSaved,
    onError: (error) => toast.error(failMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!bank.trim()) next.bank = "Select a bank.";
    if (!holder.trim()) next.holder = "Enter account holder name.";
    const digits = accountNumber.replace(/\D/g, "");
    if (digits.length < 4) next.accountNumber = "Enter a valid account number.";
    if (ifsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc.trim())) {
      next.ifsc = "Enter a valid IFSC code.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Bank Account">
      <p className="bank-modal-lead">
        Add your bank account to track balance and transactions.
      </p>
      <form className="bank-form" onSubmit={submit}>
        <Field label="Select Bank" error={errors.bank}>
          <Select value={bank} onChange={(event) => setBank(event.target.value)}>
            {INDIAN_BANKS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <Field label="Account Holder Name" error={errors.holder}>
          <Input value={holder} onChange={(event) => setHolder(event.target.value)} placeholder="Full name" />
        </Field>
        <Field label="Account Number" error={errors.accountNumber}>
          <div className="bank-number-shell">
            <Input
              type={showNumber ? "text" : "password"}
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder="Enter account number"
              inputMode="numeric"
            />
            <button
              type="button"
              className="bank-number-toggle"
              aria-label={showNumber ? "Hide account number" : "Show account number"}
              onClick={() => setShowNumber((value) => !value)}
            >
              {showNumber ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <div className="bank-form-split">
          <Field label="IFSC Code" error={errors.ifsc}>
            <Input value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" />
          </Field>
          <Field label="Account Type">
            <Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              {BANK_ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="bank-form-split">
          <Field label="Nickname (optional)">
            <Input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="e.g. Salary account" />
          </Field>
          <Field label="Opening Balance (₹)">
            <Input
              inputMode="decimal"
              value={opening}
              onChange={(event) => setOpening(event.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
        <div className="bank-security">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            <strong>Your security is our priority.</strong> Bank details are encrypted and stored securely. We never share your data with third parties.
          </p>
        </div>
        <div className="bank-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Adding…" : "Add Account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
