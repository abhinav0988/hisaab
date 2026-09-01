import { Check, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthWelcome({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[26px] flex items-center justify-between gap-4">
      <div>
        <h2 className="m-0 text-[clamp(28px,7vw,42px)] font-extrabold leading-[1.08] tracking-[-0.055em]">{title}</h2>
        <p className="mt-[11px] max-w-[430px] text-[15px] leading-[1.7] text-[var(--muted-foreground)]">{subtitle}</p>
      </div>
      <div
        className="secure-mark premium-icon-tile size-[46px] shrink-0"
        title="Secure access"
      >
        <ShieldCheck size={22} aria-hidden="true" />
      </div>
    </div>
  );
}

export function AuthTrust() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 border-t border-[var(--border)] pt-[18px] text-[11px] text-[var(--muted-foreground)]">
      <span className="flex items-center gap-1.5"><Check size={13} aria-hidden="true" /> Encrypted</span>
      <span className="flex items-center gap-1.5"><Check size={13} aria-hidden="true" /> Private</span>
      <span className="flex items-center gap-1.5"><Check size={13} aria-hidden="true" /> Secure sessions</span>
    </div>
  );
}

export function AuthStatus({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 rounded-[20px] border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))] bg-gradient-to-br from-[var(--mint)] to-[var(--surface)] p-5 text-center">
      <span className="premium-icon-tile mx-auto size-12">
        {icon}
      </span>
      <b className="mt-3 block text-sm">{title}</b>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
}
