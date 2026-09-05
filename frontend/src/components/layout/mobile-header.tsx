"use client";

import { Button } from "@hisaab/ui";
import { Bell, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { GlobalSearch } from "./global-search";
import { HisaabMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { desktopNavigation, financeToolsNavigation, moreNavigation } from "./nav-config";

function titleForPath(pathname: string) {
  const match = [...desktopNavigation, ...moreNavigation, ...financeToolsNavigation].find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (pathname.startsWith("/accounts")) return "Accounts";
  if (pathname.startsWith("/bank")) return "Bank";
  if (pathname.startsWith("/categories")) return "Categories";
  if (pathname.startsWith("/recurring")) return "Bills & Reminders";
  return match?.label ?? "Hisaab";
}

function hideMobileTitle(pathname: string) {
  return ["/reports", "/coach", "/categories", "/profile", "/premium"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function noticeCountLabel(count: number) {
  if (count === 1) return "1 item needs attention";
  return `${count} items need attention`;
}

function placePanel(panel: HTMLElement, bell: HTMLElement) {
  panel.style.setProperty("position", "fixed", "important");
  panel.style.setProperty("inset", "unset", "important");
  panel.style.setProperty("margin", "0", "important");
  panel.style.setProperty("top", "0px", "important");
  panel.style.setProperty("left", "0px", "important");
  panel.style.setProperty("right", "auto", "important");
  panel.style.setProperty("bottom", "auto", "important");
  panel.style.setProperty("transform", "none", "important");
  const origin = panel.getBoundingClientRect();
  const rect = bell.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 24);
  const viewportLeft = Math.min(
    Math.max(12, rect.right - width),
    window.innerWidth - width - 12,
  );
  const viewportTop = Math.min(rect.bottom + 8, window.innerHeight - 24);
  panel.style.setProperty("width", `${Math.round(width)}px`, "important");
  panel.style.setProperty(
    "transform",
    `translate3d(${Math.round(viewportLeft - origin.left)}px, ${Math.round(viewportTop - origin.top)}px, 0)`,
    "important",
  );
  panel.dataset.placed = "true";
}

export function MobileHeader({
  pathname,
  notices,
  notifyOpen,
  onToggleNotices,
  onCloseNotices,
  onMarkRead,
}: {
  pathname: string;
  notices: Array<{ title: string; body: string }>;
  notifyOpen: boolean;
  onToggleNotices: () => void;
  onCloseNotices: () => void;
  onMarkRead: () => void;
}) {
  const router = useRouter();
  const title = titleForPath(pathname);
  const compactTitle = hideMobileTitle(pathname);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const bell = bellRef.current;
    if (!panel) return;
    if (notifyOpen) {
      try {
        if (!panel.matches(":popover-open")) panel.showPopover();
      } catch {
        panel.classList.add("is-open");
      }
      if (bell) placePanel(panel, bell);
      const frame = window.requestAnimationFrame(() => {
        const nextPanel = panelRef.current;
        const nextBell = bellRef.current;
        if (nextPanel && nextBell) placePanel(nextPanel, nextBell);
      });
      const update = () => {
        const nextPanel = panelRef.current;
        const nextBell = bellRef.current;
        if (nextPanel && nextBell) placePanel(nextPanel, nextBell);
      };
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    }
    try {
      if (panel.matches(":popover-open")) panel.hidePopover();
    } catch {
      panel.classList.remove("is-open");
    }
    panel.dataset.placed = "false";
    return undefined;
  }, [notifyOpen, notices.length]);

  useEffect(() => {
    if (!notifyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseNotices();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (bellRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onCloseNotices();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [notifyOpen, onCloseNotices]);

  return (
    <header className="app-header sticky top-0 z-40 flex min-h-[72px] items-center gap-2.5 overflow-visible border-b border-[color-mix(in_srgb,var(--border)_78%,transparent)] px-3 sm:px-4 lg:h-[84px] lg:px-[30px]">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
        <HisaabMark />
        {compactTitle ? null : <span className="truncate text-sm font-semibold tracking-tight">{title}</span>}
      </div>
      <GlobalSearch />
      <div className="ms-auto flex shrink-0 items-center gap-2.5">
        <Button className="hidden shrink-0 lg:inline-flex" onClick={() => router.push("/transactions?action=add")}>
          <Plus size={16} aria-hidden="true" /> Add transaction
        </Button>
        <div className="notification-wrap relative z-50 shrink-0">
          <button
            ref={bellRef}
            type="button"
            className="top-action relative"
            aria-label="Notifications"
            aria-expanded={notifyOpen}
            aria-haspopup="dialog"
            onClick={onToggleNotices}
          >
            <Bell size={19} aria-hidden="true" />
            {notices.length ? <span className="notification-dot" /> : null}
          </button>
          <div
            ref={panelRef}
            id="hisaab-notifications"
            popover="manual"
            data-notification-panel
            role="dialog"
            aria-label="Notifications"
            className="notification-panel"
          >
            <div className="mb-2.5 flex items-start justify-between gap-3 px-1.5">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Notifications</h2>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {notices.length ? noticeCountLabel(notices.length) : "You're all caught up"}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 min-h-11 px-2 text-[11px] font-bold text-[var(--muted-foreground)]"
                onClick={onMarkRead}
              >
                Mark read
              </button>
            </div>
            {notices.length ? (
              notices.map((item) => (
                <div key={item.title} className="flex gap-2.5 rounded-[15px] p-3 hover:bg-[var(--muted)]">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-gradient-to-b from-[var(--gold)] to-[var(--primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_9%,transparent)]" />
                  <div className="min-w-0">
                    <b className="block text-[12px] leading-snug">{item.title}</b>
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
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
