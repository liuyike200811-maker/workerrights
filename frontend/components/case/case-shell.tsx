"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  FileText,
  FolderOpen,
  MessageSquareText,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { useCase } from "@/components/case/case-provider";
import { StartCaseButton } from "@/components/home/start-actions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { intakeStage } from "@/lib/intake-progress";
import { cn, statusLabel } from "@/lib/utils";

const tabs = [
  { href: "", label: "对话", icon: MessageSquareText },
  { href: "/analysis", label: "案件分析", icon: ClipboardList },
  { href: "/action-plan", label: "行动指南", icon: Route },
  { href: "/form-assistant", label: "填报参考", icon: FileText },
];

export function CaseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { caseId, caseData, loading, error, meta } = useCase();
  const base = `/case/${caseId}`;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <Spinner label="正在读取案件…" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-transparent px-6 text-center">
        <BrandLogo />
        <h1 className="mt-4 text-xl font-bold text-ink-900">无法打开这个案件</h1>
        <p className="max-w-md text-sm leading-relaxed text-ink-500">
          {error || "案件不存在或无权访问。案件只对创建它的本浏览器会话可见。"}
        </p>
        <div className="flex gap-3">
          <Link href="/cases" className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700">
            查看我的案件
          </Link>
          <Link href="/" className="rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-medium text-white">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const stage = intakeStage(caseData.progress, caseData.intake, caseData.messages, caseData.status);

  return (
    <div className="min-h-screen bg-transparent pb-24 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo compact className="hidden sm:inline-flex" />
              <span className="hidden h-6 w-px bg-ink-200 sm:block" />
              <Link
                href="/cases"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">我的案件</span>
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-bold text-ink-900 sm:text-base">{caseData.title}</h1>
                  {caseData.is_demo && <Badge variant="warning">虚构演示</Badge>}
                </div>
                <p className="mt-0.5 hidden text-[11px] text-ink-400 sm:block">
                  {statusLabel(caseData.status)} · {stage.headline}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/cases"
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-ink-600 transition hover:bg-ink-100 sm:flex"
              >
                <FolderOpen className="h-4 w-4" />
                案件列表
              </Link>
              <StartCaseButton
                variant="outline"
                size="sm"
                showArrow={false}
                className="[&>button]:h-9 [&>button]:px-3 [&>button]:text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </StartCaseButton>
            </div>
          </div>

          <div className="flex items-center gap-3 pb-3">
            <div className="flex flex-1 items-center gap-2">
              <Progress value={stage.barValue} className="h-1.5 max-w-xs" />
              <span className="hidden text-[10px] font-medium text-ink-400 sm:inline">
                核心事实 {stage.core.done}/{stage.core.total}
                {stage.optional.total ? ` · 可选 ${stage.optional.done}/${stage.optional.total}` : ""}
              </span>
            </div>
            {stage.confirmed ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                信息已确认
              </span>
            ) : stage.fullButUnconfirmed ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" />
                尚未确认
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-500">
                <Sparkles className="h-3.5 w-3.5" />
                正在补充信息
              </span>
            )}
          </div>

          <nav className="no-scrollbar -mb-px flex gap-1 overflow-x-auto" aria-label="案件工作台导航">
            {tabs.map((tab) => {
              const href = `${base}${tab.href}`;
              const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-semibold transition sm:px-4 sm:text-sm",
                    active
                      ? "border-brand-800 text-brand-900"
                      : "border-transparent text-ink-500 hover:text-ink-900",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {caseData.is_demo && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-[11px] leading-relaxed text-amber-900 sm:px-6">
            <span className="shrink-0 font-bold">虚构演示：</span>
            本案件人物、项目、公司名称均为虚构，仅用于体验产品和交互流程，不代表真实案例。
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-[11px] leading-relaxed text-ink-400 sm:px-6">
        {meta?.provider.display_name ?? "本地规则引擎（演示）"} · 法律资料以官方原文为准 ·
        本产品不构成正式法律意见，不自动向政府平台提交。
      </footer>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 px-2 pt-1.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map((tab) => {
            const href = `${base}${tab.href}`;
            const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={href}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium transition",
                  active ? "text-brand-900" : "text-ink-400",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-brand-800")} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
