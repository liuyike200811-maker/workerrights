"use client";

import { StartCaseButton } from "@/components/home/start-actions";
import { BrandLogo } from "@/components/brand-logo";
import { SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLogo />
        <SiteNav />
        <div className="flex items-center gap-2">
          <StartCaseButton size="sm" showArrow className="[&>button]:h-10 [&>button]:px-4">
            开始咨询
          </StartCaseButton>
        </div>
      </div>
    </header>
  );
}
