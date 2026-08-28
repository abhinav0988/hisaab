import Link from "next/link";
import { AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";

export function AccessDeniedView() {
  return (
    <div>
      <AuthWelcome
        title="Access denied"
        subtitle="You do not have permission to view this resource."
      />
      <Link
        href="/dashboard"
        className="inline-flex min-h-[49px] w-full items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-xs font-extrabold text-white dark:text-[#08140d]"
      >
        Back to dashboard →
      </Link>
      <AuthTrust />
    </div>
  );
}
