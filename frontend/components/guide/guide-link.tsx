"use client";

import * as React from "react";

import { useGuide } from "@/components/guide/guide-provider";
import type { GuideKey } from "@/components/guide/guide-content";
import { cn } from "@/lib/utils";

export function GuideLink({
  module,
  className,
  children,
}: {
  module: GuideKey;
  className?: string;
  children: React.ReactNode;
}) {
  const { openGuide } = useGuide();
  return (
    <button
      type="button"
      onClick={() => openGuide(module)}
      className={cn("text-left transition hover:text-brand-800", className)}
    >
      {children}
    </button>
  );
}
