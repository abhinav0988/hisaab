"use client";
import { Button, cn } from "@hisaab/ui";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Home,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Timer,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { initials, money } from "@/lib/format";
import { authService } from "@/services/auth.service";
import { dashboardService } from "@/services/dashboard.service";
import { Logo } from "./logo";

const navigation = [
  { href: "/dashboard", label: "Overview", hint: "Money snapshot", icon: Home },
  { href: "/transactions", label: "Transactions", hint: "Track activity", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", hint: "Spending limits", icon: Timer },
  { href: "/reports", label: "Analytics", hint: "Deep insights", icon: BarChart3, pro: true },
  { href: "/goals", label: "Goals", hint: "Save smarter", icon: Target },
  { href: "/premium", label: "Premium", hint: "Upgrade tools", icon: Sparkles },
  { href: "/settings", label: "Settings", hint: "Profile & security", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authService.useSession();
  const [open, setOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { resolvedTheme, setTheme } = useTheme();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.summary(),
    enabled: Boolean(session),
  });
  useEffect(() => {
    if (!isPending && !session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isPending, session, router, pathname]);
  const notices = useMemo(() => {
    const data = dashboard.data;
    if (!data) return [];
    const items: Array<{ title: string; body: string }> = [];
    if (data.budgetTotal && data.budgetPercentage >= 80) {
      items.push({
        title: `Monthly budget at ${Math.round(data.budgetPercentage)}%`,
        body: `${money(data.budgetRemaining, data.currency)} remaining this month. Consider adjusting your limit.`,
      });
    }
    const income = data.recentTransactions.find((item) => item.type === "INCOME");
    if (income) {
      items.push({
        title: income.merchant ? `${income.merchant} received` : "Income received",
        body: `${money(income.amountMinor, income.currency)} added to ${income.accountName ?? "your account"}.`,
      });
    }
    const top = data.categorySpending[0];
    if (top) {
      items.push({
        title: "Smart saving opportunity",
        body: `${top.name} is your highest spend this month at ${money(top.value, data.currency)}.`,
      });
    }
    return items.slice(0, 3);
  }, [dashboard.data]);
  if (isPending || !session)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">Opening your Hisaab…</p>
        </div>
      </div>
    );
  const logout = async () => {
    await authService.signOut();
    router.replace("/login");
    router.refresh();
  };
  const name = session.user.name;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[242px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r bg-gradient-to-b from-[color-mix(in_srgb,var(--surface)_96%,var(--primary)_4%)] to-[var(--surface)] px-4 pb-[18px] pt-6 transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-2 pb-4">
          <Logo />
          <button
            onClick={() => setOpen(false)}
            className="grid size-9 place-items-center rounded-lg hover:bg-[var(--muted)] lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-[22px] flex items-center gap-3 rounded-[20px] border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-gradient-to-b from-[var(--surface-2)] to-[color-mix(in_srgb,var(--surface)_92%,var(--mint)_8%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.35)]">
          <span className="grid size-11 place-items-center rounded-[15px] bg-gradient-to-br from-[var(--mint)] to-[color-mix(in_srgb,var(--mint)_68%,white)] text-sm font-black text-[var(--primary)] shadow-[0_10px_20px_color-mix(in_srgb,var(--primary)_12%,transparent)]">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <b className="block truncate text-[13px]">{name}</b>
            <small className="mt-0.5 block text-[var(--muted-foreground)]">Personal account</small>
            <small className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[rgba(201,154,67,.16)] bg-gradient-to-br from-[#fff6df] to-[#f7e6b8] px-2 py-0.5 text-[10px] font-black text-[#6f4b08]">
              ◆ Free plan
            </small>
          </div>
        </div>
        <nav className="grid flex-1 content-start gap-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "nav-link flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-[13px] font-bold text-[var(--muted-foreground)] transition",
                  active
                    ? "is-active border-[color-mix(in_srgb,var(--primary)_16%,var(--border))] bg-gradient-to-br from-[color-mix(in_srgb,var(--mint)_92%,white)] to-[color-mix(in_srgb,var(--surface)_80%,var(--mint)_20%)] text-[var(--primary)] shadow-[0_10px_26px_color-mix(in_srgb,var(--primary)_10%,transparent)]"
                    : "hover:translate-x-0.5 hover:border-[color-mix(in_srgb,var(--border)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--muted)_86%,transparent)] hover:text-[var(--foreground)]",
                )}
              >
                <span
                  className={cn(
                    "grid size-[38px] shrink-0 place-items-center rounded-[13px] border",
                    active
                      ? "border-transparent bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-[0_10px_18px_color-mix(in_srgb,var(--primary)_26%,transparent)] dark:text-[#08140d]"
                      : "border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--muted)] text-[var(--primary)]",
                  )}
                >
                  <item.icon size={18} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span>{item.label}</span>
                  <small className="text-[10px] font-bold text-[var(--subtle)]">{item.hint}</small>
                </span>
                {item.pro ? (
                  <span className="ml-auto rounded-full border border-[rgba(201,154,67,.18)] bg-gradient-to-br from-[#fff6df] to-[#f7e6b8] px-1.5 py-1 text-[9px] font-black text-[#6f4b08]">
                    PRO
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-[color-mix(in_srgb,var(--border)_75%,transparent)] pt-3.5">
          <Link
            href="/premium"
            onClick={() => setOpen(false)}
            className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[15px] border border-[rgba(201,154,67,.24)] bg-gradient-to-br from-[var(--gold-soft)] to-[color-mix(in_srgb,var(--surface)_82%,var(--gold-soft)_18%)] px-2.5 py-2.5 text-left hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(201,154,67,.12)]"
          >
            <span className="grid size-[38px] place-items-center rounded-xl border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--surface)] font-black text-[var(--gold)]">
              ◆
            </span>
            <span>
              <b className="block text-[11px]">Hisaab Premium</b>
              <small className="mt-0.5 block text-[9px] text-[var(--muted-foreground)]">
                Explore premium features
              </small>
            </span>
            <span className="text-base text-[var(--muted-foreground)]">→</span>
          </Link>
          <button
            onClick={logout}
            className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[15px] border border-[color-mix(in_srgb,var(--danger)_22%,var(--border))] bg-[var(--surface)] px-2.5 py-2.5 text-left hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          >
            <span className="grid size-[38px] place-items-center rounded-xl border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--surface)] text-[var(--danger)]">
              <LogOut size={17} />
            </span>
            <span>
              <b className="block text-[11px]">Log out</b>
              <small className="mt-0.5 block text-[9px] text-[var(--muted-foreground)]">
                Sign out securely
              </small>
            </span>
          </button>
        </div>
      </aside>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--background)_84%,transparent)] px-4 backdrop-blur-[20px] lg:h-[78px] lg:px-7">
          <button
            onClick={() => setOpen(true)}
            className="grid size-11 place-items-center rounded-[14px] border bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <form
            className="relative hidden max-w-[460px] flex-1 lg:block"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(`/transactions?q=${encodeURIComponent(query)}`);
            }}
          >
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search transactions, categories, goals..."
              className="h-11 w-full rounded-[15px] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] pl-11 pr-3.5 text-sm outline-none focus:border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
            />
          </form>
          <div className="flex-1 lg:hidden" />
          <Button
            className="shrink-0"
            onClick={() => router.push("/transactions?action=add")}
          >
            ＋ <span className="hidden sm:inline">Add transaction</span>
          </Button>
          <div className="relative">
            <button
              className="relative grid size-11 place-items-center rounded-[14px] border bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)]"
              aria-label="Notifications"
              onClick={() => setNotifyOpen((value) => !value)}
            >
              <Bell size={18} />
              {notices.length ? (
                <span className="absolute right-[7px] top-[7px] size-2.5 rounded-full border-2 border-[var(--surface)] bg-[#e45d57]" />
              ) : null}
            </button>
            {notifyOpen ? (
              <div className="absolute right-0 top-[52px] z-30 w-[min(360px,calc(100vw-2rem))] rounded-[20px] border bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] p-3 shadow-[var(--shadow-lg)]">
                <div className="mb-2.5 flex items-start justify-between px-1.5">
                  <div>
                    <h2 className="text-base font-semibold">Notifications</h2>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      {notices.length
                        ? `${notices.length} items need attention`
                        : "You're all caught up"}
                    </p>
                  </div>
                  <button
                    className="text-[11px] font-bold text-[var(--muted-foreground)]"
                    onClick={() => {
                      setNotifyOpen(false);
                      toast.success("Notifications marked read");
                    }}
                  >
                    Mark read
                  </button>
                </div>
                {notices.length ? (
                  notices.map((item) => (
                    <div
                      key={item.title}
                      className="flex gap-2.5 rounded-[13px] p-2.5 hover:bg-[var(--muted)]"
                    >
                      <span className="mt-1 size-2.5 shrink-0 rounded-full bg-gradient-to-b from-[var(--gold)] to-[var(--primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_9%,transparent)]" />
                      <div>
                        <b className="text-[11px]">{item.title}</b>
                        <small className="mt-1 block leading-snug text-[10px] text-[var(--muted-foreground)]">
                          {item.body}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="px-2 py-6 text-center text-xs text-[var(--muted-foreground)]">
                    No alerts yet. Budgets and activity will appear here.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="grid size-11 place-items-center rounded-[14px] border bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)]"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="view-in mx-auto w-full max-w-[1600px] px-3 pb-24 pt-[18px] sm:px-4 lg:px-7 lg:pb-10 lg:pt-7">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-2.5 bottom-2.5 z-30 grid grid-cols-5 rounded-[20px] border bg-[color-mix(in_srgb,var(--surface)_93%,transparent)] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.16)] backdrop-blur-[18px] lg:hidden">
        <MobileItem href="/dashboard" label="Overview" icon={Home} pathname={pathname} />
        <MobileItem
          href="/transactions"
          label="Activity"
          icon={ArrowLeftRight}
          pathname={pathname}
          name="Transactions"
        />
        <MobileItem href="/budgets" label="Budgets" icon={Timer} pathname={pathname} />
        <Link
          href="/transactions?action=add"
          className="grid justify-items-center gap-1 rounded-[13px] bg-[var(--primary)] px-1 py-1.5 text-[8px] font-semibold text-white"
          aria-label="Add transaction"
        >
          <span className="grid size-[34px] place-items-center rounded-[13px] border border-white/10 bg-white/15">
            <Plus size={18} />
          </span>
          Add
        </Link>
        <MobileItem href="/reports" label="Analytics" icon={BarChart3} pathname={pathname} />
      </nav>
    </div>
  );
}

function MobileItem({
  href,
  label,
  name,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  name?: string;
  icon: typeof Home;
  pathname: string;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-label={name ?? label}
      className={cn(
        "grid justify-items-center gap-1 rounded-xl px-1 py-1.5 text-[8px] font-semibold",
        active ? "bg-[var(--mint)] text-[var(--primary)]" : "text-[var(--muted-foreground)]",
      )}
    >
      <span
        className={cn(
          "grid size-[34px] place-items-center rounded-[13px] border",
          active
            ? "border-transparent bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white dark:text-[#08140d]"
            : "border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--muted)]",
        )}
      >
        <Icon size={16} />
      </span>
      {label}
    </Link>
  );
}
