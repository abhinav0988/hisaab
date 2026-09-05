"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { tidyAccountLabel } from "@/lib/accounts";
import { authService } from "@/services/auth.service";
import { dashboardService } from "@/services/dashboard.service";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileBottomNavigation } from "./mobile-bottom-navigation";
import { MobileHeader } from "./mobile-header";
import { MoreMenu } from "./more-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authService.useSession();
  const [heldSession, setHeldSession] = useState(session ?? null);
  if (session && heldSession?.user.id !== session.user.id) {
    setHeldSession(session);
  }
  const activeSession = session ?? heldSession;
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMoreOpen(false);
    setNotifyOpen(false);
  }
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardService.summary(),
    enabled: Boolean(activeSession),
  });
  useEffect(() => {
    if (isPending || session || heldSession) return;
    const next = pathname.startsWith("/login") || pathname.startsWith("/register") ? "/dashboard" : pathname;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [isPending, session, heldSession, router, pathname]);
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
        body: `${money(income.amountMinor, income.currency)} added to ${tidyAccountLabel(income.accountName)}.`,
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
  if (!activeSession) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">Opening your Hisaab…</p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="min-h-dvh lg:grid lg:grid-cols-[258px_minmax(0,1fr)]"
      data-app-shell
      data-page={
        pathname === "/budgets"
          ? "spending-limits"
          : pathname === "/goals"
            ? "savings-goals"
            : pathname === "/accounts"
              ? "accounts"
              : pathname === "/investments"
                ? "investments"
                : pathname === "/ipo"
                  ? "ipo"
                  : pathname === "/cards"
                    ? "cards"
                    : pathname === "/loans"
                      ? "loans"
                      : pathname === "/upi-credit"
                        ? "upi-credit"
                        : pathname === "/transactions"
                          ? "transactions"
                          : pathname === "/bank"
                            ? "bank"
                            : pathname === "/recurring"
                              ? "recurring"
                              : pathname === "/schedules"
                                ? "schedules"
                                : pathname === "/lend"
                                  ? "lend"
                                  : undefined
      }
    >
      <DesktopSidebar pathname={pathname} name={activeSession.user.name} />
      <div className="min-w-0 overflow-visible bg-[radial-gradient(circle_at_82%_0%,color-mix(in_srgb,var(--gold)_5%,transparent),transparent_24%)]">
        <MobileHeader
          pathname={pathname}
          notices={notices}
          notifyOpen={notifyOpen}
          onToggleNotices={() => setNotifyOpen((value) => !value)}
          onCloseNotices={() => setNotifyOpen(false)}
          onMarkRead={() => {
            setNotifyOpen(false);
            toast.success("Notifications marked read");
          }}
        />
        <main className="app-main view-in mx-auto w-full max-w-[1540px] px-[13px] pt-[22px] sm:px-4 lg:px-[34px] lg:pt-[34px]">
          {children}
        </main>
      </div>
      <MobileBottomNavigation
        pathname={pathname}
        moreOpen={moreOpen}
        onMore={() => setMoreOpen(true)}
      />
      <MoreMenu open={moreOpen} pathname={pathname} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
