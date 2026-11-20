"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

import ScrollStack from "@/components/home/scroll-stack";
import { GUIDE_MODULES, GuideCard, type GuideKey } from "@/components/guide/guide-content";

interface GuideApi {
  openGuide: (key: GuideKey) => void;
}

const GuideContext = React.createContext<GuideApi | null>(null);

export function useGuide(): GuideApi {
  const context = React.useContext(GuideContext);
  if (!context) throw new Error("useGuide must be used within GuideProvider");
  return context;
}

const HASH_TO_MODULE: Record<string, GuideKey> = {
  "#how": "how",
  "#scope": "scope",
  "#sources": "sources",
};

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<{ key: GuideKey; id: number } | null>(null);

  const openGuide = React.useCallback((key: GuideKey) => {
    setSession((previous) => ({ key, id: (previous?.id ?? 0) + 1 }));
  }, []);

  const close = React.useCallback(() => setSession(null), []);

  React.useEffect(() => {
    const key = HASH_TO_MODULE[window.location.hash];
    if (!key) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setSession({ key, id: 1 });
  }, []);

  return (
    <GuideContext.Provider value={{ openGuide }}>
      {children}
      {session && <GuideDialog key={session.id} initial={session.key} onClose={close} />}
    </GuideContext.Provider>
  );
}

function GuideDialog({ initial, onClose }: { initial: GuideKey; onClose: () => void }) {
  const [active, setActive] = React.useState<GuideKey>(initial);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const getRoot = () => stageRef.current?.querySelector<HTMLElement>(".scroll-stack") ?? null;

  const jumpTo = React.useCallback((key: GuideKey, instant = false) => {
    setActive(key);
    const root = getRoot();
    const card = root?.querySelector<HTMLElement>(`#guide-${key}`);
    if (!root || !card) return;
    const index = GUIDE_MODULES.findIndex((module) => module.key === key);
    let flow = 0;
    let node: HTMLElement | null = card;
    while (node && node !== root) {
      flow += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({
      top: Math.max(0, flow - 16 - index * 18),
      behavior: instant || reduce ? "auto" : "smooth",
    });
  }, []);

  React.useEffect(() => {
    if (initial !== "how") jumpTo(initial, true);
  }, [initial, jumpTo]);

  React.useEffect(() => {
    const root = getRoot();
    if (!root) return undefined;
    const cards = GUIDE_MODULES.map((module) =>
      root.querySelector<HTMLElement>(`#guide-${module.key}`),
    ).filter((card): card is HTMLElement => Boolean(card));
    let frame = 0;
    const read = () => {
      frame = 0;
      const rootTop = root.getBoundingClientRect().top;
      let next = 0;
      cards.forEach((card, index) => {
        if (card.getBoundingClientRect().top - rootTop <= 16 + index * 18 + 10) next = index;
      });
      setActive(GUIDE_MODULES[next].key);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center sm:p-6">
      <div
        className="guide-overlay absolute inset-0 bg-[#1b0a08]/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-dialog-title"
        className="guide-dialog relative flex h-[100dvh] w-full flex-col overflow-hidden outline-none sm:h-[min(88dvh,840px)] sm:max-w-4xl sm:rounded-[30px]"
      >
        <div className="guide-dialog__glow" aria-hidden="true" />

        <h2 id="guide-dialog-title" className="sr-only">看清它怎么帮你</h2>

        <header className="relative z-10 flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">
              三张卡片 · 一件事
            </p>
            <p className="mt-1 text-xl font-black tracking-tight text-ink-900 sm:text-2xl">看清它怎么帮你</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-200/80 bg-white/70 text-ink-500 transition hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="guide-tabs relative z-10" role="tablist" aria-label="三个模块">
          {GUIDE_MODULES.map((module, index) => (
            <button
              key={module.key}
              type="button"
              role="tab"
              aria-selected={active === module.key}
              aria-controls={`guide-${module.key}`}
              data-active={active === module.key ? "true" : "false"}
              onClick={() => jumpTo(module.key)}
              className="guide-tab"
            >
              <span className="guide-tab__num">0{index + 1}</span>
              {module.label}
            </button>
          ))}
        </div>

        <div ref={stageRef} className="relative z-10 min-h-0 flex-1">
          <ScrollStack
            useWindowScroll={false}
            stackPosition={16}
            itemDistance={140}
            itemStackDistance={18}
            itemScale={0.04}
            baseScale={0.9}
            dimAmount={0.3}
            blurAmount={0.4}
            tiltAmount={2}
            rotationAmount={0.4}
            holdDistance={120}
            smoothScroll={false}
            className="guide-dialog__stack"
          >
            {GUIDE_MODULES.map((module) => (
              <GuideCard key={module.key} module={module.key} />
            ))}
          </ScrollStack>
        </div>

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-ink-200/60 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] text-[11px] text-ink-500 sm:px-7">
          <span className="sm:hidden">上下滚动切换卡片，仅供参考。</span>
          <span className="hidden sm:inline">上下滚动切换卡片，内容仅供参考，不构成正式法律意见。</span>
          <Link
            href="/cases"
            onClick={onClose}
            className="inline-flex items-center gap-1 font-semibold text-brand-800 hover:underline"
          >
            去我的案件
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
