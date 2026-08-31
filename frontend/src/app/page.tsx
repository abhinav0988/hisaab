"use client";
import { useEffect } from "react";
import { enterApp } from "@/lib/auth-navigation";
import { authService } from "@/services/auth.service";

export default function HomePage() {
  useEffect(() => {
    void authService.getSession().then((result) => {
      if (result.data) enterApp("/dashboard");
      else window.location.replace("/login");
    });
  }, []);
  return (
    <div className="grid min-h-screen place-items-center">
      <p className="text-sm text-[var(--muted-foreground)]">Opening your Hisaab…</p>
    </div>
  );
}
