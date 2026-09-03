export type LedgerRow = {
  transactionAt: string;
  type: string;
  amountMinor: number;
  accountId?: string;
  destinationAccountId?: string | null;
};

export function incomeExpenseFor(row: LedgerRow, accountIds?: string[]) {
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
