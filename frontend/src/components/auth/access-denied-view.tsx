import Link from "next/link";
import { ArrowRight, ShieldX } from "lucide-react";
import { AuthStatus, AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";

export function AccessDeniedView() {
  return (
    <div>
      <AuthWelcome
        title="Access denied"
        subtitle="You do not have permission to view this resource."
      />
      <AuthStatus
        icon={<ShieldX size={21} aria-hidden="true" />}
        title="This area is protected"
        description="Your account is signed in, but it does not have access to the requested resource."
      />
      <Link
        href="/dashboard"
        className="inline-flex min-h-[49px] w-full items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-xs font-extrabold text-white dark:text-[#08140d]"
      >
        Back to dashboard <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <AuthTrust />
    </div>
  );
}
