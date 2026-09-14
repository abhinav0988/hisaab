"use client";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-[26px]" />}>
      <AuthPanel initialMode="signup" />
    </Suspense>
  );
}
