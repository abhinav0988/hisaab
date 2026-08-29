"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const modes = ["system", "light", "dark"] as const;
type ThemeMode = (typeof modes)[number];

function isThemeMode(value: string | undefined): value is ThemeMode {
  return modes.includes(value as ThemeMode);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const current: ThemeMode = mounted && isThemeMode(theme) ? theme : "system";
  const next = modes[(modes.indexOf(current) + 1) % modes.length] ?? "system";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={`top-action ${className}`}
      aria-label={`Theme is ${current}. Change to ${next}.`}
      title={`Theme: ${current}. Click for ${next}.`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
