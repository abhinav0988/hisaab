import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export type FinanceTool = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  href: string;
  group: "everyday" | "grow" | "more";
  pro?: boolean;
  tab?: "Home" | "Transactions";
};

export const financeTools: FinanceTool[] = [
  {
    id: "overview",
    title: "Overview",
    subtitle: "Money snapshot",
    icon: "home-outline",
    href: "/dashboard",
    group: "everyday",
    tab: "Home",
  },
  {
    id: "transactions",
    title: "Transactions",
    subtitle: "Track activity",
    icon: "swap-horizontal-outline",
    href: "/transactions",
    group: "everyday",
    tab: "Transactions",
  },
  {
    id: "bank",
    title: "Bank",
    subtitle: "Balances & accounts",
    icon: "business-outline",
    href: "/bank",
    group: "everyday",
  },
  {
    id: "budgets",
    title: "Spending Limits",
    subtitle: "View & plan monthly",
    icon: "speedometer-outline",
    href: "/budgets",
    group: "everyday",
  },
  {
    id: "reports",
    title: "Analytics",
    subtitle: "Deep insights",
    icon: "bar-chart-outline",
    href: "/reports",
    group: "everyday",
    pro: true,
  },
  {
    id: "goals",
    title: "Savings Goals",
    subtitle: "Save smarter",
    icon: "radio-button-on-outline",
    href: "/goals",
    group: "everyday",
  },
  {
    id: "accounts",
    title: "Accounts",
    subtitle: "All bank balances",
    icon: "wallet-outline",
    href: "/accounts",
    group: "grow",
  },
  {
    id: "investments",
    title: "Investments",
    subtitle: "MF, stocks & gold",
    icon: "trending-up-outline",
    href: "/investments",
    group: "grow",
  },
  {
    id: "ipo",
    title: "IPO Tracker",
    subtitle: "Applied & allotment",
    icon: "cash-outline",
    href: "/ipo",
    group: "grow",
  },
  {
    id: "loans",
    title: "EMI & Loans",
    subtitle: "Due dates & payments",
    icon: "timer-outline",
    href: "/loans",
    group: "grow",
  },
  {
    id: "cards",
    title: "Credit Cards",
    subtitle: "Limit, due & overdue",
    icon: "card-outline",
    href: "/cards",
    group: "grow",
  },
  {
    id: "upi",
    title: "UPI Credit",
    subtitle: "Used & remaining limit",
    icon: "phone-portrait-outline",
    href: "/upi-credit",
    group: "grow",
  },
  {
    id: "bills",
    title: "Bills & Reminders",
    subtitle: "Never miss a due date",
    icon: "notifications-outline",
    href: "/recurring",
    group: "more",
  },
  {
    id: "lend",
    title: "Borrow / Lend",
    subtitle: "Track money with dates",
    icon: "people-outline",
    href: "/lend",
    group: "more",
  },
  {
    id: "coach",
    title: "AI Financial Coach",
    subtitle: "Personal money guidance",
    icon: "sparkles-outline",
    href: "/coach",
    group: "more",
    pro: true,
  },
  {
    id: "premium",
    title: "Premium",
    subtitle: "Upgrade tools",
    icon: "diamond-outline",
    href: "/premium",
    group: "more",
    pro: true,
  },
];

export function toolById(id: string) {
  return financeTools.find((tool) => tool.id === id);
}

export function toolsByGroup(group: FinanceTool["group"]) {
  return financeTools.filter((tool) => tool.group === group);
}
