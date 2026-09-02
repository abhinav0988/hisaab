import { sql } from "drizzle-orm";
import { accounts, transactions } from "./schema";

/**
 * Balance from opening + transaction sums. Catalog CREDIT_CARD accounts are
 * payment channels only — per-card limits live on credit_facilities.used_minor.
 */
export const accountBalanceMinorSql = sql<number>`${accounts.openingBalanceMinor} + coalesce(sum(case when ${accounts.type} = 'CREDIT_CARD' then 0 when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else -${transactions.amountMinor} end), 0)`;
