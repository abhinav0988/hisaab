export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register:
    | {
        verifiedEmail?: string;
        name?: string;
      }
    | undefined;
  ForgotPassword: undefined;
  Otp: {
    email: string;
    purpose?: "reset" | "signup";
    name?: string;
    /** Shown when email delivery is unavailable / API returns a code. */
    otp?: string;
  };
  ResetPassword: { email?: string; token?: string };
  ResetSuccess: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Finance: undefined;
  Split: undefined;
  Transactions: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Feature: { toolId: string };
  Investments: undefined;
  InvestmentDetail: { id: string };
  CreateInvestment: undefined;
  EditInvestment: { id: string };
  Ipos: undefined;
  IpoDetail: { id: string };
  CreateIpo: undefined;
  EditIpo: { id: string };
  UpcomingIpos: undefined;
  Analytics: undefined;
  ReportDetail: { kind: "monthly" | "categories" | "accounts" };
  EditProfile: undefined;
  Terms: undefined;
  Privacy: undefined;
  Settings: undefined;
  Subscription: undefined;
  SplitCreate: undefined;
  SplitExpense: { id: string };
  SplitPayment: { id: string };
  SplitAdjustment: { id: string };
  SplitPeople: undefined;
  SplitPersonDetail: { id: string };
  SplitGroups: undefined;
  SplitGroupDetail: { id: string };
  SplitHistory: undefined;
  AddTransaction: { amount?: string; note?: string } | undefined;
  TransactionDetail: { id: string };
  Categories: undefined;
  Accounts: undefined;
  AccountDetail: { id: string };
  Budgets: undefined;
  BudgetDetail: { id: string };
  CreateBudget: undefined;
  EditBudget: { id: string };
  Goals: undefined;
  GoalDetail: { id: string };
  CreateGoal: undefined;
  EditGoal: { id: string };
  GoalContribution: { id: string };
  ContributionHistory: { id: string };
  Recurring: undefined;
  RecurringDetail: { id: string };
  CreateRecurring: undefined;
  EditRecurring: { id: string };
  RecurringHistory: { id: string };
  BorrowLend: undefined;
  BorrowLendDetail: { id: string };
  CreateBorrowLend: undefined;
  EditBorrowLend: { id: string };
  Loans: undefined;
  LoanDetail: { id: string };
  CreateLoan: undefined;
  EditLoan: { id: string };
  LoanSchedule: { id: string };
  CreditCards: undefined;
  CardDetail: { id: string };
  CreateCard: undefined;
  EditCard: { id: string };
  UpiCredit: undefined;
  UpiCreditDetail: { id: string };
  CreateUpiCredit: undefined;
  EditUpiCredit: { id: string };
};

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};
