import { Eyebrow } from "./chrome";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-[26px] flex flex-col gap-[22px] sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="m-0 text-[clamp(26px,7vw,38px)] font-semibold leading-[1.08] tracking-[-0.055em]">
          {title}
        </h1>
        <p className="mt-[9px] max-w-[760px] text-[14px] leading-[1.65] text-[var(--muted-foreground)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}
