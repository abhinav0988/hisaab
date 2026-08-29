export type Currency = "INR" | "NPR" | "PKR" | "BDT" | "USD";
export type TransactionType = "INCOME" | "EXPENSE";
export type AccountType =
  | "CASH"
  | "BANK"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "MOBILE_WALLET"
  | "UPI"
  | "OTHER";
export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
  requestId: string;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface AccountCatalogItem {
  id: string;
  type: AccountType;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}
export interface Account {
  id: string;
  catalogId?: string | null;
  name: string;
  type: AccountType;
  institutionName: string | null;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
  currency: Currency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  colour: string;
  isSystem: boolean;
}
export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amountMinor: number;
  currency: Currency;
  merchant: string | null;
  notes: string | null;
  transactionAt: string;
  accountName?: string;
  categoryName?: string;
  categoryIcon?: string;
  tags?: string[];
}
export interface Budget {
  id: string;
  categoryId: string | null;
  categoryName?: string | null;
  month: string;
  amountMinor: number;
  alertPercentage: number;
  spentMinor: number;
  remainingMinor: number;
  percentageUsed: number;
}
export interface Profile {
  id?: string;
  name: string;
  email: string;
  countryCode: string;
  defaultCurrency: string;
  timezone: string;
  dateFormat: string;
  theme: string;
  language?: string;
  profileNote?: string | null;
  smartNotifications?: boolean;
  weeklySummary?: boolean;
  appLockEnabled?: boolean;
  emailVerified: boolean;
}

export type SubscriptionPlan = "free" | "premium";
export type SubscriptionStatus = "inactive" | "trial" | "active" | "canceled" | "past_due";
export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingInterval: "monthly" | "yearly" | null;
  currency: Currency;
  amountMinor: number | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  targetAmountMinor: number;
  savedAmountMinor: number;
  currency: Currency;
  targetDate: string | null;
  notes: string | null;
  isActive: boolean;
}
export interface GoalContribution {
  id: string;
  goalId: string;
  goalName?: string;
  amountMinor: number;
  source: string;
  notes: string | null;
  contributedAt: string;
}
export interface DashboardSummary {
  spentThisMonth: number;
  incomeThisMonth: number;
  netSavings: number;
  todaySpending: number;
  budgetTotal: number;
  budgetRemaining: number;
  budgetPercentage: number;
  daysRemaining: number;
  currency?: string;
  sevenDaySpending: Array<{ date: string; amount: number }>;
  categorySpending: Array<{ name: string; value: number; colour: string }>;
  monthlyComparison: Array<{ month: string; income: number; expense: number }>;
  recentTransactions: Transaction[];
}
