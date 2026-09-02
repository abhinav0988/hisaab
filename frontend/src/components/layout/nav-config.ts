import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Bell,
  CreditCard,
  Handshake,
  Home,
  Landmark,
  LineChart,
  Settings,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  UserRound,
} from "lucide-react";

export const desktopPrimaryNavigation = [
  { href: "/dashboard", label: "Overview", hint: "Money snapshot", icon: Home },
  { href: "/transactions", label: "Transactions", hint: "Track activity", icon: ArrowLeftRight },
  { href: "/bank", label: "Bank", hint: "Balances & accounts", icon: Landmark },
  { href: "/budgets", label: "Spending Limits", hint: "Weekly and monthly", icon: Timer },
  { href: "/reports", label: "Analytics", hint: "Deep insights", icon: BarChart3, pro: true },
  { href: "/goals", label: "Savings Goals", hint: "Save smarter", icon: Target },
  { href: "/premium", label: "Premium", hint: "Upgrade tools", icon: Sparkles },
] as const;

export const desktopSettingsNavigation = [
  { href: "/settings", label: "Settings", hint: "Profile & security", icon: Settings },
] as const;

export const desktopNavigation = [...desktopPrimaryNavigation, ...desktopSettingsNavigation] as const;

export const moreNavigation = [
  { href: "/bank", label: "Bank", hint: "Balances and bank accounts", icon: Landmark },
  { href: "/reports", label: "Analytics", hint: "Trends and category insights", icon: BarChart3 },
  { href: "/goals", label: "Savings Goals", hint: "Targets and contributions", icon: Target },
  { href: "/premium", label: "Premium", hint: "Unlock deeper tools", icon: Sparkles },
  { href: "/profile", label: "Profile", hint: "Name, email and workspace", icon: UserRound },
  { href: "/settings", label: "Settings", hint: "Regional, theme and access", icon: Settings },
] as const;

export const moreHrefs = moreNavigation.map((item) => item.href);

export const financeToolsNavigation = [
  { href: "/accounts", label: "Accounts", hint: "All bank balances", icon: Landmark },
  { href: "/investments", label: "Investments", hint: "MF, stocks & gold", icon: LineChart },
  { href: "/ipo", label: "IPO Tracker", hint: "Applied & allotment", icon: Banknote },
  { href: "/loans", label: "EMI & Loans", hint: "Due dates & payments", icon: Timer },
  { href: "/cards", label: "Credit Cards", hint: "Limit, due & overdue", icon: CreditCard },
  { href: "/upi-credit", label: "UPI Credit", hint: "Used & remaining limit", icon: Smartphone },
  { href: "/recurring", label: "Bills & Reminders", hint: "Never miss a due date", icon: Bell },
  { href: "/lend", label: "Borrow / Lend", hint: "Track money with dates", icon: Handshake },
  { href: "/coach", label: "AI Financial Coach", hint: "Personal money guidance", icon: Sparkles, pro: true },
] as const;

export const financeToolHrefs = financeToolsNavigation.map((item) => item.href);

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMoreActive(pathname: string) {
  return (
    moreHrefs.some((href) => isNavActive(pathname, href)) ||
    financeToolHrefs.some((href) => isNavActive(pathname, href))
  );
}
