import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-[17px] py-[11px] text-[12px] font-extrabold tracking-[-0.01em] transition duration-200 hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-55",
        variant === "primary" &&
          "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-[0_12px_24px_color-mix(in_srgb,var(--primary)_20%,transparent)] hover:shadow-[0_16px_32px_color-mix(in_srgb,var(--primary)_25%,transparent)] dark:text-[#08140d]",
        variant === "secondary" &&
          "border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] text-[var(--foreground)] shadow-[0_6px_16px_color-mix(in_srgb,var(--foreground)_4%,transparent)] hover:bg-[var(--muted)]",
        variant === "ghost" &&
          "min-h-11 rounded-[11px] px-[11px] py-[9px] text-[11px] font-extrabold text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        variant === "danger" &&
          "border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
        className,
      )}
      {...props}
    />
  );
}
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] shadow-[var(--shadow)] transition duration-200 hover:border-[color-mix(in_srgb,var(--primary)_14%,var(--border))] hover:shadow-[var(--shadow-lg)]",
          className,
        )}
        {...props}
      />
    );
  },
);
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-[15px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-3.5 text-base text-[var(--foreground)] outline-none transition placeholder:text-[var(--subtle)] focus:border-[color-mix(in_srgb,var(--primary)_42%,var(--border))] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)] md:text-[13px]",
        className,
      )}
      {...props}
    />
  );
});
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-12 w-full rounded-[15px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-3.5 text-base text-[var(--foreground)] outline-none focus:border-[color-mix(in_srgb,var(--primary)_42%,var(--border))] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)] md:text-[13px]",
        className,
      )}
      {...props}
    />
  );
});
export function Field({
  label,
  error,
  hint,
  action,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const generatedId = React.useId();
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  type FieldControlProps = {
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  };
  const child = React.isValidElement<FieldControlProps>(children) ? children : null;
  const controlId = child?.props.id ?? generatedId;
  const control = child
    ? React.cloneElement(child, {
        id: controlId,
        "aria-describedby": error ? errorId : hint ? hintId : child.props["aria-describedby"],
        "aria-invalid": error ? true : child.props["aria-invalid"],
      })
    : children;
  return (
    <div className="grid gap-2 text-[13px] font-extrabold">
      <span className="flex items-center justify-between gap-2">
        <label htmlFor={controlId}>{label}</label>
        {action}
      </span>
      {control}
      {hint && !error ? (
        <span id={hintId} className="text-[11px] font-medium leading-relaxed text-[var(--muted-foreground)]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide",
        tone === "neutral" && "bg-[var(--muted)] text-[var(--muted-foreground)]",
        tone === "success" && "bg-[var(--mint)] text-[var(--primary)]",
        tone === "warning" && "bg-[var(--gold-soft)] text-[var(--gold-foreground)]",
        tone === "danger" && "bg-[var(--danger-soft)] text-[var(--danger)]",
      )}
    >
      {children}
    </span>
  );
}
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[96px] w-full rounded-[15px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-3.5 py-3 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--subtle)] focus:border-[color-mix(in_srgb,var(--primary)_42%,var(--border))] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)] md:text-[13px]",
        className,
      )}
      {...props}
    />
  );
});
export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-11 min-w-11 items-center justify-center rounded-full",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-[26px] w-[46px] shrink-0 rounded-full transition",
          checked ? "bg-[var(--primary)]" : "bg-[var(--muted)]",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-5 rounded-full bg-[var(--surface)] shadow-[0_1px_6px_rgba(0,0,0,.18)] transition-[inset-inline-start]",
            checked ? "start-[23px]" : "start-[3px]",
          )}
        />
      </span>
    </button>
  );
}
