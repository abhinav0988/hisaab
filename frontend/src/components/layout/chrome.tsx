import { cn } from "@hisaab/ui";
import { MoneyDisplay } from "@/components/finance/money-display";

export function ProLabel({ children = "PRO" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-soft)] px-2 py-1 text-[11px] font-black text-[var(--gold-foreground)]">
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[9px] text-[11px] font-black uppercase tracking-[0.12em] text-[var(--primary)]">
      {children}
    </div>
  );
}

export function CardHead({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-[18px] flex items-start justify-between gap-3.5">
      <div>
        <h2 className="m-0 text-[18px] font-semibold tracking-[-0.03em]">{title}</h2>
        {description ? (
          <p className="mt-[5px] text-[12px] leading-[1.55] text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  note,
  icon,
  tone = "muted",
  foot,
  footNote,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  icon: React.ReactNode;
  tone?: "muted" | "positive" | "warning" | "negative";
  foot?: React.ReactNode;
  footNote?: React.ReactNode;
}) {
  return (
    <div className="overview-kpi">
      <div className="flex items-start justify-between gap-3 text-[12px] text-[var(--muted-foreground)]">
        <div>
          <small className="block text-[11px] font-extrabold uppercase tracking-[0.09em] text-[var(--muted-foreground)]">
            {label}
          </small>
          <div className="kpi-value mt-2.5 text-[clamp(22px,7vw,30px)] font-black leading-none tracking-[-0.05em]">
            <MoneyDisplay>{value}</MoneyDisplay>
          </div>
          {note ? (
            <div
              className={cn(
                "kpi-sub mt-1.5 text-[11px] leading-[1.55] text-[var(--muted-foreground)]",
              )}
            >
              {note}
            </div>
          ) : null}
        </div>
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-[0_14px_28px_color-mix(in_srgb,var(--primary)_18%,transparent)] dark:text-[#08140d]">
          {icon}
        </span>
      </div>
      {foot || footNote ? (
        <div className="kpi-foot">
          <span
            className={cn(
              tone === "positive" && "text-[var(--primary)]",
              tone === "warning" && "text-[var(--warning)]",
              tone === "negative" && "text-[var(--danger)]",
            )}
          >
            {foot}
          </span>
          <small>{footNote}</small>
        </div>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "ok",
  className,
}: {
  value: number;
  tone?: "ok" | "warn" | "danger" | "gold";
  className?: string;
}) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-[9px] overflow-hidden rounded-full bg-[var(--muted)]", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <span
        className={cn(
          "block h-full rounded-full",
          tone === "ok" && "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)]",
          tone === "warn" && "bg-gradient-to-r from-[#e2a355] to-[#cb7d31]",
          tone === "danger" && "bg-gradient-to-r from-[#e17369] to-[#c84c4c]",
          tone === "gold" && "bg-[#f1cf84]",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function Insight({
  gold,
  icon,
  title,
  body,
}: {
  gold?: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3.5",
        gold
          ? "border-[color-mix(in_srgb,var(--gold)_22%,var(--border))] bg-gradient-to-br from-[var(--gold-soft)] to-[var(--surface-2)]"
          : "border-[color-mix(in_srgb,var(--primary)_12%,var(--border))] bg-gradient-to-br from-[var(--muted)] to-[var(--surface-2)]",
      )}
    >
      <span
        className={cn(
          "premium-icon-tile size-[39px] shrink-0 rounded-[13px]",
          gold && "premium-icon-gold",
        )}
      >
        {icon}
      </span>
      <div>
        <b className="block text-[12px]">{title}</b>
        <small className="mt-1 block text-[11px] leading-[1.55] text-[var(--muted-foreground)]">{body}</small>
      </div>
    </div>
  );
}

export function Gauge({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      className="gauge"
      style={{
        background: `conic-gradient(var(--primary) 0 ${pct}%, var(--muted) ${pct}%)`,
      }}
    >
      <div className="gauge-copy">
        <b className="text-[28px] font-black">{pct}%</b>
        <small className="mt-0.5 block text-[var(--muted-foreground)]">used</small>
      </div>
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-[13px] py-2 text-[11px] font-bold transition hover:border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] hover:bg-[color-mix(in_srgb,var(--mint)_48%,var(--surface))] hover:text-[var(--primary)]",
        active
          ? "border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] bg-[var(--mint)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]",
      )}
    >
      {children}
    </button>
  );
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-[18px] border-b border-[var(--border)] py-[15px] last:border-0 max-sm:flex-col max-sm:items-start">
      <div>
        <b className="block text-[12px]">{title}</b>
        <small className="mt-1 block text-[11px] leading-[1.5] text-[var(--muted-foreground)]">{description}</small>
      </div>
      <div className="w-[210px] max-sm:w-full">{children}</div>
    </div>
  );
}
