"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface PressRippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

// 按压缩放、松手弹簧回弹、波纹从手指落点扩散，按钮共用这一套反馈。
export function usePressFeedback() {
  const [pressed, setPressed] = React.useState(false);
  const [spring, setSpring] = React.useState(false);
  const [ripples, setRipples] = React.useState<PressRippleItem[]>([]);
  const pressedRef = React.useRef(false);
  const idRef = React.useRef(0);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // 直径取落点到最远角的距离，保证波纹能铺满整个按钮。
    const size = 2 * Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
    idRef.current += 1;
    setRipples((current) => [...current.slice(-3), { id: idRef.current, x, y, size }]);
    pressedRef.current = true;
    setPressed(true);
    setSpring(false);
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setPressed(false);
    setSpring(true);
  };

  const cancel = () => {
    pressedRef.current = false;
    setPressed(false);
    setSpring(false);
  };

  return {
    pressed,
    spring,
    ripples,
    handlers: {
      onPointerDown,
      onPointerUp: release,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
    },
    onAnimationEnd: (event: React.AnimationEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) setSpring(false);
    },
    removeRipple: (id: number) => setRipples((current) => current.filter((item) => item.id !== id)),
  };
}

export function pressClass(press: { pressed: boolean; spring: boolean }, className?: string) {
  return cn("pressable", press.pressed && "press-down", press.spring && "press-spring", className);
}

export function PressRipples({
  ripples,
  onDone,
}: {
  ripples: PressRippleItem[];
  onDone: (id: number) => void;
}) {
  return ripples.map((ripple) => (
    <span
      key={ripple.id}
      aria-hidden="true"
      className="press-ripple"
      style={{
        left: ripple.x - ripple.size / 2,
        top: ripple.y - ripple.size / 2,
        width: ripple.size,
        height: ripple.size,
      }}
      onAnimationEnd={() => onDone(ripple.id)}
    />
  ));
}
// 外观是按钮的链接也按按钮反馈，否则同一个页面里两种手感。
export const PressLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof Link>
>(function PressLink(
  { className, children, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, onAnimationEnd, ...props },
  ref,
) {
  const press = usePressFeedback();
  return (
    <Link
      ref={ref}
      className={pressClass(press, className as string | undefined)}
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
    </Link>
  );
});
