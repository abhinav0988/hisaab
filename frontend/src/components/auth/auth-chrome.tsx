export function AuthWelcome({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[23px] flex items-center justify-between gap-3">
      <div>
        <h2 className="m-0 text-[34px] font-semibold leading-none tracking-[-0.05em]">{title}</h2>
        <p className="mt-[7px] text-xs leading-normal text-[var(--muted-foreground)]">{subtitle}</p>
      </div>
      <div
        className="grid size-[46px] shrink-0 place-items-center rounded-[15px] bg-[var(--mint)] text-[20px] text-[var(--primary)]"
        title="Secure access"
      >
        ⌾
      </div>
    </div>
  );
}

export function AuthTrust() {
  return (
    <div className="mt-[22px] flex items-center justify-center gap-3.5 text-[9px] text-[var(--muted-foreground)]">
      <span className="flex items-center gap-1.5">✓ Encrypted</span>
      <span className="flex items-center gap-1.5">✓ Private</span>
      <span className="flex items-center gap-1.5">✓ Secure sessions</span>
    </div>
  );
}
