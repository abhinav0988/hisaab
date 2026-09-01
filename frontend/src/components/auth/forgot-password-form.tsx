"use client";
import { Button, Field, Input } from "@hisaab/ui";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";
import { authService } from "@/services/auth.service";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authService.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) throw new Error(result.error.message ?? "Unable to send a reset link.");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send a reset link.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <AuthWelcome
        title="Reset your password"
        subtitle="Enter your email and we’ll send a secure reset link."
      />
      {sent ? (
        <div className="rounded-[20px] border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))] bg-[var(--mint)] p-5">
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
              className="min-h-[58px] rounded-[17px] bg-[var(--surface-2)] px-[17px] text-[15px]"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          {error ? <p className="rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
          <Button className="min-h-[54px] w-full rounded-2xl text-[13px]" disabled={loading}>
            {loading ? "Sending…" : <><span>Send reset link</span><ArrowRight size={16} aria-hidden="true" /></>}
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
