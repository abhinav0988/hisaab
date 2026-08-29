"use client";

import { Button, Card } from "@hisaab/ui";
import { Inbox, Lock, Sparkles, TriangleAlert, WifiOff } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useOnline } from "@/hooks/use-online";

export function PageSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="skeleton h-10 w-64 max-w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="grid place-items-center p-8 text-center sm:p-10">
      <span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
        <Inbox aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function NoResults({
  query,
  onClear,
}: {
  query: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      title={`No results for “${query}”`}
      description="Try a different merchant, category, or account, or clear the search to see everything."
      action={
        onClear ? (
          <Button variant="secondary" onClick={onClear}>
            Clear search
          </Button>
        ) : null
      }
    />
  );
}

export function OfflineState({ retry }: { retry: () => void }) {
  return (
    <Card className="grid place-items-center p-8 text-center sm:p-10" role="alert">
      <WifiOff className="text-[var(--muted-foreground)]" aria-hidden="true" />
      <h3 className="mt-4 font-semibold">You’re offline</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
        Check your connection. Hisaab will load this page as soon as you’re back online.
      </p>
      <Button className="mt-5 min-h-11" variant="secondary" onClick={retry}>
        Try again
      </Button>
    </Card>
  );
}

export function ErrorState({ retry, message }: { retry: () => void; message?: string }) {
  const online = useOnline();
  if (!online) return <OfflineState retry={retry} />;
  return (
    <Card className="grid place-items-center p-8 text-center sm:p-10" role="alert">
      <TriangleAlert className="text-[var(--danger)]" aria-hidden="true" />
      <h3 className="mt-4 font-semibold">We couldn’t load this page</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
        {message ?? "Check your connection and try again."}
      </p>
      <Button className="mt-5 min-h-11" variant="secondary" onClick={retry}>
        Try again
      </Button>
    </Card>
  );
}

export function PermissionDenied() {
  return (
    <Card className="grid place-items-center p-8 text-center sm:p-10" role="alert">
      <Lock className="text-[var(--muted-foreground)]" aria-hidden="true" />
      <h3 className="mt-4 font-semibold">You don’t have access</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
        This area isn’t available for the current account. Return to Overview or contact support if
        this looks wrong.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--primary)] px-4 text-sm font-extrabold text-white dark:text-[#08140d]"
      >
        Go to Overview
      </Link>
    </Card>
  );
}

export function PremiumRequired({
  description = "This insight is part of Hisaab Premium.",
}: {
  description?: string;
}) {
  return (
    <Card className="grid place-items-center p-8 text-center sm:p-10">
      <Sparkles className="text-[var(--gold)]" aria-hidden="true" />
      <h3 className="mt-4 font-semibold">Premium required</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>
      <Link
        href="/premium"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--primary)] px-4 text-sm font-extrabold text-white dark:text-[#08140d]"
      >
        View Premium
      </Link>
    </Card>
  );
}

export function SessionExpiredState() {
  return (
    <Card className="grid place-items-center p-8 text-center sm:p-10" role="alert">
      <h3 className="font-semibold">Your session expired</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
        Sign in again to continue. Your data stayed protected.
      </p>
      <Link
        href="/session-expired"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--primary)] px-4 text-sm font-extrabold text-white dark:text-[#08140d]"
      >
        Sign in again
      </Link>
    </Card>
  );
}
