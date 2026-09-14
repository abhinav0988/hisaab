import { Card } from "@hisaab/ui";
import Link from "next/link";
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Card className="p-7 sm:p-10">
        <h1 className="text-3xl font-bold">Hisaab Terms of Use</h1>
        <p className="mt-4 leading-7 text-[var(--muted-foreground)]">
          Hisaab is a personal record-keeping tool. You are responsible for the accuracy of
          information you enter and for protecting access to your account. Hisaab does not provide
          financial, tax, or investment advice.
        </p>
        <p className="mt-4 leading-7 text-[var(--muted-foreground)]">
          Do not use the service for unlawful activity or attempt to access another user’s data.
          Service availability may depend on the hosting environment configured by the operator.
        </p>
        <Link href="/register" className="mt-7 inline-block font-semibold text-[var(--primary)]">
          Back to registration
        </Link>
      </Card>
    </main>
  );
}
