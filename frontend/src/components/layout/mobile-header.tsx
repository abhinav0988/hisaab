"use client";

import { Button } from "@hisaab/ui";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "./global-search";
import { HisaabMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { desktopNavigation, moreNavigation } from "./nav-config";

function titleForPath(pathname: string) {
  const match = [...desktopNavigation, ...moreNavigation].find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (pathname.startsWith("/accounts")) return "Accounts";
  if (pathname.startsWith("/categories")) return "Categories";
  if (pathname.startsWith("/recurring")) return "Recurring";
  return match?.label ?? "Hisaab";
}

export function MobileHeader({
  pathname,
  notices,
  notifyOpen,
  onToggleNotices,
  onMarkRead,
}: {
  pathname: string;
  notices: Array<{ title: string; body: string }>;
  notifyOpen: boolean;
  onToggleNotices: () => void;
  onMarkRead: () => void;
}) {
  const router = useRouter();
  const title = titleForPath(pathname);
  return (
    <header className="app-header sticky top-0 z-20 flex min-h-[72px] items-center gap-2.5 border-b border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-3 shadow-[0_8px_24px_color-mix(in_srgb,var(--foreground)_3%,transparent)] backdrop-blur-[20px] sm:px-4 lg:h-[84px] lg:px-[30px]">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
        <HisaabMark />
        <span className="truncate text-sm font-semibold tracking-tight">{title}</span>
      </div>
      <GlobalSearch />
      <Button className="hidden shrink-0 lg:inline-flex" onClick={() => router.push("/transactions?action=add")}>
        ＋ Add transaction
      </Button>
      <div className="relative">
        <button
          type="button"
          className="top-action relative"
          aria-label="Notifications"
          aria-expanded={notifyOpen}
          onClick={onToggleNotices}
        >
          <Bell size={19} aria-hidden="true" />
          {notices.length ? <span className="notification-dot" /> : null}
        </button>
        {notifyOpen ? (
          <div
            data-notification-panel
            className="fixed inset-x-3 top-[calc(72px+env(safe-area-inset-top))] z-30 max-h-[min(70dvh,560px)] overflow-y-auto rounded-[22px] border bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] p-3.5 shadow-[var(--shadow-lg)] lg:absolute lg:inset-x-auto lg:end-0 lg:top-[52px] lg:w-[min(390px,calc(100vw-2rem))]"
          >
            <div className="mb-2.5 flex items-start justify-between px-1.5">
              <div>
                <h2 className="text-base font-semibold">Notifications</h2>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {notices.length ? `${notices.length} items need attention` : "You're all caught up"}
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11 text-[11px] font-bold text-[var(--muted-foreground)]"
                onClick={onMarkRead}
              >
                Mark read
              </button>
            </div>
            {notices.length ? (
              notices.map((item) => (
                <div key={item.title} className="flex gap-2.5 rounded-[15px] p-3 hover:bg-[var(--muted)]">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-gradient-to-b from-[var(--gold)] to-[var(--primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_9%,transparent)]" />
                  <div>
                    <b className="text-[12px]">{item.title}</b>
                    <small className="mt-1 block leading-snug text-[11px] text-[var(--muted-foreground)]">
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
      <ThemeToggle />
    </header>
  );
}
