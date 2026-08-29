import Link from "next/link";
import { AuthStatus, AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";

export function VerifyEmailView() {
  return (
    <div>
      <AuthWelcome
        title="Verify your email"
        subtitle="Open the verification link we sent. You can keep using Hisaab while email delivery is configured."
      />
      <AuthStatus
        icon="✉"
        title="Check your inbox"
        description="Use the newest verification email. Older links may expire after a new one is requested."
      />
      <Link
        href="/dashboard"
        className="inline-flex min-h-[49px] w-full items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-xs font-extrabold text-white dark:text-[#08140d]"
      >
        Continue to Hisaab →
      </Link>
      <AuthTrust />
    </div>
  );
}
