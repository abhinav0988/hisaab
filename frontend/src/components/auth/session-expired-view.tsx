import Link from "next/link";
import { AuthStatus, AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";

export function SessionExpiredView() {
  return (
    <div>
      <AuthWelcome
        title="Your session expired"
        subtitle="For your security, please sign in again."
      />
      <AuthStatus
        icon="⌛"
        title="Your data stayed protected"
        description="We ended the inactive session. Sign in again to continue where you left off."
      />
      <Link
        href="/login"
        className="inline-flex min-h-[49px] w-full items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-xs font-extrabold text-white dark:text-[#08140d]"
      >
        Return to sign in →
      </Link>
      <AuthTrust />
    </div>
  );
}
