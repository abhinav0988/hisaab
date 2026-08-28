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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-extrabold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shadow-[0_12px_24px_color-mix(in_srgb,var(--primary)_25%,transparent)] dark:text-[#08140d]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "ghost" &&
          "min-h-8 rounded-[10px] px-2.5 py-2 font-bold text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        variant === "danger" &&
          "border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
        className,
      )}
      {...props}
    />
  );
}
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]",
        className,
      )}
      {...props}
    />
  );
}
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-[13px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-3.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--subtle)] focus:border-[color-mix(in_srgb,var(--primary)_42%,var(--border))] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]",
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
        "h-12 w-full rounded-[13px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-3.5 text-sm outline-none focus:border-[color-mix(in_srgb,var(--primary)_42%,var(--border))] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]",
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
  return (
    <label className="grid gap-1.5 text-[11px] font-semibold">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {action}
      </span>
      {children}
      {hint && !error ? (
        <span className="text-[10px] font-medium leading-relaxed text-[var(--muted-foreground)]">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
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
        "inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide",
        tone === "neutral" && "bg-[var(--muted)] text-[var(--muted-foreground)]",
        tone === "success" && "bg-[var(--mint)] text-[var(--primary)]",
        tone === "warning" && "bg-[var(--gold-soft)] text-[#80570d]",
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
        "min-h-[96px] w-full rounded-[13px] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-2)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--subtle)] focus:border-[color-mix(in_srgb,var(--primary)_42%,var(--border))] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_12%,transparent)]",
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
        "relative inline-flex h-6 w-[42px] shrink-0 rounded-full transition",
        checked ? "bg-[var(--primary)]" : "bg-[var(--muted)]",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[18px] rounded-full bg-[var(--surface)] shadow-[0_1px_6px_rgba(0,0,0,.18)] transition-[left]",
          checked ? "left-[21px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
