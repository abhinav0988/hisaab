"use client";

import { Input } from "@hisaab/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthStatus, AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";
import { EmailOtpPanel } from "@/components/auth/email-otp-panel";
import { enterApp } from "@/lib/auth-navigation";
import { authClient } from "@/lib/auth-client";
import { authService } from "@/services/auth.service";

export function VerifyEmailView() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: session, isPending, refetch } = authService.useSession();
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const verified =
    session?.user.emailVerified === true ||
    (verifiedEmail !== "" && verifiedEmail === email.trim().toLowerCase());

  useEffect(() => {
    if (!email && session?.user.email) setEmail(session.user.email);
  }, [email, session?.user.email]);

  useEffect(() => {
    if (session?.user.emailVerified === true) enterApp("/dashboard");
  }, [session?.user.emailVerified]);

  return (
    <div>
      <AuthWelcome
        title="Verify your email"
        subtitle="Enter the 6-digit code we send. You need a confirmed inbox before Hisaab can open your workspace."
      />
      <AuthStatus
        icon="✉"
        title={verified ? "Email verified" : isPending ? "Checking your session…" : "Check your inbox"}
        description={
          verified
            ? "Your email is confirmed. Opening your Hisaab…"
            : email
              ? `We’ll send a 6-digit verification code to ${email}. Older codes expire when a new one is requested.`
              : "Enter your email, send a 6-digit code, then confirm it. Older codes expire when a new one is requested."
        }
      />
      <div className="grid gap-3">
        <div className="grid gap-2 text-[13px] font-extrabold">
          <label htmlFor="verify-email">Email address</label>
          <EmailOtpPanel
            email={email}
            verified={verified}
            autoSend
            verifiedHint="You can now sign in and open your Hisaab workspace."
            onVerified={async () => {
              const normalized = email.trim().toLowerCase();
              setVerifiedEmail(normalized);
              const next = await authClient.getSession();
              await refetch();
              if (next.data?.user || session) {
                enterApp("/dashboard");
                return;
              }
              toast.success("Email verified. Sign in to continue.");
              router.replace("/login");
            }}
            onReset={() => setVerifiedEmail("")}
          >
            <Input
              id="verify-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              className="min-h-[58px] rounded-[17px] bg-[var(--surface-2)] px-[17px] text-[16px]"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </EmailOtpPanel>
        </div>
        <Link
          href="/login"
          className="inline-flex min-h-[49px] w-full items-center justify-center rounded-[14px] border border-[var(--border)] text-xs font-extrabold"
        >
          Back to sign in
        </Link>
      </div>
      <AuthTrust />
    </div>
  );
}
