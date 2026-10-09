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
    creditFacilityId: text("credit_facility_id"),
    destinationAccountId: text("destination_account_id").references(() => accounts.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.transactionAt),
    index("transactions_user_category_idx").on(table.userId, table.categoryId),
    index("transactions_user_account_idx").on(table.userId, table.accountId),
    index("transactions_credit_facility_idx").on(table.creditFacilityId),
    index("transactions_destination_account_idx").on(table.destinationAccountId),
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
    normalizedName: text("normalized_name").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("tags_user_name_unique").on(table.userId, table.name),
    uniqueIndex("tags_user_normalized_unique").on(table.userId, table.normalizedName),
  ],
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
    icon: text("icon").notNull().default("*"),
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
    marketCategory: text("market_category").notNull().default("Mainboard"),
    allottedAmountMinor: integer("allotted_amount_minor"),
    listingPriceMinor: integer("listing_price_minor"),
    currentPriceMinor: integer("current_price_minor"),
    paymentSource: text("payment_source"),
    holdReleased: integer("hold_released", { mode: "boolean" }).notNull().default(false),
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
    principalMinor: integer("principal_minor").notNull().default(0),
    emiMinor: integer("emi_minor").notNull(),
    outstandingMinor: integer("outstanding_minor").notNull(),
    dueOn: text("due_on").notNull(),
    totalEmis: integer("total_emis").notNull().default(0),
    remainingEmis: integer("remaining_emis").notNull().default(0),
    emiDay: integer("emi_day").notNull().default(1),
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
    holdMinor: integer("hold_minor").notNull().default(0),
    minDueMinor: integer("min_due_minor").notNull().default(0),
    dueOn: text("due_on"),
    cycleStartOn: text("cycle_start_on"),
    lastPaidOn: text("last_paid_on"),
    currency: text("currency").notNull(),
    ...timestamps,
  },
  (table) => [
    index("credit_facilities_user_idx").on(table.userId, table.kind),
    check("credit_kind_valid", sql`${table.kind} IN ('CARD', 'UPI')`),
    check(
      "credit_amounts_non_negative",
      sql`${table.limitMinor} >= 0 AND ${table.usedMinor} >= 0 AND ${table.todaySpendMinor} >= 0 AND ${table.overdueMinor} >= 0 AND ${table.holdMinor} >= 0 AND ${table.minDueMinor} >= 0`,
    ),
  ],
);

export const creditUtilisationMonths = sqliteTable(
  "credit_utilisation_months",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    usedMinor: integer("used_minor").notNull().default(0),
    limitMinor: integer("limit_minor").notNull().default(0),
    overdueMinor: integer("overdue_minor").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("credit_utilisation_user_month_unique").on(table.userId, table.month),
    check(
      "credit_utilisation_amounts_non_negative",
      sql`${table.usedMinor} >= 0 AND ${table.limitMinor} >= 0 AND ${table.overdueMinor} >= 0`,
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

export const splitPeople = sqliteTable(
  "split_people",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    countryCode: text("country_code").default("IN"),
    email: text("email"),
    relationship: text("relationship").notNull().default("friend"),
    photoUrl: text("photo_url"),
    isSelf: integer("is_self", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("split_people_user_idx").on(table.userId),
    check(
      "split_people_relationship_valid",
      sql`${table.relationship} IN ('friend', 'family', 'colleague', 'other')`,
    ),
  ],
);

export const splitGroups = sqliteTable(
  "split_groups",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    imageUrl: text("image_url"),
    groupType: text("group_type").notNull().default("shared"),
    currency: text("currency").notNull().default("INR"),
    defaultSplitMethod: text("default_split_method").notNull().default("equal"),
    defaultDueDays: integer("default_due_days").notNull().default(7),
    allowMemberAdd: integer("allow_member_add", { mode: "boolean" }).notNull().default(true),
    allowMemberEdit: integer("allow_member_edit", { mode: "boolean" }).notNull().default(true),
    allowMemberSettle: integer("allow_member_settle", { mode: "boolean" }).notNull().default(true),
    sendNotifications: integer("send_notifications", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("split_groups_owner_idx").on(table.ownerId),
    check("split_groups_type_valid", sql`${table.groupType} IN ('shared', 'personal')`),
    check(
      "split_groups_method_valid",
      sql`${table.defaultSplitMethod} IN ('equal', 'exact', 'percentage', 'shares', 'itemwise')`,
    ),
  ],
);

export const splitGroupMembers = sqliteTable(
  "split_group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => splitGroups.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: text("joined_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("split_group_members_unique").on(table.groupId, table.personId),
    index("split_group_members_group_idx").on(table.groupId),
  ],
);

export const splitExpenses = sqliteTable(
  "split_expenses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    totalAmountMinor: integer("total_amount_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    expenseDate: text("expense_date").notNull(),
    expenseTime: text("expense_time"),
    groupId: text("group_id").references(() => splitGroups.id, { onDelete: "set null" }),
    splitMethod: text("split_method").notNull().default("equal"),
    status: text("status").notNull().default("pending"),
    dueDate: text("due_date"),
    noteForParticipants: text("note_for_participants"),
    allowPartialPayments: integer("allow_partial_payments", { mode: "boolean" }).notNull().default(true),
    sendNotifications: integer("send_notifications", { mode: "boolean" }).notNull().default(true),
    isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
    receiptId: text("receipt_id"),
    ...timestamps,
  },
  (table) => [
    index("split_expenses_user_idx").on(table.userId),
    index("split_expenses_status_idx").on(table.userId, table.status),
    check("split_expenses_amount_positive", sql`${table.totalAmountMinor} > 0`),
    check(
      "split_expenses_method_valid",
      sql`${table.splitMethod} IN ('equal', 'exact', 'percentage', 'shares', 'itemwise')`,
    ),
    check(
      "split_expenses_status_valid",
      sql`${table.status} IN ('draft', 'pending', 'partially_paid', 'partially_settled', 'almost_settled', 'settled', 'overdue', 'overpaid', 'cancelled')`,
    ),
  ],
);

export const splitExpensePayers = sqliteTable(
  "split_expense_payers",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => splitExpenses.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "restrict" }),
    paidAmountMinor: integer("paid_amount_minor").notNull(),
  },
  (table) => [
    uniqueIndex("split_expense_payers_unique").on(table.expenseId, table.personId),
    index("split_expense_payers_expense_idx").on(table.expenseId),
    check("split_expense_payers_amount_positive", sql`${table.paidAmountMinor} > 0`),
  ],
);

export const splitParticipants = sqliteTable(
  "split_participants",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => splitExpenses.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "restrict" }),
    sharePercentageBps: integer("share_percentage_bps").notNull().default(0),
    shareValue: integer("share_value").notNull().default(1),
    shareAmountMinor: integer("share_amount_minor").notNull(),
    adjustedShareAmountMinor: integer("adjusted_share_amount_minor").notNull(),
    paidAmountMinor: integer("paid_amount_minor").notNull().default(0),
    pendingAmountMinor: integer("pending_amount_minor").notNull().default(0),
    status: text("status").notNull().default("pending"),
  },
  (table) => [
    uniqueIndex("split_participants_unique").on(table.expenseId, table.personId),
    index("split_participants_expense_idx").on(table.expenseId),
    check(
      "split_participants_status_valid",
      sql`${table.status} IN ('pending', 'partially_paid', 'paid', 'overpaid', 'waived')`,
    ),
  ],
);

export const splitPayments = sqliteTable(
  "split_payments",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => splitExpenses.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => splitParticipants.id, { onDelete: "cascade" }),
    payerPersonId: text("payer_person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "restrict" }),
    receiverPersonId: text("receiver_person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
    method: text("method").notNull().default("upi"),
    referenceId: text("reference_id"),
    note: text("note"),
    proofUrl: text("proof_url"),
    paymentDate: text("payment_date").notNull(),
    status: text("status").notNull().default("completed"),
    isFinalSettlement: integer("is_final_settlement", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("split_payments_expense_idx").on(table.expenseId),
    index("split_payments_participant_idx").on(table.participantId),
    check("split_payments_amount_positive", sql`${table.amountMinor} > 0`),
    check(
      "split_payments_method_valid",
      sql`${table.method} IN ('upi', 'cash', 'bank_transfer', 'card', 'other')`,
    ),
    check("split_payments_status_valid", sql`${table.status} IN ('completed', 'voided')`),
  ],
);

export const splitAdjustments = sqliteTable(
  "split_adjustments",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => splitExpenses.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => splitParticipants.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    type: text("type").notNull(),
    reason: text("reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("split_adjustments_expense_idx").on(table.expenseId),
    check(
      "split_adjustments_type_valid",
      sql`${table.type} IN ('discount', 'waived', 'correction', 'refund', 'other')`,
    ),
  ],
);

export const splitReminders = sqliteTable(
  "split_reminders",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => splitExpenses.id, { onDelete: "cascade" }),
    participantId: text("participant_id").references(() => splitParticipants.id, {
      onDelete: "cascade",
    }),
    channel: text("channel").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    frequency: text("frequency"),
    status: text("status").notNull().default("scheduled"),
    message: text("message"),
    sentAt: text("sent_at"),
    stopAfterSettlement: integer("stop_after_settlement", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [
    index("split_reminders_expense_idx").on(table.expenseId),
    check(
      "split_reminders_channel_valid",
      sql`${table.channel} IN ('in_app', 'email', 'whatsapp', 'sms')`,
    ),
    check(
      "split_reminders_status_valid",
      sql`${table.status} IN ('scheduled', 'sent', 'cancelled', 'failed')`,
    ),
  ],
);

export const splitReceipts = sqliteTable(
  "split_receipts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expenseId: text("expense_id").references(() => splitExpenses.id, { onDelete: "set null" }),
    fileUrl: text("file_url").notNull(),
    fileId: text("file_id"),
    description: text("description"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    fileSizeBytes: integer("file_size_bytes"),
    merchant: text("merchant"),
    receiptDate: text("receipt_date"),
    subtotalMinor: integer("subtotal_minor"),
    taxMinor: integer("tax_minor"),
    totalMinor: integer("total_minor"),
    ocrStatus: text("ocr_status").notNull().default("pending"),
    ocrPayload: text("ocr_payload"),
    ...timestamps,
  },
  (table) => [
    index("split_receipts_user_idx").on(table.userId),
    check(
      "split_receipts_ocr_status_valid",
      sql`${table.ocrStatus} IN ('pending', 'processing', 'extracted', 'failed', 'manual')`,
    ),
  ],
);

export const splitItems = sqliteTable(
  "split_items",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => splitExpenses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    priceMinor: integer("price_minor").notNull(),
    kind: text("kind").notNull().default("item"),
  },
  (table) => [
    index("split_items_expense_idx").on(table.expenseId),
    check("split_items_kind_valid", sql`${table.kind} IN ('item', 'tax', 'tip')`),
    check("split_items_price_non_negative", sql`${table.priceMinor} >= 0`),
  ],
);

export const splitItemParticipants = sqliteTable(
  "split_item_participants",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => splitItems.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("split_item_participants_unique").on(table.itemId, table.personId)],
);

export const splitActivities = sqliteTable(
  "split_activities",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id").references(() => splitExpenses.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => splitGroups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorPersonId: text("actor_person_id").references(() => splitPeople.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    metadata: text("metadata"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("split_activities_expense_idx").on(table.expenseId),
    index("split_activities_user_idx").on(table.userId),
  ],
);

export const splitSettlementSuggestions = sqliteTable(
  "split_settlement_suggestions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromPersonId: text("from_person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "cascade" }),
    toPersonId: text("to_person_id")
      .notNull()
      .references(() => splitPeople.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("suggested"),
    metadata: text("metadata"),
    ...timestamps,
  },
  (table) => [
    index("split_settlement_suggestions_user_idx").on(table.userId),
    check("split_settlement_suggestions_amount_positive", sql`${table.amountMinor} > 0`),
  ],
);

export const storedFiles = sqliteTable(
  "stored_files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("stored_files_key_unique").on(table.storageKey),
    index("stored_files_user_idx").on(table.userId),
    check("stored_files_size_positive", sql`${table.sizeBytes} > 0`),
  ],
);

export const transactionAttachments = sqliteTable(
  "transaction_attachments",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => storedFiles.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("transaction_attachments_tx_file_unique").on(table.transactionId, table.fileId),
    index("transaction_attachments_user_idx").on(table.userId),
  ],
);

export const lendRepayments = sqliteTable(
  "lend_repayments",
  {
    id: text("id").primaryKey(),
    lendRecordId: text("lend_record_id")
      .notNull()
      .references(() => lendRecords.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    paidAt: text("paid_at").notNull(),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("lend_repayments_record_idx").on(table.lendRecordId),
    check("lend_repayments_amount_positive", sql`${table.amountMinor} > 0`),
  ],
);

export const loanPayments = sqliteTable(
  "loan_payments",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    installmentNumber: integer("installment_number"),
    amountMinor: integer("amount_minor").notNull(),
    paidAt: text("paid_at").notNull(),
    paymentType: text("payment_type").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("loan_payments_loan_idx").on(table.loanId),
    check("loan_payments_amount_positive", sql`${table.amountMinor} > 0`),
    check("loan_payments_type_valid", sql`${table.paymentType} IN ('EMI')`),
  ],
);

export const facilityPayments = sqliteTable(
  "facility_payments",
  {
    id: text("id").primaryKey(),
    creditFacilityId: text("credit_facility_id")
      .notNull()
      .references(() => creditFacilities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    paidAt: text("paid_at").notNull(),
    statementPeriod: text("statement_period"),
    kind: text("kind").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("facility_payments_facility_idx").on(table.creditFacilityId),
    check("facility_payments_amount_positive", sql`${table.amountMinor} > 0`),
    check("facility_payments_kind_valid", sql`${table.kind} IN ('CARD', 'UPI')`),
  ],
);

export const lendReminders = sqliteTable(
  "lend_reminders",
  {
    id: text("id").primaryKey(),
    lendRecordId: text("lend_record_id")
      .notNull()
      .references(() => lendRecords.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    remindAt: text("remind_at").notNull(),
    frequency: text("frequency").notNull(),
    lastSentAt: text("last_sent_at"),
    nextRunAt: text("next_run_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("lend_reminders_record_unique").on(table.lendRecordId),
    index("lend_reminders_due_idx").on(table.enabled, table.nextRunAt),
    check("lend_reminders_frequency_valid", sql`${table.frequency} IN ('ONCE', 'DAILY', 'WEEKLY', 'BEFORE_DUE')`),
  ],
);

export const lendReminderDeliveries = sqliteTable(
  "lend_reminder_deliveries",
  {
    id: text("id").primaryKey(),
    reminderId: text("reminder_id")
      .notNull()
      .references(() => lendReminders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    channel: text("channel").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("lend_reminder_deliveries_slot_unique").on(table.reminderId, table.slot, table.channel),
    index("lend_reminder_deliveries_user_idx").on(table.userId),
  ],
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    userId: text("user_id").notNull(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    responseJson: text("response_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.scope, table.key] })],
);
