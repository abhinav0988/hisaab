"use client";

import { cn } from "@hisaab/ui";
import Link from "next/link";
import {
  desktopPrimaryNavigation,
  desktopSettingsNavigation,
  financeToolsNavigation,
  isNavActive,
} from "./nav-config";
import { Logo } from "./logo";
import { initials } from "@/lib/format";
import { ArrowRight, Gem } from "lucide-react";

function NavLink({
  item,
  pathname,
  compact,
}: {
  item: {
    href: string;
    label: string;
    hint: string;
    icon: typeof Gem;
    pro?: boolean;
  };
  pathname: string;
  compact?: boolean;
}) {
  const active = isNavActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "nav-link flex items-center gap-3 rounded-2xl border border-transparent px-3 text-start text-[13px] font-bold text-[var(--muted-foreground)] transition",
        compact ? "min-h-[52px] py-2" : "min-h-[58px] py-2.5",
        active
          ? "is-active border-[color-mix(in_srgb,var(--primary)_16%,var(--border))] bg-gradient-to-br from-[color-mix(in_srgb,var(--mint)_92%,white)] to-[color-mix(in_srgb,var(--surface)_80%,var(--mint)_20%)] text-[var(--primary)] shadow-[0_12px_26px_color-mix(in_srgb,var(--primary)_11%,transparent)]"
          : "hover:border-[color-mix(in_srgb,var(--border)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--muted)_86%,transparent)] hover:text-[var(--foreground)] hover:translate-x-0.5 rtl:hover:-translate-x-0.5",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[13px] border",
          compact ? "size-[34px] rounded-[12px]" : "size-[38px]",
          active
            ? "border-transparent bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-[0_10px_18px_color-mix(in_srgb,var(--primary)_26%,transparent)] dark:text-[#08140d]"
            : "border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--muted)] text-[var(--primary)]",
        )}
      >
        <item.icon size={compact ? 16 : 18} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>{item.label}</span>
        <small className="mt-0.5 text-[11px] font-bold text-[var(--subtle)]">{item.hint}</small>
      </span>
      {item.pro ? (
        <span className="ms-auto rounded-full border border-[rgba(201,154,67,.18)] bg-gradient-to-br from-[#fff6df] to-[#f7e6b8] px-1.5 py-1 text-[11px] font-black text-[#6f4b08]">
          PRO
        </span>
      ) : null}
    </Link>
  );
}

export function DesktopSidebar({
  pathname,
  name,
}: {
  pathname: string;
  name: string;
}) {
  const settings = desktopSettingsNavigation[0];

  return (
    <aside
      className="sticky top-0 z-30 hidden h-screen w-[258px] shrink-0 flex-col border-e bg-gradient-to-b from-[color-mix(in_srgb,var(--surface)_95%,var(--primary)_5%)] to-[var(--surface)] px-[18px] pb-5 pt-[26px] shadow-[10px_0_34px_color-mix(in_srgb,var(--foreground)_3%,transparent)] lg:flex"
      aria-label="Desktop"
    >
      <div className="flex items-center justify-between px-2 pb-4">
        <Logo />
      </div>
      <div className="mb-6 flex items-center gap-3 rounded-[22px] border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-gradient-to-b from-[var(--surface-2)] to-[color-mix(in_srgb,var(--surface)_92%,var(--mint)_8%)] p-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,.35)]">
        <span className="grid size-[46px] place-items-center rounded-2xl bg-gradient-to-br from-[var(--mint)] to-[color-mix(in_srgb,var(--mint)_68%,white)] text-sm font-black text-[var(--primary)] shadow-[0_10px_20px_color-mix(in_srgb,var(--primary)_12%,transparent)]">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <b className="block truncate text-[14px]">{name}</b>
          <small className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">
            Personal account
          </small>
          <small className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[rgba(201,154,67,.16)] bg-gradient-to-br from-[#fff6df] to-[#f7e6b8] px-2 py-0.5 text-[11px] font-black text-[#6f4b08]">
            <Gem size={10} aria-hidden="true" /> Free plan
          </small>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        <nav className="grid content-start gap-1.5" aria-label="Main">
          {desktopPrimaryNavigation.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <p className="px-3 pb-1 pt-4 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--subtle)]">
          More finance tools
        </p>
        <nav className="grid content-start gap-1.5" aria-label="More finance tools">
          {financeToolsNavigation.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} compact />
          ))}
        </nav>
      </div>
      <div className="mt-auto grid gap-2 border-t border-[color-mix(in_srgb,var(--border)_75%,transparent)] pt-3.5">
        <nav aria-label="Settings">
          <NavLink item={settings} pathname={pathname} compact />
        </nav>
        <Link
          href="/premium"
          className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[15px] border border-[rgba(201,154,67,.24)] bg-gradient-to-br from-[var(--gold-soft)] to-[color-mix(in_srgb,var(--surface)_82%,var(--gold-soft)_18%)] px-2.5 py-2.5 text-start hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(201,154,67,.12)]"
        >
          <span className="grid size-[38px] place-items-center rounded-xl border border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[var(--surface)] font-black text-[var(--gold)]">
            <Gem size={17} aria-hidden="true" />
          </span>
          <span>
            <b className="block text-[11px]">Hisaab Premium</b>
            <small className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">
              Explore premium features
            </small>
          </span>
          <ArrowRight className="text-[var(--muted-foreground)] rtl:rotate-180" size={16} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
