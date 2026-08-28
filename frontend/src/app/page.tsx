"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="grid min-h-screen place-items-center">
      <p className="text-sm text-[var(--muted-foreground)]">Opening your Hisaab…</p>
    </div>
  );
}
