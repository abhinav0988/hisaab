"use client";

import { Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Shared theme toggle for immersed page headers. */
export function ImmersedThemeButton({ className = "page-chrome-btn" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && theme === "dark";
  return (
    <button
      type="button"
      className={className}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
    </button>
  );
}

/** Lightweight notify control for immersed headers without full shell panel wiring. */
export function ImmersedNotifyButton({
  className = "page-chrome-btn page-chrome-notify",
  emptyText = "No new alerts right now.",
}: {
  className?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="page-chrome-notify-wrap" ref={wrapRef}>
      <button
        type="button"
        className={className}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="page-chrome-notify-panel" role="dialog" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </header>
          <p>{emptyText}</p>
        </div>
      ) : null}
    </div>
  );
}
