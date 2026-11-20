"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { PressRipples, pressClass, usePressFeedback } from "@/components/ui/press-feedback";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand-900 text-white shadow-sm hover:bg-brand-800",
        secondary: "bg-brand-50 text-brand-900 hover:bg-brand-100",
        outline: "border border-ink-200 bg-white text-ink-800 hover:border-brand-300 hover:bg-brand-50/50",
        ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        accent: "bg-accent-500 text-white hover:bg-accent-600",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-2xl px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      type = "button",
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onAnimationEnd,
      children,
      ...props
    },
    ref,
  ) => {
    const press = usePressFeedback();
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), pressClass(press), className)}
        onPointerDown={(event) => {
          press.handlers.onPointerDown(event);
          onPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          press.handlers.onPointerUp();
          onPointerUp?.(event);
        }}
        onPointerCancel={(event) => {
          press.handlers.onPointerCancel();
          onPointerCancel?.(event);
        }}
        onPointerLeave={(event) => {
          press.handlers.onPointerLeave();
          onPointerLeave?.(event);
        }}
        onAnimationEnd={(event) => {
          press.onAnimationEnd(event);
          onAnimationEnd?.(event);
        }}
        {...props}
      >
        <PressRipples ripples={press.ripples} onDone={press.removeRipple} />
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";