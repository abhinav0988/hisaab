import { cn } from "@hisaab/ui";
import type { ReactNode } from "react";

export function MoneyDisplay({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("money-value min-w-0 break-words [overflow-wrap:anywhere]", className)}>
      {children}
    </span>
  );
}
