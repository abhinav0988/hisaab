import { Suspense } from "react";
import { VerifyEmailView } from "@/components/auth/verify-email-view";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-40" />}>
      <VerifyEmailView />
    </Suspense>
  );
}
