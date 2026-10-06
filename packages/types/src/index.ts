export type Currency = "INR" | "NPR" | "PKR" | "BDT" | "USD";
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
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
  destinationAccountId?: string | null;
  accountName?: string;
  destinationAccountName?: string;
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
export type IpoMarketCategory = "Mainboard" | "SME";
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
  marketCategory: IpoMarketCategory;
  allottedAmountMinor: number | null;
  listingPriceMinor: number | null;
  currentPriceMinor: number | null;
  paymentSource: string | null;
  holdReleased: boolean;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export type UpcomingIpoStatus = "Open" | "Upcoming";

export interface UpcomingIpo {
  id: string;
  symbol: string;
  name: string;
  priceBand: string;
  openOn: string | null;
  closeOn: string | null;
  status: UpcomingIpoStatus;
  marketCategory: IpoMarketCategory;
}

export interface UpcomingIpoFeed {
  source: "NSE";
  fetchedAt: string;
  unavailable?: boolean;
  items: UpcomingIpo[];
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
  type?: "INCOME" | "EXPENSE" | "TRANSFER";
}

export interface CreditLedgerEntry {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
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
  ledger: CreditLedgerEntry[];
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

export type SplitMethod = "equal" | "exact" | "percentage" | "shares" | "itemwise";
export type SplitExpenseStatus =
  | "draft"
  | "pending"
  | "partially_paid"
  | "partially_settled"
  | "almost_settled"
  | "settled"
  | "overdue"
  | "overpaid"
  | "cancelled";
export type SplitParticipantStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "overpaid"
  | "waived";
export type SplitRelationship = "friend" | "family" | "colleague" | "other";
export type SplitPaymentMethod = "upi" | "cash" | "bank_transfer" | "card" | "other";

export interface SplitPerson {
  id: string;
  fullName: string;
  phone: string | null;
  countryCode: string | null;
  email: string | null;
  relationship: SplitRelationship;
  photoUrl: string | null;
  isSelf: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SplitGroup {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  groupType: "shared" | "personal";
  currency: Currency;
  defaultSplitMethod: SplitMethod;
  defaultDueDays: number;
  allowMemberAdd: boolean;
  allowMemberEdit: boolean;
  allowMemberSettle: boolean;
  sendNotifications: boolean;
  members?: Array<{
    id: string;
    personId: string;
    role: string;
    person: SplitPerson | null;
  }>;
  expenses?: SplitExpense[];
  createdAt: string;
  updatedAt: string;
}

export interface SplitParticipant {
  id: string;
  expenseId: string;
  personId: string;
  sharePercentageBps: number;
  shareValue: number;
  shareAmountMinor: number;
  adjustedShareAmountMinor: number;
  paidAmountMinor: number;
  pendingAmountMinor: number;
  status: SplitParticipantStatus;
  person?: SplitPerson | null;
}

export interface SplitExpense {
  id: string;
  title: string;
  description: string | null;
  category: string;
  totalAmountMinor: number;
  currency: Currency;
  expenseDate: string;
  expenseTime: string | null;
  groupId: string | null;
  splitMethod: SplitMethod;
  status: SplitExpenseStatus;
  dueDate: string | null;
  noteForParticipants: string | null;
  allowPartialPayments: boolean;
  sendNotifications: boolean;
  isDraft: boolean;
  receiptId: string | null;
  group?: SplitGroup | null;
  participants?: SplitParticipant[];
  payers?: Array<{
    id: string;
    personId: string;
    paidAmountMinor: number;
    person?: SplitPerson | null;
  }>;
  payments?: SplitPayment[];
  activities?: SplitActivity[];
  yourShareMinor?: number;
  youPaidMinor?: number;
  collectedMinor?: number;
  pendingMinor?: number;
  settledPercent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SplitPayment {
  id: string;
  expenseId: string;
  participantId: string;
  payerPersonId: string;
  receiverPersonId: string;
  amountMinor: number;
  method: SplitPaymentMethod;
  referenceId: string | null;
  note: string | null;
  proofUrl: string | null;
  paymentDate: string;
  status: string;
  isFinalSettlement: boolean;
  payer?: SplitPerson | null;
  receiver?: SplitPerson | null;
  createdAt: string;
  updatedAt: string;
}

export interface SplitActivity {
  id: string;
  expenseId: string | null;
  groupId: string | null;
  action: string;
  metadata: string | null;
  createdAt: string;
}

export interface SplitDashboard {
  summary: {
    totalSharedMinor: number;
    moneyToReceiveMinor: number;
    moneyToPayMinor: number;
    pendingSettlements: number;
    collectedMinor: number;
    pendingMinor: number;
    overdueMinor: number;
    settledPercent: number;
    totalSharedChangePct: number;
    receiveChangePct: number;
    payChangePct: number;
    pendingChange: number;
  };
  topCategories: Array<{ name: string; amountMinor: number }>;
  upcomingSettlements: Array<{
    expenseId: string;
    title: string;
    dueDate: string | null;
    pendingMinor: number;
    participants: Array<{ personId: string; name: string; pendingMinor: number }>;
  }>;
  recentExpenses: SplitExpense[];
}

export interface SplitHistory {
  summary: {
    totalExpenses: number;
    totalExpensesMinor: number;
    yourShareMinor: number;
    youPaidMinor: number;
    youOweMinor: number;
    youllReceiveMinor: number;
  };
  expenses: SplitExpense[];
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
  sevenDaySpending: Array<{ date: string; amount: number; income: number }>;
  categorySpending: Array<{ name: string; value: number; colour: string }>;
  monthlyComparison: Array<{ month: string; income: number; expense: number }>;
  recentTransactions: Transaction[];
}
