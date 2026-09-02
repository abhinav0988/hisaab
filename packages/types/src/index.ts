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

export type IpoStatus = "Applied" | "In progress" | "Allotted" | "Not Allotted" | "Listed";
export type LendKind = "lent" | "borrowed";
export type LendStatus = "pending" | "due" | "settled";
export type CreditFacilityKind = "CARD" | "UPI";

export interface Investment {
  id: string;
  name: string;
  type: string;
  detail: string | null;
  investedMinor: number;
  currentMinor: number;
  sipMinor: number;
  sipDay: string | null;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export interface IpoApplication {
  id: string;
  name: string;
  appliedOn: string;
  allotmentOn: string | null;
  amountMinor: number;
  lots: number;
  status: IpoStatus;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  name: string;
  lender: string;
  rate: string;
  principalMinor: number;
  emiMinor: number;
  outstandingMinor: number;
  dueOn: string;
  totalEmis: number;
  remainingEmis: number;
  emiDay: number;
  progress: number;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export type EmiInstallmentStatus = "paid" | "pending" | "overdue" | "upcoming";

export interface LoanScheduleEntry {
  installment: number;
  dueOn: string;
  amountMinor: number;
  status: EmiInstallmentStatus;
}

export interface LoanSchedule {
  loanId: string;
  items: LoanScheduleEntry[];
}

export interface CreditFacility {
  id: string;
  kind: CreditFacilityKind;
  name: string;
  provider: string | null;
  mask: string | null;
  accountId: string | null;
  limitMinor: number;
  usedMinor: number;
  todaySpendMinor: number;
  overdueMinor: number;
  holdMinor: number;
  minDueMinor: number;
  dueOn: string | null;
  cycleStartOn: string | null;
  lastPaidOn: string | null;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export interface CreditOverview {
  limitMinor: number;
  usedMinor: number;
  availableMinor: number;
  overdueMinor: number;
  holdMinor: number;
  usedPct: number;
  availablePct: number;
  overduePct: number;
  holdPct: number;
}

export interface CreditUtilisationMonth {
  month: string;
  usedMinor: number;
  limitMinor: number;
  overdueMinor: number;
  usedPct: number;
}

export interface CreditSpendingSlice {
  id: string;
  name: string;
  colour: string | null;
  amountMinor: number;
}

export interface CreditRecentTransaction {
  id: string;
  merchant: string | null;
  cardName: string;
  amountMinor: number;
  transactionAt: string;
}

export interface CreditCycleSummary {
  pendingMinor: number;
  spendMinor: number;
  transactionCount: number;
  dueOn: string | null;
}

export interface CreditDashboard {
  cards: CreditFacility[];
  overview: CreditOverview;
  trend: CreditUtilisationMonth[];
  spending: CreditSpendingSlice[];
  recent: CreditRecentTransaction[];
  cycle: CreditCycleSummary;
}

export interface CreditSpendImpact {
  facilityId: string;
  kind: CreditFacilityKind;
  name: string;
  spentMinor: number;
  usedMinor: number;
  availableMinor: number;
  pendingMinor: number;
  dueOn: string | null;
}

export interface LendRecord {
  id: string;
  person: string;
  relation: string | null;
  kind: LendKind;
  amountMinor: number;
  givenOn: string;
  dueOn: string;
  status: LendStatus;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
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
