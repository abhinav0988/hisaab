"use client";
import { Button, Field, Input } from "@hisaab/ui";
import Link from "next/link";
import { useState } from "react";
import { AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";
import { authService } from "@/services/auth.service";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    await authService.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
  };
  return (
    <div>
      <AuthWelcome
        title="Reset your password"
        subtitle="Enter your email and we’ll send a secure reset link."
      />
      {sent ? (
        <div className="rounded-2xl bg-[var(--mint)] p-5">
          <p className="font-semibold text-[var(--primary)]">Check your inbox</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            If an account exists for {email}, a reset link is on its way.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-[13px]">
          <Field label="Email address">
            <Input
              type="email"
              required
              placeholder="name@example.com"
              className="bg-[var(--surface-2)]"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Button className="min-h-[49px] w-full text-xs" disabled={loading}>
            {loading ? "Sending…" : "Send reset link →"}
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-[10px] text-[var(--muted-foreground)]">
        Remembered it?{" "}
        <Link href="/login" className="font-bold text-[var(--foreground)]">
          Back to sign in
        </Link>
      </p>
      <AuthTrust />
    </div>
  );
}
