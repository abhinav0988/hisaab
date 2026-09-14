import { cn } from "@hisaab/ui";

export function HisaabMark({
  variant = "brand",
  className,
}: {
  variant?: "brand" | "gold";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid size-11 place-items-center overflow-hidden rounded-2xl text-lg font-black",
        variant === "gold"
          ? "bg-gradient-to-br from-[#e6b95f] to-[#f5da99] text-[#173b2a] shadow-[0_12px_30px_rgba(0,0,0,.16)]"
          : "bg-gradient-to-br from-[#082f20] via-[#126645] to-[#2e9a69] text-white shadow-[0_16px_30px_rgba(16,82,52,.24)]",
        className,
      )}
    >
      <span className="absolute inset-0.5 rounded-[13px] border border-white/15" />
      <span className="relative">₹</span>
    </span>
  );
}

export function Logo({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <HisaabMark variant={inverse ? "gold" : "brand"} />
      <span className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-[24px] font-black tracking-[-0.045em]",
            inverse ? "text-white" : "text-[var(--foreground)]",
          )}
        >
          Hisaab
        </span>
        {compact ? null : (
          <small
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.12em]",
              inverse ? "text-emerald-100/80" : "text-[var(--muted-foreground)]",
            )}
          >
            Premium finance
          </small>
        )}
      </span>
    </div>
  );
}
