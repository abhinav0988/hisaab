"use client";
import { Button, Field, Input } from "@hisaab/ui";
import { passwordSchema } from "@hisaab/validation";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";
import { authService } from "@/services/auth.service";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "This reset link is invalid or expired.");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("This reset link is invalid or expired.");
      return;
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Choose a stronger password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await authService.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message ?? "Unable to reset password.");
        return;
      }
      toast.success("Password updated");
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <AuthWelcome
        title="Choose a new password"
        subtitle="Use 8+ characters with a number for stronger protection."
      />
      <form onSubmit={submit} className="grid gap-[19px]">
        <Field
          label="New password"
          error={error}
          action={
            <button
              type="button"
              className="border-0 bg-transparent p-0 text-[11px] font-bold text-[var(--muted-foreground)]"
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? "Hide" : "Show"}
            </button>
          }
        >
          <Input
            type={visible ? "text" : "password"}
            minLength={8}
            required
            placeholder="Enter your password"
            className="min-h-[58px] rounded-[17px] bg-[var(--surface-2)] px-[17px] text-[15px]"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type={visible ? "text" : "password"}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="min-h-[58px] rounded-[17px] bg-[var(--surface-2)] px-[17px] text-[15px]"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <span className={`auth-strength-rule ${password.length >= 8 ? "is-valid" : ""}`}>✓ 8+ characters</span>
          <span className={`auth-strength-rule ${/\d/.test(password) ? "is-valid" : ""}`}>✓ At least 1 number</span>
        </div>
        {error ? <p className="rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
        <Button className="min-h-[54px] w-full rounded-2xl text-[13px]" disabled={loading || !token}>
          {loading ? "Updating…" : "Update password →"}
        </Button>
      </form>
      <AuthTrust />
    </div>
  );
}
