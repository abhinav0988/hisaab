"use client";

import { cn } from "@hisaab/ui";
import Link from "next/link";
import { Modal } from "./modal";
import { isNavActive, moreNavigation } from "./nav-config";

export function MoreMenu({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="More">
      <nav className="grid gap-2" aria-label="More">
        {moreNavigation.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-3",
                active
                  ? "border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] bg-[var(--mint)] text-[var(--primary)]"
                  : "border-[var(--border)] hover:bg-[var(--muted)]",
              )}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--muted)] text-[var(--primary)]">
                <item.icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <b className="block text-sm">{item.label}</b>
                <small className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">{item.hint}</small>
              </span>
            </Link>
          );
        })}
      </nav>
    </Modal>
  );
}
