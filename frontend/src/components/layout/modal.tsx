"use client";
import { Card, cn } from "@hisaab/ui";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  open,
  title,
  description,
  onClose,
  size = "md",
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid items-end bg-[rgba(3,11,7,.52)] p-0 backdrop-blur-[5px] sm:place-items-center sm:p-[18px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button className="absolute inset-0" onClick={onClose} aria-label="Close dialog" />
      <Card
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-b-none bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] p-[22px] shadow-[0_32px_100px_rgba(0,0,0,.28)] sm:rounded-[28px]",
          size === "lg" ? "sm:max-w-[720px]" : "sm:max-w-xl",
        )}
      >
        <div className="mb-[18px] flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="m-0 text-lg font-bold tracking-[-0.025em]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="grid size-[38px] shrink-0 place-items-center rounded-[13px] bg-[var(--muted)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}
