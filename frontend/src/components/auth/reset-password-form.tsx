"use client";
import { Button, Field, Input } from "@hisaab/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";
import { authService } from "@/services/auth.service";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("This reset link is invalid or expired.");
      return;
    }
    const result = await authService.resetPassword({ newPassword: password, token });
    if (result.error) {
      setError(result.error.message ?? "Unable to reset password.");
      return;
    }
    toast.success("Password updated");
    router.replace("/login");
  };
  return (
    <div>
      <AuthWelcome
        title="Choose a new password"
        subtitle="Use 8+ characters with a number for stronger protection."
      />
      <form onSubmit={submit} className="grid gap-[13px]">
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
            className="bg-[var(--surface-2)]"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button className="min-h-[49px] w-full text-xs">Update password →</Button>
      </form>
      <AuthTrust />
    </div>
  );
}
