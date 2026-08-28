"use client";
import { AUTH_COUNTRIES, signInSchema, signUpSchema } from "@hisaab/validation";
import { Button, Field, Input, Select } from "@hisaab/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AuthTrust, AuthWelcome } from "@/components/auth/auth-chrome";
import { authService } from "@/services/auth.service";

type SignIn = z.infer<typeof signInSchema>;
type SignUp = z.infer<typeof signUpSchema>;

export function AuthPanel({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [registerMode, setRegisterMode] = useState(
    initialMode === "signup" || pathname === "/register",
  );
  const [visible, setVisible] = useState(false);
  const form = useForm<SignIn & Partial<SignUp>>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
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
  } = form;

  const setMode = (next: boolean) => {
    setRegisterMode(next);
    setVisible(false);
    clearErrors();
    router.replace(next ? "/register" : "/login", { scroll: false });
  };

  const submit = handleSubmit(async (values) => {
    if (registerMode) {
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
        callbackURL: "/verify-email",
        countryCode: parsed.data.countryCode,
      });
      if (result.error) {
        setError("root", { message: result.error.message ?? "Unable to create account." });
        return;
      }
      toast.success("Account created securely");
      router.replace("/dashboard");
      router.refresh();
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
      setError("root", { message: result.error.message ?? "Unable to sign in." });
      return;
    }
    toast.success("Signed in securely");
    router.replace(search.get("next") || "/dashboard");
    router.refresh();
  });

  return (
    <div>
      <AuthWelcome
        title={registerMode ? "Create your Hisaab" : "Welcome back"}
        subtitle={
          registerMode
            ? "Start your private money journey in less than a minute."
            : "Sign in to continue to your private money space."
        }
      />
      <form className="grid gap-[13px]" onSubmit={submit} noValidate>
        {registerMode ? (
          <Field label="Full name" error={errors.name?.message}>
            <Input
              autoComplete="name"
              placeholder="Enter your full name"
              className="bg-[var(--surface-2)]"
              {...register("name")}
            />
          </Field>
        ) : null}
        <Field label="Email address" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            className="bg-[var(--surface-2)]"
            {...register("email")}
          />
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          hint={
            registerMode ? "Use 8+ characters with a number for stronger protection." : undefined
          }
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
            className="bg-[var(--surface-2)]"
            {...register("password")}
          />
        </Field>
        {registerMode ? (
          <Field label="Country" error={errors.countryCode?.message}>
            <Select className="bg-[var(--surface-2)]" {...register("countryCode")}>
              {AUTH_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
          <label className="flex items-center gap-[7px]">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--primary)]"
              {...register("rememberMe")}
            />
            Keep me signed in
          </label>
          <button
            type="button"
            className="border-0 bg-transparent p-0 font-bold text-[var(--muted-foreground)]"
            onClick={() => router.push("/forgot-password")}
          >
            Forgot password?
          </button>
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
          className="min-h-[49px] w-full text-xs shadow-[0_12px_28px_color-mix(in_srgb,var(--primary)_22%,transparent)]"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? registerMode
              ? "Creating account…"
              : "Signing in…"
            : registerMode
              ? "Create my secure account →"
              : "Continue securely →"}
        </Button>
      </form>
      <p className="mt-5 text-center text-[10px] text-[var(--muted-foreground)]">
        {registerMode ? "Already have an account? " : "New to Hisaab? "}
        <button
          type="button"
          className="border-0 bg-transparent p-0 font-bold text-[var(--foreground)]"
          onClick={() => setMode(!registerMode)}
        >
          {registerMode ? "Back to sign in" : "Create your account"}
        </button>
      </p>
      <AuthTrust />
    </div>
  );
}
