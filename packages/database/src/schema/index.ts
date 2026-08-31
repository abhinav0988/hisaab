import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
};

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: text("createdAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt")
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
});
export const sessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: text("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);
export const authAccounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: text("accessTokenExpiresAt"),
    refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [index("auth_account_user_idx").on(table.userId)],
);
export const verifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expiresAt").notNull(),
    createdAt: text("createdAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt")
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  countryCode: text("country_code").notNull().default("IN"),
  defaultCurrency: text("default_currency").notNull().default("INR"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
  theme: text("theme").notNull().default("system"),
  language: text("language").notNull().default("en"),
  profileNote: text("profile_note"),
  smartNotifications: integer("smart_notifications", { mode: "boolean" }).notNull().default(true),
  weeklySummary: integer("weekly_summary", { mode: "boolean" }).notNull().default(true),
  appLockEnabled: integer("app_lock_enabled", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const accountCatalog = sqliteTable(
  "account_catalog",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("account_catalog_type_unique").on(table.type)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    catalogId: text("catalog_id").references(() => accountCatalog.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    institutionName: text("institution_name"),
    openingBalanceMinor: integer("opening_balance_minor").notNull().default(0),
    currency: text("currency").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("accounts_user_idx").on(table.userId),
    uniqueIndex("accounts_user_catalog_unique").on(table.userId, table.catalogId),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    icon: text("icon").notNull(),
    colour: text("colour").notNull(),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("categories_user_idx").on(table.userId),
    uniqueIndex("categories_owner_name_type_unique").on(table.userId, table.name, table.type),
  ],
);

export const recurringTransactions = sqliteTable(
  "recurring_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    merchant: text("merchant"),
    notes: text("notes"),
    frequency: text("frequency").notNull(),
    startAt: text("start_at").notNull(),
    nextRunAt: text("next_run_at").notNull(),
    lastRunAt: text("last_run_at"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("recurring_due_idx").on(table.isActive, table.nextRunAt),
    check("recurring_amount_positive", sql`${table.amountMinor} > 0`),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    recurringTransactionId: text("recurring_transaction_id").references(
      () => recurringTransactions.id,
      { onDelete: "set null" },
    ),
    type: text("type").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    merchant: text("merchant"),
    notes: text("notes"),
    transactionAt: text("transaction_at").notNull(),
    ...timestamps,
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.transactionAt),
    index("transactions_user_category_idx").on(table.userId, table.categoryId),
    index("transactions_user_account_idx").on(table.userId, table.accountId),
    check("transaction_amount_positive", sql`${table.amountMinor} > 0`),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("tags_user_name_unique").on(table.userId, table.name)],
);
export const transactionTags = sqliteTable(
  "transaction_tags",
  {
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.transactionId, table.tagId] })],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    alertPercentage: integer("alert_percentage").notNull().default(80),
    ...timestamps,
  },
  (table) => [
    index("budgets_user_month_idx").on(table.userId, table.month),
    uniqueIndex("budgets_user_month_category_unique").on(
      table.userId,
      table.month,
      table.categoryId,
    ),
    check("budget_amount_positive", sql`${table.amountMinor} > 0`),
    check("budget_alert_range", sql`${table.alertPercentage} BETWEEN 1 AND 100`),
  ],
);

export const recurringOccurrences = sqliteTable(
  "recurring_occurrences",
  {
    id: text("id").primaryKey(),
    recurringTransactionId: text("recurring_transaction_id")
      .notNull()
      .references(() => recurringTransactions.id, { onDelete: "cascade" }),
    scheduledFor: text("scheduled_for").notNull(),
    generatedTransactionId: text("generated_transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("recurring_occurrence_unique").on(table.recurringTransactionId, table.scheduledFor),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    oldValueJson: text("old_value_json"),
    newValueJson: text("new_value_json"),
    ipHash: text("ip_hash"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index("audit_user_date_idx").on(table.userId, table.createdAt)],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("inactive"),
    billingInterval: text("billing_interval"),
    currency: text("currency").notNull().default("INR"),
    amountMinor: integer("amount_minor"),
    trialEndsAt: text("trial_ends_at"),
    currentPeriodEndsAt: text("current_period_ends_at"),
    canceledAt: text("canceled_at"),
    ...timestamps,
  },
  (table) => [index("subscriptions_status_idx").on(table.status)],
);

export const savingsGoals = sqliteTable(
  "savings_goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("★"),
    targetAmountMinor: integer("target_amount_minor").notNull(),
    savedAmountMinor: integer("saved_amount_minor").notNull().default(0),
    currency: text("currency").notNull(),
    targetDate: text("target_date"),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("savings_goals_user_idx").on(table.userId),
    check("savings_goal_target_positive", sql`${table.targetAmountMinor} > 0`),
    check("savings_goal_saved_non_negative", sql`${table.savedAmountMinor} >= 0`),
  ],
);

export const goalContributions = sqliteTable(
  "goal_contributions",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    source: text("source").notNull().default("MANUAL"),
    notes: text("notes"),
    contributedAt: text("contributed_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("goal_contributions_goal_idx").on(table.goalId, table.contributedAt),
    check("goal_contribution_positive", sql`${table.amountMinor} > 0`),
  ],
);

export const inAppNotifications = sqliteTable(
  "in_app_notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index("in_app_notifications_user_idx").on(table.userId, table.createdAt)],
);

export const receipts = sqliteTable(
  "receipts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    status: text("status").notNull().default("PENDING"),
    merchant: text("merchant"),
    amountMinor: integer("amount_minor"),
    extractedJson: text("extracted_json"),
    ...timestamps,
  },
  (table) => [index("receipts_user_idx").on(table.userId, table.createdAt)],
);

export const apiRateLimits = sqliteTable(
  "api_rate_limits",
  {
    key: text("key").notNull(),
    bucket: integer("bucket").notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.bucket] }),
    index("api_rate_limits_expiry_idx").on(table.expiresAt),
  ],
);

export const investments = sqliteTable(
  "investments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    detail: text("detail"),
    investedMinor: integer("invested_minor").notNull().default(0),
    currentMinor: integer("current_minor").notNull().default(0),
    sipMinor: integer("sip_minor").notNull().default(0),
    sipDay: text("sip_day"),
    currency: text("currency").notNull(),
    ...timestamps,
  },
  (table) => [
    index("investments_user_idx").on(table.userId),
    check(
      "investment_amounts_non_negative",
      sql`${table.investedMinor} >= 0 AND ${table.currentMinor} >= 0 AND ${table.sipMinor} >= 0`,
    ),
  ],
);

export const ipoApplications = sqliteTable(
  "ipo_applications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    appliedOn: text("applied_on").notNull(),
    allotmentOn: text("allotment_on"),
    amountMinor: integer("amount_minor").notNull(),
    lots: integer("lots").notNull().default(1),
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    ...timestamps,
  },
  (table) => [
    index("ipo_applications_user_idx").on(table.userId),
    check("ipo_amount_positive", sql`${table.amountMinor} > 0`),
    check("ipo_lots_positive", sql`${table.lots} > 0`),
  ],
);

export const loans = sqliteTable(
  "loans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lender: text("lender").notNull(),
    rate: text("rate").notNull(),
    emiMinor: integer("emi_minor").notNull(),
    outstandingMinor: integer("outstanding_minor").notNull(),
    dueOn: text("due_on").notNull(),
    remainingEmis: integer("remaining_emis").notNull().default(0),
    progress: integer("progress").notNull().default(0),
    currency: text("currency").notNull(),
    ...timestamps,
  },
  (table) => [
    index("loans_user_idx").on(table.userId),
    check("loan_amounts_non_negative", sql`${table.emiMinor} >= 0 AND ${table.outstandingMinor} >= 0`),
    check("loan_progress_range", sql`${table.progress} >= 0 AND ${table.progress} <= 100`),
    check("loan_remaining_non_negative", sql`${table.remainingEmis} >= 0`),
  ],
);

export const creditFacilities = sqliteTable(
  "credit_facilities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    provider: text("provider"),
    mask: text("mask"),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    limitMinor: integer("limit_minor").notNull().default(0),
    usedMinor: integer("used_minor").notNull().default(0),
    todaySpendMinor: integer("today_spend_minor").notNull().default(0),
    overdueMinor: integer("overdue_minor").notNull().default(0),
    dueOn: text("due_on"),
    currency: text("currency").notNull(),
    ...timestamps,
  },
  (table) => [
    index("credit_facilities_user_idx").on(table.userId, table.kind),
    check("credit_kind_valid", sql`${table.kind} IN ('CARD', 'UPI')`),
    check(
      "credit_amounts_non_negative",
      sql`${table.limitMinor} >= 0 AND ${table.usedMinor} >= 0 AND ${table.todaySpendMinor} >= 0 AND ${table.overdueMinor} >= 0`,
    ),
  ],
);

export const lendRecords = sqliteTable(
  "lend_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    person: text("person").notNull(),
    relation: text("relation"),
    kind: text("kind").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    givenOn: text("given_on").notNull(),
    dueOn: text("due_on").notNull(),
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    ...timestamps,
  },
  (table) => [
    index("lend_records_user_idx").on(table.userId),
    check("lend_kind_valid", sql`${table.kind} IN ('lent', 'borrowed')`),
    check("lend_status_valid", sql`${table.status} IN ('pending', 'due', 'settled')`),
    check("lend_amount_positive", sql`${table.amountMinor} > 0`),
  ],
);
