"use client";
import { signInSchema, signUpSchema } from "@hisaab/validation";
import { Button, Field, Input } from "@hisaab/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowRight, Check } from "lucide-react";
import { z } from "zod";
import { AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";
import { EmailOtpPanel } from "@/components/auth/email-otp-panel";
import { enterApp } from "@/lib/auth-navigation";
import { authService } from "@/services/auth.service";

type SignIn = z.infer<typeof signInSchema>;
type SignUp = z.infer<typeof signUpSchema>;
type AuthFormValues = SignIn & Partial<SignUp> & {
  confirmPassword: string;
};
const authControlClass =
  "min-h-[58px] rounded-[17px] bg-[var(--surface-2)] px-[17px] text-[16px] font-medium";

export function AuthPanel({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [registerMode, setRegisterMode] = useState(
    initialMode === "signup" || pathname === "/register",
  );
  const [visible, setVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const form = useForm<AuthFormValues>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      countryCode: "IN",
      rememberMe: true,
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    getValues,
    reset,
  } = form;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const emailVerified = verifiedEmail !== "" && verifiedEmail === emailValue.trim().toLowerCase();
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = Boolean(password) && password === confirmPassword;
  const quality = !password
    ? "Strong target"
    : hasLength && hasNumber && (!registerMode || passwordsMatch)
      ? "Looking strong"
      : hasLength || hasNumber
        ? "Almost there"
        : "Needs improvement";

  const setMode = (next: boolean) => {
    setRegisterMode(next);
    setVisible(false);
    setConfirmVisible(false);
    setTermsAccepted(true);
    setVerifiedEmail("");
    setPassword("");
    setConfirmPassword("");
    clearErrors();
    reset({
      name: "",
      email: getValues("email"),
      password: "",
      confirmPassword: "",
      countryCode: "IN",
      rememberMe: true,
    });
    router.replace(next ? "/register" : "/login", { scroll: false });
  };

  const submit = handleSubmit(async (values) => {
    if (registerMode) {
      if (values.password !== values.confirmPassword) {
        setError("confirmPassword", { message: "Passwords do not match" });
        return;
      }
      if (!termsAccepted) {
        setError("root", { message: "Accept the Terms and Privacy Policy to continue." });
        return;
      }
      if (!emailVerified) {
        toast.error("Verify your email before creating your account");
        return;
      }
      const parsed = signUpSchema.safeParse(values);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field === "string")
            setError(field as keyof SignUp, { message: issue.message });
        }
        return;
      }
      const result = await authService.signUp({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        callbackURL:
          typeof window === "undefined" ? "/dashboard" : `${window.location.origin}/dashboard`,
        countryCode: parsed.data.countryCode ?? "IN",
      });
      if (result.error) {
        setError("root", { message: result.error.message ?? "Unable to create account." });
        return;
      }
      toast.success("Account created securely");
      const token = result.data && "token" in result.data ? result.data.token : null;
      if (!token) {
        const signedIn = await authService.signIn({
          email: parsed.data.email,
          password: parsed.data.password,
          rememberMe: true,
        });
        if (signedIn.error) {
          router.replace("/login");
          toast.success("Account created. Sign in to continue.");
          return;
        }
      }
      await authService.getSession();
      enterApp("/dashboard");
      return;
    }
    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") setError(field as keyof SignIn, { message: issue.message });
      }
      return;
    }
    const result = await authService.signIn({
      email: parsed.data.email,
      password: parsed.data.password,
      rememberMe: parsed.data.rememberMe,
    });
    if (result.error) {
      const message = result.error.message ?? "Unable to sign in.";
      if (/verif/i.test(message)) {
        router.replace(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
        toast.error("Verify your email before signing in.");
        return;
      }
      setError("root", { message });
      return;
    }
    toast.success("Signed in securely");
    await authService.getSession();
    enterApp(search.get("next") || "/dashboard");
  });

  return (
    <div data-auth-mode={registerMode ? "signup" : "signin"}>
      <AuthWelcome
        title={registerMode ? "Create your Hisaab" : "Welcome back"}
        subtitle={
          registerMode
            ? "Create your private money space. Verify your email first, then complete secure account setup."
            : "Sign in to continue to your private money space."
        }
      />
      <form className="grid gap-[19px]" onSubmit={submit} noValidate>
        {registerMode ? (
          <Field label="Full name" error={errors.name?.message} hint="Required for profile setup.">
            <Input
              autoComplete="name"
              placeholder="Enter your full name"
              className={authControlClass}
              {...register("name")}
            />
          </Field>
        ) : null}
        {registerMode ? (
          <div className="grid gap-2 text-[13px] font-extrabold">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="auth-email">Email address</label>
              <small className="font-bold text-[var(--muted-foreground)]">
                {emailVerified ? "Verified identity email" : "Verify this email before registration"}
              </small>
            </span>
            <EmailOtpPanel
              email={emailValue}
              verified={emailVerified}
              onVerified={() => setVerifiedEmail(emailValue.trim().toLowerCase())}
              onReset={() => setVerifiedEmail("")}
            >
              <Input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                readOnly={emailVerified}
                className={authControlClass}
                {...register("email", {
                  onChange: (event) => setEmailValue(event.target.value),
                })}
                id="auth-email"
              />
            </EmailOtpPanel>
            {errors.email?.message ? (
              <span className="text-xs text-[var(--danger)]" role="alert">
                {errors.email.message}
              </span>
            ) : null}
          </div>
        ) : (
          <Field label="Email address" error={errors.email?.message} hint="Your private login ID.">
            <Input
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              className={authControlClass}
              {...register("email", {
                onChange: (event) => setEmailValue(event.target.value),
              })}
            />
          </Field>
        )}
        <div className={`grid gap-4 ${registerMode ? "md:grid-cols-2" : ""}`}>
          <Field
            label={registerMode ? "Create password" : "Password"}
            error={errors.password?.message}
            hint={registerMode ? "Use 8+ characters and at least 1 number." : undefined}
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
              autoComplete={registerMode ? "new-password" : "current-password"}
              placeholder="Enter your password"
              className={authControlClass}
              {...register("password", {
                onChange: (event) => setPassword(event.target.value),
              })}
            />
          </Field>
          {registerMode ? (
            <Field
              label="Confirm password"
              error={errors.confirmPassword?.message}
              hint="Re-enter the same secure password."
              action={
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 text-[11px] font-bold text-[var(--muted-foreground)]"
                  onClick={() => setConfirmVisible((value) => !value)}
                >
                  {confirmVisible ? "Hide" : "Show"}
                </button>
              }
            >
              <Input
                type={confirmVisible ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                className={authControlClass}
                {...register("confirmPassword", {
                  onChange: (event) => setConfirmPassword(event.target.value),
                })}
              />
            </Field>
          ) : null}
        </div>
        {registerMode ? (
          <div className="rounded-[20px] border border-[color-mix(in_srgb,var(--primary)_12%,var(--border))] bg-gradient-to-b from-[color-mix(in_srgb,var(--mint)_82%,var(--surface))] to-[var(--surface)] p-4">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <b className="text-xs">Password quality</b>
              <span className="rounded-full border bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-black text-[var(--primary)]">
                {quality}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <span className={`auth-strength-rule ${hasLength ? "is-valid" : ""}`}><Check size={13} aria-hidden="true" /> 8+ characters</span>
              <span className={`auth-strength-rule ${hasNumber ? "is-valid" : ""}`}><Check size={13} aria-hidden="true" /> At least 1 number</span>
              <span className={`auth-strength-rule ${passwordsMatch ? "is-valid" : ""}`}><Check size={13} aria-hidden="true" /> Passwords match</span>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4 text-[11px] text-[var(--muted-foreground)]">
          <label className="flex items-center gap-[7px]">
            {registerMode ? (
              <input
                type="checkbox"
                className="size-3.5 accent-[var(--primary)]"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
            ) : (
              <input
                type="checkbox"
                className="size-3.5 accent-[var(--primary)]"
                {...register("rememberMe")}
              />
            )}
            {registerMode ? "I agree to the Terms & Privacy Policy" : "Keep me signed in"}
          </label>
          {!registerMode ? (
            <button
              type="button"
              className="shrink-0 border-0 bg-transparent p-0 font-bold text-[var(--muted-foreground)]"
              onClick={() => router.push("/forgot-password")}
            >
              Forgot password?
            </button>
          ) : null}
        </div>
        {errors.root?.message ? (
          <p
            className="rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
            role="alert"
          >
            {errors.root.message}
          </p>
        ) : null}
        <Button
          className={`min-h-[54px] w-full rounded-2xl text-[13px] shadow-[0_16px_32px_color-mix(in_srgb,var(--primary)_24%,transparent)]${registerMode && !emailVerified ? " verification-required" : ""}`}
          disabled={isSubmitting || (registerMode && !emailVerified)}
        >
          <span>{isSubmitting
            ? registerMode
              ? "Creating account…"
              : "Signing in…"
            : registerMode
              ? emailVerified
                ? "Create my secure account"
                : "Verify email to continue"
              : "Continue securely"}</span>
          {!isSubmitting && (!registerMode || emailVerified) ? <ArrowRight size={16} aria-hidden="true" /> : null}
        </Button>
      </form>
      <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--muted-foreground)]">
        {registerMode ? "Already have an account? " : "New to Hisaab? "}
        <button
          type="button"
          className="ml-1 inline-flex min-h-9 items-center justify-center rounded-full border bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-3.5 font-extrabold text-[var(--primary)]"
          onClick={() => setMode(!registerMode)}
        >
          {registerMode ? "Back to sign in" : "Create your account"}
        </button>
      </p>
      <AuthTrust />
    </div>
  );
}
