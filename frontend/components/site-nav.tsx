"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Database, FolderOpen, MapPin, Menu, MessageSquareText, X } from "lucide-react";

import { useGuide } from "@/components/guide/guide-provider";
import type { GuideKey } from "@/components/guide/guide-content";
import { cn } from "@/lib/utils";

const NAV_ITEMS: {
  href?: string;
  guide?: GuideKey;
  label: string;
  description: string;
  icon: typeof MessageSquareText;
}[] = [
  {
    guide: "how",
    label: "工作原理",
    description: "四步问清情况，再给依据",
    icon: MessageSquareText,
  },
  {
    guide: "scope",
    label: "服务范围",
    description: "河南 18 个地级市",
    icon: MapPin,
  },
  {
    guide: "sources",
    label: "官方来源",
    description: "每条结论都能查原文",
    icon: Database,
  },
  {
    href: "/cases",
    label: "我的案件",
    description: "回到正在处理的咨询",
    icon: FolderOpen,
  },
];

export function SiteNav() {
  const { openGuide } = useGuide();
  const [open, setOpen] = React.useState(0);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const sheetRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!sheetOpen) return undefined;
    const onDown = (event: PointerEvent) => {
      if (!sheetRef.current?.contains(event.target as Node)) setSheetOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  const activate = (item: (typeof NAV_ITEMS)[number]) => {
    setSheetOpen(false);
    if (item.guide) openGuide(item.guide);
  };

  return (
    <>
      <nav aria-label="主导航" className="hidden shrink-0 lg:mx-auto lg:block">
        <ul
          className="nav-fold"
          role="list"
          onMouseLeave={() => setOpen(0)}
        >
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const active = open === index;
            const content = (
              <>
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                <span className="nav-fold__label">{item.label}</span>
              </>
            );
            return (
              <li key={item.label} className="nav-fold__item" style={{ flexGrow: active ? 1.35 : 1 }}>
                {item.guide ? (
                  <button
                    type="button"
                    className="nav-fold__link"
                    data-open={active ? "true" : "false"}
                    onMouseEnter={() => setOpen(index)}
                    onFocus={() => setOpen(index)}
                    onClick={() => activate(item)}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    href={item.href ?? "/cases"}
                    className="nav-fold__link"
                    data-open={active ? "true" : "false"}
                    onMouseEnter={() => setOpen(index)}
                    onFocus={() => setOpen(index)}
                    onClick={() => setSheetOpen(false)}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div ref={sheetRef} className="relative ml-auto lg:ml-0 lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen((value) => !value)}
          aria-expanded={sheetOpen}
          aria-controls="mobile-nav"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-full border border-ink-200 bg-white/80 px-3.5 text-sm font-semibold text-ink-700 transition",
            "hover:border-brand-200 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            sheetOpen && "border-brand-200 bg-brand-50 text-brand-900",
          )}
        >
          {sheetOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          <span className="hidden min-[400px]:inline">导航</span>
        </button>
        {sheetOpen && (
          <div
            id="mobile-nav"
            className="fixed right-4 top-[72px] z-50 w-[min(288px,calc(100vw-2rem))] rounded-2xl border border-ink-200/80 bg-[#fffaf6] p-2 shadow-lift"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800 transition group-hover:bg-brand-800 group-hover:text-[#fff8f2]">
                    <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="flex items-center gap-1 text-sm font-semibold text-ink-900">
                      {item.label}
                      <ArrowUpRight className="h-3 w-3 text-ink-300 transition group-hover:text-brand-700" aria-hidden="true" />
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-500">{item.description}</span>
                  </span>
                </>
              );
              const className =
                "group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
              return item.guide ? (
                <button key={item.label} type="button" onClick={() => activate(item)} className={className}>
                  {content}
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href ?? "/cases"}
                  onClick={() => setSheetOpen(false)}
                  className={className}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
