"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
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
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={`top-action ${className}`}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2" />
          <path d="M12 19.8V22" />
          <path d="M4.9 4.9l1.5 1.5" />
          <path d="M17.6 17.6l1.5 1.5" />
          <path d="M2 12h2.2" />
          <path d="M19.8 12H22" />
          <path d="M4.9 19.1l1.5-1.5" />
          <path d="M17.6 6.4l1.5-1.5" />
        </svg>
      )}
    </button>
  );
}
