export function AuthWelcome({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[26px] flex items-center justify-between gap-4">
      <div>
        <h2 className="m-0 text-[clamp(28px,7vw,42px)] font-extrabold leading-[1.08] tracking-[-0.055em]">{title}</h2>
        <p className="mt-[11px] max-w-[430px] text-[15px] leading-[1.7] text-[var(--muted-foreground)]">{subtitle}</p>
      </div>
      <div
        className="secure-mark grid size-[46px] shrink-0 place-items-center rounded-[15px] bg-[var(--mint)] text-[20px] text-[var(--primary)]"
        title="Secure access"
      >
        ⌾
      </div>
    </div>
  );
}

export function AuthTrust() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 border-t border-[var(--border)] pt-[18px] text-[11px] text-[var(--muted-foreground)]">
      <span className="flex items-center gap-1.5">✓ Encrypted</span>
      <span className="flex items-center gap-1.5">✓ Private</span>
      <span className="flex items-center gap-1.5">✓ Secure sessions</span>
    </div>
  );
}

export function AuthStatus({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 rounded-[20px] border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))] bg-gradient-to-br from-[var(--mint)] to-[var(--surface)] p-5 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface)] text-xl text-[var(--primary)] shadow-[var(--shadow)]">
        {icon}
      </span>
      <b className="mt-3 block text-sm">{title}</b>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
}
