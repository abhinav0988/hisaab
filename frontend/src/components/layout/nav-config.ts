import {
  ArrowLeftRight,
  BarChart3,
  Home,
  Settings,
  Sparkles,
  Target,
  Timer,
  UserRound,
} from "lucide-react";

export const desktopNavigation = [
  { href: "/dashboard", label: "Overview", hint: "Money snapshot", icon: Home },
  { href: "/transactions", label: "Transactions", hint: "Track activity", icon: ArrowLeftRight },
  { href: "/budgets", label: "Spending Limits", hint: "Weekly and monthly", icon: Timer },
  { href: "/reports", label: "Analytics", hint: "Deep insights", icon: BarChart3, pro: true },
  { href: "/goals", label: "Savings Goals", hint: "Save smarter", icon: Target },
  { href: "/premium", label: "Premium", hint: "Upgrade tools", icon: Sparkles },
  { href: "/settings", label: "Settings", hint: "Profile & security", icon: Settings },
] as const;

export const moreNavigation = [
  { href: "/reports", label: "Analytics", hint: "Trends and category insights", icon: BarChart3 },
  { href: "/goals", label: "Savings Goals", hint: "Targets and contributions", icon: Target },
  { href: "/premium", label: "Premium", hint: "Unlock deeper tools", icon: Sparkles },
  { href: "/profile", label: "Profile", hint: "Name, email and workspace", icon: UserRound },
  { href: "/settings", label: "Settings", hint: "Regional, theme and access", icon: Settings },
] as const;

export const moreHrefs = moreNavigation.map((item) => item.href);

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMoreActive(pathname: string) {
  return moreHrefs.some((href) => isNavActive(pathname, href));
}
