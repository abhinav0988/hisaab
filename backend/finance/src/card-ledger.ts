export function mapCardLedgerRow(row: {
  id: string;
  type: string;
  amountMinor: number;
  transactionAt: string;
}) {
  const type =
    row.type === "INCOME" || row.type === "EXPENSE" || row.type === "TRANSFER"
      ? row.type
      : "EXPENSE";
  return {
    id: row.id,
    type,
    amountMinor: Number(row.amountMinor ?? 0),
    transactionAt: row.transactionAt,
  };
}
