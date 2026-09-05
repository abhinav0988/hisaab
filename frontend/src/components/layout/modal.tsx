"use client";
import { Button, Card, cn } from "@hisaab/ui";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

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
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    requestAnimationFrame(() => (focusable()[0] ?? panelRef.current)?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = items[0]!;
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid items-end bg-[rgba(3,11,7,.52)] p-0 backdrop-blur-[5px] sm:place-items-center sm:p-[18px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <button className="absolute inset-0" onClick={onClose} aria-label="Close dialog" />
      <Card
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "responsive-dialog relative max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)))] w-full max-w-[100vw] overflow-y-auto rounded-b-none bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_36px_110px_rgba(0,0,0,.28)] sm:max-h-[92vh] sm:rounded-[32px] sm:p-7",
          size === "xl" ? "sm:max-w-[1080px]" : size === "lg" ? "sm:max-w-[980px]" : "sm:max-w-xl",
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-4 sm:mb-[22px]">
          <div>
            <h2 id={titleId} className="m-0 text-[21px] font-bold tracking-[-0.025em]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--muted-foreground)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[var(--muted)]"
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

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" className="min-h-11" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" className="min-h-11" disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
