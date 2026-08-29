"use client";

import { cn } from "@hisaab/ui";
import { ArrowLeftRight, Ellipsis, Home, Plus, Timer } from "lucide-react";
import Link from "next/link";
import { isMoreActive, isNavActive } from "./nav-config";

export function MobileBottomNavigation({
  pathname,
  moreOpen,
  onMore,
}: {
  pathname: string;
  moreOpen: boolean;
  onMore: () => void;
}) {
  const moreActive = isMoreActive(pathname);
  return (
    <nav
      className="mobile-bottom-nav lg:hidden"
      aria-label="Primary"
      data-mobile-nav
    >
      <MobileItem href="/dashboard" label="Overview" icon={Home} active={isNavActive(pathname, "/dashboard")} />
      <MobileItem
        href="/transactions"
        label="Transactions"
        icon={ArrowLeftRight}
        active={isNavActive(pathname, "/transactions")}
      />
      <Link
        href="/transactions?action=add"
        className="grid min-h-11 min-w-11 justify-items-center gap-0.5 rounded-[15px] bg-[var(--primary)] px-1 py-1.5 text-[11px] font-extrabold text-white dark:text-[#08140d]"
        aria-label="Add Transaction"
      >
        <span className="grid size-8 place-items-center rounded-[13px] border border-white/10 bg-white/15">
          <Plus size={18} aria-hidden="true" />
        </span>
        Add
      </Link>
      <MobileItem href="/budgets" label="Limits" icon={Timer} active={isNavActive(pathname, "/budgets")} />
      <button
        type="button"
        aria-label="More"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={onMore}
        className={cn(
          "grid min-h-11 min-w-0 justify-items-center gap-0.5 rounded-[15px] px-1 py-[7px] text-[11px] font-extrabold",
          moreActive ? "bg-[var(--mint)] text-[var(--primary)]" : "text-[var(--muted-foreground)]",
        )}
      >
        <span
          className={cn(
            "grid size-8 place-items-center rounded-[13px] border",
            moreActive
              ? "border-transparent bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white dark:text-[#08140d]"
              : "border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--muted)]",
          )}
        >
          <Ellipsis size={16} aria-hidden="true" />
        </span>
        More
      </button>
    </nav>
  );
}

function MobileItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid min-h-11 min-w-0 justify-items-center gap-0.5 rounded-[15px] px-1 py-[7px] text-[11px] font-extrabold",
        active ? "bg-[var(--mint)] text-[var(--primary)]" : "text-[var(--muted-foreground)]",
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-[13px] border",
          active
            ? "border-transparent bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white dark:text-[#08140d]"
            : "border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--muted)]",
        )}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
