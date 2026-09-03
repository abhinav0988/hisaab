import { createDatabase, userPreferences } from "@hisaab/database";
import { addLocalDays, currentMonth, monthBounds, zonedDateKey, zonedMonthKey, zonedParts } from "../../shared/dates";
import { eq } from "drizzle-orm";

export async function reportingContext(env: Env, userId: string, from?: string, to?: string) {
  const db = createDatabase(env.DB);
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  const timezone = prefs?.timezone ?? "UTC";
  const month = currentMonth(timezone);
  const bounds = from && to ? { from, to } : monthBounds(month, timezone);
  return { timezone, currency: prefs?.defaultCurrency ?? "INR", month, ...bounds };
}

type LedgerRow = { transactionAt: string; type: string; amountMinor: number };

async function ledgerRows(
  env: Env,
  userId: string,
  from: string,
  to: string,
  accountIds?: string[],
) {
  const filters = ["user_id=?", "deleted_at IS NULL", "transaction_at>=?", "transaction_at<?"];
  const values: unknown[] = [userId, from, to];
  if (accountIds?.length) {
    filters.push(
      `(account_id IN (${accountIds.map(() => "?").join(",")}) OR destination_account_id IN (${accountIds.map(() => "?").join(",")}))`,
    );
    values.push(...accountIds, ...accountIds);
  }
  return (
    await env.DB.prepare(
      `SELECT transaction_at AS transactionAt, type, amount_minor AS amountMinor, account_id AS accountId, destination_account_id AS destinationAccountId FROM transactions WHERE ${filters.join(" AND ")}`,
    )
      .bind(...values)
      .all<LedgerRow & { accountId: string; destinationAccountId: string | null }>()
  ).results;
}

function incomeExpenseFor(
  row: LedgerRow & { accountId?: string; destinationAccountId?: string | null },
  accountIds?: string[],
) {
  if (row.type === "TRANSFER") {
    if (!accountIds?.length) return { income: 0, expense: 0 };
    const inSet = accountIds.includes(row.destinationAccountId ?? "");
    const outSet = accountIds.includes(row.accountId ?? "");
    return {
      income: inSet ? Number(row.amountMinor) : 0,
      expense: outSet ? Number(row.amountMinor) : 0,
    };
  }
  return {
    income: row.type === "INCOME" ? Number(row.amountMinor) : 0,
    expense: row.type === "EXPENSE" ? Number(row.amountMinor) : 0,
  };
}

export async function totals(env: Env, userId: string, from: string, to: string) {
  const row = await env.DB.prepare(
    "SELECT coalesce(sum(CASE WHEN type='INCOME' THEN amount_minor ELSE 0 END),0) AS income, coalesce(sum(CASE WHEN type='EXPENSE' THEN amount_minor ELSE 0 END),0) AS expenses, count(DISTINCT substr(transaction_at,1,10)) AS activeDays FROM transactions WHERE user_id=? AND deleted_at IS NULL AND transaction_at>=? AND transaction_at<?",
  )
    .bind(userId, from, to)
    .first<{ income: number; expenses: number; activeDays: number }>();
  const income = Number(row?.income ?? 0);
  const expenses = Number(row?.expenses ?? 0);
  const days = Math.max(
    1,
    Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000),
  );
  return {
    totalIncome: income,
    totalExpenses: expenses,
    netSavings: income - expenses,
    savingsRate: income ? Math.round(((income - expenses) / income) * 10000) / 100 : 0,
    averageDailySpending: Math.round(expenses / days),
  };
}

export async function byCategory(env: Env, userId: string, from: string, to: string) {
  return (
    await env.DB.prepare(
      "SELECT c.id, c.name, c.colour, coalesce(sum(t.amount_minor),0) AS value FROM transactions t JOIN categories c ON c.id=t.category_id WHERE t.user_id=? AND t.deleted_at IS NULL AND t.type='EXPENSE' AND t.transaction_at>=? AND t.transaction_at<? GROUP BY c.id ORDER BY value DESC",
    )
      .bind(userId, from, to)
      .all()
  ).results;
}
export async function byAccount(env: Env, userId: string, from: string, to: string) {
  return (
    await env.DB.prepare(
      "SELECT a.id, a.name, coalesce(sum(t.amount_minor),0) AS value FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.user_id=? AND t.deleted_at IS NULL AND t.type='EXPENSE' AND t.transaction_at>=? AND t.transaction_at<? GROUP BY a.id ORDER BY value DESC",
    )
      .bind(userId, from, to)
      .all()
  ).results;
}
export async function daily(
  env: Env,
  userId: string,
  from: string,
  to: string,
  timezone = "UTC",
  accountIds?: string[],
) {
  const rows = await ledgerRows(env, userId, from, to, accountIds);
  const buckets = new Map<string, { date: string; income: number; expense: number }>();
  for (const row of rows) {
    const date = zonedDateKey(String(row.transactionAt), timezone);
    const current = buckets.get(date) ?? { date, income: 0, expense: 0 };
    const delta = incomeExpenseFor(row, accountIds);
    current.income += delta.income;
    current.expense += delta.expense;
    buckets.set(date, current);
  }
  return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date));
}
export async function monthly(
  env: Env,
  userId: string,
  timezone = "UTC",
  from?: string,
  to?: string,
  accountIds?: string[],
) {
  const now = new Date();
  const start =
    from ??
    (() => {
      const part = zonedParts(now, timezone);
      const startMonth = part.month - 11;
      const year = startMonth > 0 ? part.year : part.year - 1;
      const month = startMonth > 0 ? startMonth : startMonth + 12;
      return monthBounds(
        `${year}-${String(month).padStart(2, "0")}`,
        timezone,
      ).from;
    })();
  const end = to ?? addLocalDays(now, timezone, 1).toISOString();
  const rows = await ledgerRows(env, userId, start, end, accountIds);
  const buckets = new Map<string, { month: string; income: number; expense: number }>();
  for (const row of rows) {
    const month = zonedMonthKey(String(row.transactionAt), timezone);
    const current = buckets.get(month) ?? { month, income: 0, expense: 0 };
    const delta = incomeExpenseFor(row, accountIds);
    current.income += delta.income;
    current.expense += delta.expense;
    buckets.set(month, current);
  }
  return [...buckets.values()].sort((left, right) => left.month.localeCompare(right.month));
}

export async function dashboard(env: Env, userId: string) {
  const context = await reportingContext(env, userId);
  const nowDate = new Date();
  const todayStart = addLocalDays(nowDate, context.timezone, 0);
  const sevenStart = addLocalDays(nowDate, context.timezone, -6);
  const [summary, categorySpending, monthlyComparison, recent, todayRow, sevenDay, budget] =
    await Promise.all([
      totals(env, userId, context.from, context.to),
      byCategory(env, userId, context.from, context.to),
      monthly(env, userId, context.timezone),
      env.DB.prepare(
        "SELECT t.id,t.account_id AS accountId,t.category_id AS categoryId,t.type,t.amount_minor AS amountMinor,t.currency,t.merchant,t.notes,t.transaction_at AS transactionAt,t.destination_account_id AS destinationAccountId,a.name AS accountName,dest.name AS destinationAccountName,c.name AS categoryName,c.icon AS categoryIcon,c.colour AS categoryColour FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN accounts dest ON dest.id=t.destination_account_id JOIN categories c ON c.id=t.category_id WHERE t.user_id=? AND t.deleted_at IS NULL ORDER BY t.transaction_at DESC LIMIT 12",
      )
        .bind(userId)
        .all(),
      env.DB.prepare(
        "SELECT coalesce(sum(amount_minor),0) AS amount FROM transactions WHERE user_id=? AND deleted_at IS NULL AND type='EXPENSE' AND transaction_at>=?",
      )
        .bind(userId, todayStart.toISOString())
        .first<{ amount: number }>(),
      daily(
        env,
        userId,
        sevenStart.toISOString(),
        addLocalDays(nowDate, context.timezone, 1).toISOString(),
        context.timezone,
      ),
      env.DB.prepare(
        "SELECT amount_minor AS amount FROM budgets WHERE user_id=? AND month=? AND category_id IS NULL LIMIT 1",
      )
        .bind(userId, context.month)
        .first<{ amount: number }>(),
    ]);
  const budgetTotal = Number(budget?.amount ?? 0);
  const spent = summary.totalExpenses;
  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(context.to).getTime() - nowDate.getTime()) / 86400000),
  );
  return {
    spentThisMonth: spent,
    incomeThisMonth: summary.totalIncome,
    netSavings: summary.netSavings,
    todaySpending: Number(todayRow?.amount ?? 0),
    budgetTotal,
    budgetRemaining: budgetTotal - spent,
    budgetPercentage: budgetTotal ? Math.round((spent / budgetTotal) * 10000) / 100 : 0,
    daysRemaining,
    sevenDaySpending: sevenDay.map((row) => ({
      date: String(row.date),
      amount: Number(row.expense),
      income: Number(row.income),
    })),
    categorySpending,
    monthlyComparison,
    recentTransactions: recent.results,
    currency: context.currency,
  };
}

function safeCsv(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export async function exportCsv(env: Env, userId: string, from: string, to: string) {
  const rows = await env.DB.prepare(
    "SELECT t.transaction_at AS date,t.type,t.amount_minor AS amount,t.currency,c.name AS category,a.name AS account,t.merchant,t.notes FROM transactions t JOIN categories c ON c.id=t.category_id JOIN accounts a ON a.id=t.account_id WHERE t.user_id=? AND t.deleted_at IS NULL AND t.transaction_at>=? AND t.transaction_at<? ORDER BY t.transaction_at DESC",
  )
    .bind(userId, from, to)
    .all<Record<string, unknown>>();
  const headers = [
    "Date",
    "Type",
    "Amount",
    "Currency",
    "Category",
    "Account",
    "Merchant",
    "Notes",
  ];
  return [
    headers.map(safeCsv).join(","),
    ...rows.results.map((row) =>
      [
        row.date,
        row.type,
        (Number(row.amount) / 100).toFixed(2),
        row.currency,
        row.category,
        row.account,
        row.merchant,
        row.notes,
      ]
        .map(safeCsv)
        .join(","),
    ),
  ].join("\r\n");
}
