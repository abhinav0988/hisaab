import { colors } from "../theme/tokens";
import type { IconName } from "../config/finance-tools";

export type DemoTransaction = {
  id: string;
  name: string;
  subtitle: string;
  amount: string;
  color: string;
  icon: IconName;
  section: "today" | "earlier";
};

export const demoUser = {
  name: "Abhinav Mangal",
  email: "abhinav@example.com",
  initials: "AM",
  premium: true,
  healthScore: 78,
};

export const demoSummary = {
  balance: "₹9,21,943",
  paise: ".54",
  change: "2.1%",
  income: "₹89,750",
  expenses: "₹46,250",
  savings: "₹43,500",
};

export const homeDashboard = {
  netWorth: "₹9,21,943.54",
  netWorthHidden: "₹••••••••",
  monthChange: "+ ₹18,420",
  monthChangePct: "2.1%",
  assets: "₹10,12,450",
  liabilities: "₹90,506",
  savingsRate: 48,
  insight:
    "Your dining spending is 18% higher this month. Try setting a dining budget to stay on track.",
};

export const spendingBreakdown = [
  { label: "Food & Dining", pct: 32, amount: "₹14,800", color: colors.green, icon: "restaurant-outline" as IconName },
  { label: "Shopping", pct: 18, amount: "₹8,200", color: colors.orange, icon: "bag-handle-outline" as IconName },
  { label: "Housing", pct: 14, amount: "₹6,500", color: colors.purple, icon: "home-outline" as IconName },
  { label: "Transport", pct: 10, amount: "₹4,600", color: colors.gold, icon: "car-outline" as IconName },
  { label: "Others", pct: 26, amount: "₹12,150", color: "#6F8F86", icon: "ellipsis-horizontal" as IconName },
];

export const upcomingBills = [
  {
    id: "u1",
    day: "18",
    month: "SEP",
    title: "HDFC Credit Card",
    subtitle: "Credit Card Payment",
    amount: "₹12,450",
    due: "Due in 2 days",
    icon: "card-outline" as IconName,
    tone: colors.orange,
  },
  {
    id: "u2",
    day: "21",
    month: "SEP",
    title: "Home Loan EMI",
    subtitle: "SBI Home Loan",
    amount: "₹24,500",
    due: "Due in 5 days",
    icon: "home-outline" as IconName,
    tone: colors.gold,
  },
  {
    id: "u3",
    day: "25",
    month: "SEP",
    title: "Electricity Bill",
    subtitle: "Bescom Rajajinagar",
    amount: "₹1,850",
    due: "Due in 9 days",
    icon: "flash-outline" as IconName,
    tone: colors.green,
  },
];

export const sparkline = [22, 28, 24, 36, 32, 44, 40, 52, 48, 61, 58, 72, 68, 86];
export const cashflow = [28, 35, 31, 42, 38, 48, 43, 56, 51, 66, 60, 78, 70, 90];
export const featureChart = [34, 50, 40, 65, 55, 73, 62, 88, 77, 98];

export const demoTransactions: DemoTransaction[] = [
  {
    id: "1",
    name: "Salary Credit",
    subtitle: "HDFC Bank · 1234",
    amount: "+ ₹89,750",
    color: colors.green,
    icon: "arrow-down-outline",
    section: "today",
  },
  {
    id: "2",
    name: "Amazon Pay",
    subtitle: "Shopping",
    amount: "- ₹2,499",
    color: colors.red,
    icon: "cart-outline",
    section: "today",
  },
  {
    id: "3",
    name: "Swiggy",
    subtitle: "Food & Dining",
    amount: "- ₹623",
    color: colors.red,
    icon: "fast-food-outline",
    section: "today",
  },
  {
    id: "4",
    name: "UPI to Rahul",
    subtitle: "UPI · 9876",
    amount: "- ₹1,200",
    color: colors.red,
    icon: "paper-plane-outline",
    section: "today",
  },
  {
    id: "5",
    name: "Freelance Payment",
    subtitle: "HDFC Bank · 5678",
    amount: "+ ₹15,000",
    color: colors.green,
    icon: "briefcase-outline",
    section: "earlier",
  },
];

export const premiumBenefits = [
  "Advanced analytics",
  "AI Financial Coach",
  "Unlimited accounts",
  "Smart bill reminders",
  "Priority support",
];
