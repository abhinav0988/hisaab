"use client";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="skeleton h-72 rounded-2xl" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
