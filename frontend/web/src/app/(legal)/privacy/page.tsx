import { Card } from "@hisaab/ui";
import Link from "next/link";
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Card className="p-7 sm:p-10">
        <h1 className="text-3xl font-bold">Hisaab Privacy Policy</h1>
        <p className="mt-4 leading-7 text-[var(--muted-foreground)]">
          Hisaab stores account details, preferences, and the financial records you provide so it
          can calculate balances, budgets, and reports. Passwords are handled by Better Auth and are
          never logged. Private records are scoped to your authenticated user ID.
        </p>
        <p className="mt-4 leading-7 text-[var(--muted-foreground)]">
          Authentication cookies are HTTP-only. Audit logs omit raw passwords, session tokens, and
          financial notes. You may delete your profile through the API; configured retention and
          backup policies remain the responsibility of the deployment operator.
        </p>
        <Link href="/register" className="mt-7 inline-block font-semibold text-[var(--primary)]">
          Back to registration
        </Link>
      </Card>
    </main>
  );
}
