import type { transactionQuerySchema } from "@hisaab/validation";
import type { z } from "zod";

type Query = z.infer<typeof transactionQuerySchema>;

export type TransactionFilterSql = {
  where: string;
  values: unknown[];
  order: string;
  limit: number;
  offset: number;
};

const ORDER_BY: Record<Query["sort"], string> = {
  newest: "t.transaction_at DESC",
  oldest: "t.transaction_at ASC",
  amount_desc: "t.amount_minor DESC",
  amount_asc: "t.amount_minor ASC",
};

/** Shared FROM/JOIN used by list + count so search can use account/category columns. */
export const TRANSACTION_LIST_FROM = `transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts dest ON dest.id = t.destination_account_id
  JOIN categories c ON c.id = t.category_id`;

export function buildTransactionFilterSql(userId: string, query: Query): TransactionFilterSql {
  const conditions = ["t.user_id = ?", "t.deleted_at IS NULL"];
  const values: unknown[] = [userId];

  if (query.from) {
    conditions.push("t.transaction_at >= ?");
    values.push(query.from);
  }
  if (query.to) {
    conditions.push("t.transaction_at < ?");
    values.push(query.to);
  }
  if (query.category_id) {
    conditions.push("t.category_id = ?");
    values.push(query.category_id);
  }
  if (query.account_id) {
    conditions.push("(t.account_id = ? OR t.destination_account_id = ?)");
    values.push(query.account_id, query.account_id);
  }
  if (query.type) {
    conditions.push("t.type = ?");
    values.push(query.type);
  }
  if (query.search) {
    conditions.push(
      `(t.merchant LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\' OR IFNULL(dest.name, '') LIKE ? ESCAPE '\\' OR IFNULL(a.institution_name, '') LIKE ? ESCAPE '\\')`,
    );
    const term = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
    values.push(term, term, term, term, term, term);
  }

  return {
    where: conditions.join(" AND "),
    values,
    order: ORDER_BY[query.sort],
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  };
}
