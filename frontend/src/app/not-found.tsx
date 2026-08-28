import { Card } from "@hisaab/ui";
import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <Card className="max-w-md p-8 text-center">
        <p className="text-sm font-bold text-[var(--primary)]">404</p>
        <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          The page may have moved or the address is incorrect.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-10 items-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to dashboard
        </Link>
      </Card>
    </main>
  );
}
