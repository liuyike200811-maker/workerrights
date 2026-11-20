"use client";

import { Check } from "lucide-react";

import { PressRipples, pressClass, usePressFeedback } from "@/components/ui/press-feedback";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  const press = usePressFeedback();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "border-brand-300 bg-brand-50/70" : "border-ink-200 bg-white hover:border-ink-300",
        pressClass(press),
        className,
      )}
      onPointerDown={press.handlers.onPointerDown}
      onPointerUp={press.handlers.onPointerUp}
      onPointerCancel={press.handlers.onPointerCancel}
      onPointerLeave={press.handlers.onPointerLeave}
      onAnimationEnd={press.onAnimationEnd}
    >
      <PressRipples ripples={press.ripples} onDone={press.removeRipple} />
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
          checked ? "border-brand-700 bg-brand-800 text-white" : "border-ink-300 bg-white text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{description}</span>}
      </span>
    </button>
  );
}
