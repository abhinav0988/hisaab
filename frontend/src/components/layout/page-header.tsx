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
    <header className="mb-[22px] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="m-0 text-[25px] font-semibold leading-[1.12] tracking-[-0.045em] lg:text-[30px]">
          {title}
        </h1>
        <p className="mt-[7px] text-[13px] text-[var(--muted-foreground)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-[9px]">{actions}</div> : null}
    </header>
  );
}
