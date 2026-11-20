"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Database, FolderOpen, MapPin, MessageSquareText } from "lucide-react";

import { useGuide } from "@/components/guide/guide-provider";
import type { GuideKey } from "@/components/guide/guide-content";

const ENTRIES: {
  href?: string;
  guide?: GuideKey;
  label: string;
  description: string;
  icon: typeof MessageSquareText;
}[] = [
  {
    guide: "how",
    label: "工作原理",
    description: "一次只问一个问题，用大白话把你的情况理成事实。",
    icon: MessageSquareText,
  },
  {
    guide: "scope",
    label: "服务范围",
    description: "河南 18 个地级市，县区级可以逐级选择。",
    icon: MapPin,
  },
  {
    guide: "sources",
    label: "官方来源",
    description: "法律条文和办事规则都附官方原文，可以自己核对。",
    icon: Database,
  },
  {
    href: "/cases",
    label: "我的案件",
    description: "回到你已经聊过的咨询，接着往下看。",
    icon: FolderOpen,
  },
];

export function NavGallery() {
  const { openGuide } = useGuide();
  const [open, setOpen] = React.useState(0);

  const activate = (entry: (typeof ENTRIES)[number]) => {
    if (entry.guide) openGuide(entry.guide);
  };

  return (
    <section aria-label="快速入口" className="relative py-10 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-16 h-56 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(205,82,68,0.07),transparent_72%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="nav-gallery hidden sm:flex" onMouseLeave={() => setOpen(0)}>
          {ENTRIES.map((entry, index) => {
            const Icon = entry.icon;
            const active = open === index;
            const content = (
              <>
                <span className="nav-gallery__icon">
                  <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="nav-gallery__text">
                  <span className="nav-gallery__label">{entry.label}</span>
                  <span className="nav-gallery__desc">{entry.description}</span>
                </span>
                <span className="nav-gallery__cta" aria-hidden="true">
                  打开看看
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </>
            );
            const shared = {
              className: "nav-gallery__panel text-left",
              "data-open": active ? "true" : "false",
              style: { flexGrow: active ? 2.6 : 1 },
              onMouseEnter: () => setOpen(index),
              onFocus: () => setOpen(index),
            } as const;
            return entry.guide ? (
              <button key={entry.label} type="button" {...shared} onClick={() => activate(entry)}>
                {content}
              </button>
            ) : (
              <Link key={entry.label} href={entry.href ?? "/cases"} {...shared}>
                {content}
              </Link>
            );
          })}
        </div>

        <ul className="space-y-2 sm:hidden" role="list">
          {ENTRIES.map((entry) => {
            const Icon = entry.icon;
            const content = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-[#fff5ec]">
                  <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-bold text-ink-900">{entry.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-500">{entry.description}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
              </>
            );
            const className =
              "flex w-full items-center gap-3 rounded-2xl border border-ink-200/80 bg-white/80 px-4 py-3 shadow-card transition active:scale-[0.99]";
            return (
              <li key={entry.label}>
                {entry.guide ? (
                  <button type="button" onClick={() => activate(entry)} className={className}>
                    {content}
                  </button>
                ) : (
                  <Link href={entry.href ?? "/cases"} className={className}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
