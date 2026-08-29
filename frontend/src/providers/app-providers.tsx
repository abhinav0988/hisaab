"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { LocaleDir } from "@/components/layout/locale-dir";
import { ThemeAttribute } from "@/components/layout/theme-attribute";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: 0 } },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark"]}>
      <ThemeAttribute />
      <QueryClientProvider client={client}>
        <LocaleDir />
        {children}
        <Toaster richColors position="top-center" closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
