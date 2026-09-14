"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeAttribute() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (theme !== "light" && theme !== "dark") {
      setTheme("dark");
      return;
    }
    document.documentElement.dataset.theme = theme;
  }, [theme, setTheme]);
  return null;
}
