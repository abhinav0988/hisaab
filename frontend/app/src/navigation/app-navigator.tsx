import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AppStackParamList, MainTabParamList } from "./types";
import { TabBar } from "./tab-bar";
import { HomeScreen } from "../screens/home/home-screen";
import { FinanceScreen } from "../screens/finance/finance-screen";
import { TransactionsScreen } from "../screens/transactions/transactions-screen";
import { ProfileScreen } from "../screens/profile/profile-screen";
import { FeatureScreen } from "../screens/finance/feature-screen";
import { SettingsScreen } from "../screens/profile/settings-screen";
import { SubscriptionScreen } from "../screens/profile/subscription-screen";
import { AddTransactionScreen } from "../screens/transactions/add-transaction-screen";
import { TransactionDetailScreen } from "../screens/transactions/transaction-detail-screen";
import { CategoriesScreen } from "../screens/categories/categories-screen";
import { AccountDetailScreen, AccountsScreen } from "../screens/accounts/accounts-screens";
import { BudgetDetailScreen, BudgetListScreen, CreateBudgetScreen, EditBudgetScreen } from "../screens/budgets/budget-screens";
import { ContributionHistoryScreen, CreateGoalScreen, EditGoalScreen, GoalContributionScreen, GoalDetailScreen, GoalsListScreen } from "../screens/goals/goal-screens";
import { CreateRecurringScreen, EditRecurringScreen, RecurringDetailScreen, RecurringHistoryScreen, RecurringListScreen } from "../screens/recurring/recurring-screens";
import { SplitMoneyHomeScreen } from "../screens/split-money/split-home-screen";
import { SplitCreateScreen } from "../screens/split-money/split-create-screen";
import { SplitExpenseScreen, SplitPaymentScreen } from "../screens/split-money/split-expense-screen";
import { SplitAdjustmentScreen } from "../screens/split-money/split-adjustment-screen";
import { SplitGroupDetailScreen, SplitGroupsScreen, SplitHistoryScreen, SplitPeopleScreen, SplitPersonDetailScreen } from "../screens/split-money/split-directory-screen";
import { BorrowLendDetailScreen, BorrowLendHomeScreen, CardDetailScreen, CardListScreen, CreateBorrowLendScreen, CreateCardScreen, CreateLoanScreen, CreateUpiCreditScreen, EditBorrowLendScreen, EditCardScreen, EditLoanScreen, EditUpiCreditScreen, LoanDetailScreen, LoanListScreen, LoanScheduleScreen, UpiCreditDetailScreen, UpiCreditListScreen } from "../screens/finance/debt-screens";
import { CreateInvestmentScreen, EditInvestmentScreen, InvestmentDetailScreen, InvestmentListScreen } from "../screens/finance/investment-screens";
import { AnalyticsScreen } from "../screens/finance/analytics-screen";
import { CreateIpoScreen, EditIpoScreen, IpoDetailScreen, IpoListScreen, UpcomingIpoScreen } from "../screens/finance/ipo-screens";
import { PrivacyScreen, TermsScreen } from "../screens/profile/legal-screens";
import { ReportDetailScreen } from "../screens/finance/report-detail-screen";
import { EditProfileScreen } from "../screens/profile/edit-profile-screen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "transparent", borderTopWidth: 0, elevation: 0 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Split" component={SplitMoneyHomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Feature" component={FeatureScreen} />
      <Stack.Screen name="Investments" component={InvestmentListScreen} />
      <Stack.Screen name="InvestmentDetail" component={InvestmentDetailScreen} />
      <Stack.Screen name="CreateInvestment" component={CreateInvestmentScreen} />
      <Stack.Screen name="EditInvestment" component={EditInvestmentScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Ipos" component={IpoListScreen} />
      <Stack.Screen name="IpoDetail" component={IpoDetailScreen} />
      <Stack.Screen name="CreateIpo" component={CreateIpoScreen} />
      <Stack.Screen name="EditIpo" component={EditIpoScreen} />
      <Stack.Screen name="UpcomingIpos" component={UpcomingIpoScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="SplitCreate" component={SplitCreateScreen} />
      <Stack.Screen name="SplitExpense" component={SplitExpenseScreen} />
      <Stack.Screen name="SplitPayment" component={SplitPaymentScreen} />
      <Stack.Screen name="SplitAdjustment" component={SplitAdjustmentScreen} />
      <Stack.Screen name="SplitPeople" component={SplitPeopleScreen} />
      <Stack.Screen name="SplitPersonDetail" component={SplitPersonDetailScreen} />
      <Stack.Screen name="SplitGroups" component={SplitGroupsScreen} />
      <Stack.Screen name="SplitGroupDetail" component={SplitGroupDetailScreen} />
      <Stack.Screen name="SplitHistory" component={SplitHistoryScreen} />
      <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
      <Stack.Screen name="Budgets" component={BudgetListScreen} />
      <Stack.Screen name="BudgetDetail" component={BudgetDetailScreen} />
      <Stack.Screen name="CreateBudget" component={CreateBudgetScreen} />
      <Stack.Screen name="EditBudget" component={EditBudgetScreen} />
      <Stack.Screen name="Goals" component={GoalsListScreen} />
      <Stack.Screen name="GoalDetail" component={GoalDetailScreen} />
      <Stack.Screen name="CreateGoal" component={CreateGoalScreen} />
      <Stack.Screen name="EditGoal" component={EditGoalScreen} />
      <Stack.Screen name="GoalContribution" component={GoalContributionScreen} />
      <Stack.Screen name="ContributionHistory" component={ContributionHistoryScreen} />
      <Stack.Screen name="Recurring" component={RecurringListScreen} />
      <Stack.Screen name="RecurringDetail" component={RecurringDetailScreen} />
      <Stack.Screen name="CreateRecurring" component={CreateRecurringScreen} />
      <Stack.Screen name="EditRecurring" component={EditRecurringScreen} />
      <Stack.Screen name="RecurringHistory" component={RecurringHistoryScreen} />
      <Stack.Screen name="BorrowLend" component={BorrowLendHomeScreen} />
      <Stack.Screen name="BorrowLendDetail" component={BorrowLendDetailScreen} />
      <Stack.Screen name="CreateBorrowLend" component={CreateBorrowLendScreen} />
      <Stack.Screen name="EditBorrowLend" component={EditBorrowLendScreen} />
      <Stack.Screen name="Loans" component={LoanListScreen} />
      <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
      <Stack.Screen name="CreateLoan" component={CreateLoanScreen} />
      <Stack.Screen name="EditLoan" component={EditLoanScreen} />
      <Stack.Screen name="LoanSchedule" component={LoanScheduleScreen} />
      <Stack.Screen name="CreditCards" component={CardListScreen} />
      <Stack.Screen name="CardDetail" component={CardDetailScreen} />
      <Stack.Screen name="CreateCard" component={CreateCardScreen} />
      <Stack.Screen name="EditCard" component={EditCardScreen} />
      <Stack.Screen name="UpiCredit" component={UpiCreditListScreen} />
      <Stack.Screen name="UpiCreditDetail" component={UpiCreditDetailScreen} />
      <Stack.Screen name="CreateUpiCredit" component={CreateUpiCreditScreen} />
      <Stack.Screen name="EditUpiCredit" component={EditUpiCreditScreen} />
    </Stack.Navigator>
  );
}
