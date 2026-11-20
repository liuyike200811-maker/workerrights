"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Phone,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useCase } from "@/components/case/case-provider";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PressLink, PressRipples, pressClass, usePressFeedback } from "@/components/ui/press-feedback";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/services/api";
import type { ActionPlanResponse, ActionStep, CaseFacts, ChannelInfo } from "@/types/api";
import { groupSteps } from "@/lib/action-groups";
import { periodNeedsDates, periodValue } from "@/lib/facts";
import { cn, channelCategoryLabel, entryLink, verificationLabel } from "@/lib/utils";

export default function ActionPlanPage() {
  const { caseId, caseData } = useCase();
  const [plan, setPlan] = React.useState<ActionPlanResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [pendingStep, setPendingStep] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState<"docx" | "pdf" | null>(null);
  const [actionError, setActionError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getActionPlan(caseId)
      .then((data) => {
        if (active) setPlan(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "无法生成行动指南。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [caseId]);

  const toggleStep = async (step: ActionStep) => {
    if (pendingStep) return;
    setPendingStep(step.id);
    setActionError("");
    try {
      const updated = await api.updateStep(caseId, step.id, !step.done);
      setPlan(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "更新步骤状态失败。");
    } finally {
      setPendingStep(null);
    }
  };

  const download = async (format: "docx" | "pdf") => {
    setExporting(format);
    setActionError("");
    try {
      await api.downloadExport(caseId, format);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "导出失败。");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="正在规划维权步骤和渠道…" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <Alert variant="danger" title="无法生成行动指南">
        {error || "请稍后重试。"}
      </Alert>
    );
  }

  const channelsById = new Map(plan.channels.map((channel) => [channel.id, channel]));
  const primary = channelsById.get(plan.primary_channel_id);
  const groups = groupSteps(plan.steps, plan.channels);
  const facts: CaseFacts = caseData?.facts || {};

  return (
    <div className="space-y-4">
      {plan.preliminary && (
        <Alert
          variant="warning"
          title="案件信息尚未确认"
          action={
            <Link href={`/case/${caseId}`} className="shrink-0 text-xs font-semibold text-amber-900 underline">
              返回对话
            </Link>
          }
        >
          {plan.preliminary_note}
        </Alert>
      )}
      {actionError && <Alert variant="danger">{actionError}</Alert>}

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dark">维权行动指南</Badge>
                <Badge variant="success">{plan.progress.done}/{plan.progress.total} 步已完成</Badge>
                {plan.preliminary ? <Badge variant="warning">初步版本</Badge> : null}
              </div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-ink-900 sm:text-2xl">
                建议优先做，顺序可以按你的实际情况调整
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500">
                先把证据和金额整理清楚，再向劳动保障监察和全国欠薪线索平台反映；仲裁、法律援助、诉讼是否要走，
                取决于你的具体事实，由受理机构判断。勾选步骤后会自动保存，下次进入可以继续。
              </p>
              <div className="mt-4 flex max-w-md items-center gap-3">
                <Progress value={plan.progress.percent} className="h-2 flex-1" />
                <span className="text-xs font-bold text-brand-900">{plan.progress.percent}%</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => download("docx")} disabled={Boolean(exporting)}>
                {exporting === "docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                DOCX
              </Button>
              <Button variant="outline" size="sm" onClick={() => download("pdf")} disabled={Boolean(exporting)}>
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </Button>
              <PressLink href={`/case/${caseId}/form-assistant`} className={cn(buttonVariants({ size: "sm" }), "h-9")}>
                材料整理参考
                <ArrowRight className="h-3.5 w-3.5" />
              </PressLink>
            </div>
          </div>
        </CardContent>
      </Card>

      {primary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 sm:col-span-2 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">建议先了解</p>
                <p className="mt-1 text-base font-bold text-brand-950">{primary.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-950/75">{primary.reason}</p>
              </div>
              <Landmark className="h-5 w-5 shrink-0 text-brand-700" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {primary.official_url && (
                <a
                  href={primary.official_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {entryLink(primary.verification_status, primary.name).label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <span className="text-[10px] leading-relaxed text-brand-950/70">
                {entryLink(primary.verification_status, primary.name).hint}
              </span>
              <span className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs text-brand-800">
                可先打 12333 问该找哪个受理机构
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">正式事实陈述</p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-600">{plan.formal_statement}</p>
            {periodNeedsDates(facts) && (
              <p className="mt-2 text-[10px] leading-relaxed text-amber-700">
                陈述里的工作时间是「{periodValue(facts)}」，还没有具体起止日期。正式提交前请先补上，或按官方页面要求填。
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={plan.formal_statement} label="复制陈述" />
              <Link
                href={`/case/${caseId}/form-assistant`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-800 hover:underline"
              >
                看字段整理参考
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.id} className="space-y-3">
            <div className="rounded-xl border border-ink-200 bg-white px-4 py-3">
              <h3 className="text-sm font-bold text-ink-900">{group.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{group.description}</p>
            </div>
          {group.steps.map((step) => {
            const channel = step.channel_id ? channelsById.get(step.channel_id) : null;
            return (
              <Card
                key={step.id}
                className={cn("overflow-hidden transition", step.done && "border-emerald-200 bg-emerald-50/30")}
              >
                <div className="flex gap-3 p-4 sm:gap-5 sm:p-5">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black",
                        step.done ? "bg-emerald-700 text-white" : "bg-brand-900 text-white",
                      )}
                    >
                      {step.done ? <Check className="h-4 w-4" strokeWidth={3} /> : step.position}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className={cn("text-base font-bold leading-snug", step.done ? "text-emerald-900" : "text-ink-900")}>
                          {step.title}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{step.why}</p>
                      </div>
                      <StepToggle step={step} pending={pendingStep === step.id} onToggle={() => toggleStep(step)} />
                    </div>

                    <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">需要准备</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {step.prepare.map((item) => (
                          <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-ink-600">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {step.draft_text && (
                      <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700">可复制沟通话术</p>
                          <CopyButton text={step.draft_text} label="复制话术" compact />
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-brand-950/80">
                          {step.draft_text}
                        </p>
                      </div>
                    )}

                    {(step.deadline_note || step.risk_note) && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {step.deadline_note && (
                          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-900">
                            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {step.deadline_note}
                          </div>
                        )}
                        {step.risk_note && (
                          <div className="flex gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[10px] leading-relaxed text-ink-500">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                            {step.risk_note}
                          </div>
                        )}
                      </div>
                    )}

                    {channel && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-800">
                          <Phone className="h-3 w-3" />
                          {channel.name}
                        </span>
                        {channel.official_url && (
                          <a
                            href={channel.official_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            title={entryLink(channel.verification_status, channel.name).hint}
                            className="inline-flex items-center gap-1 text-ink-500 hover:text-brand-800"
                          >
                            {entryLink(channel.verification_status, channel.name).label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-700" />
              <CardTitle>时效与风险</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.deadlines.map((deadline) => (
              <div key={deadline.title} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-amber-950">{deadline.title}</p>
                  <Badge variant="warning">{deadline.urgency}</Badge>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-900/80">{deadline.detail}</p>
              </div>
            ))}
            <ul className="space-y-2">
              {plan.risks.map((risk) => (
                <li key={risk} className="flex gap-2 text-[11px] leading-relaxed text-ink-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  {risk}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-brand-700" />
              <CardTitle>推荐渠道</CardTitle>
            </div>
            <p className="text-xs text-ink-400">不同渠道可并行准备材料，具体受理以官方告知为准。</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {plan.channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl bg-brand-950 p-5 text-white sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-200">
              <Sparkles className="h-3.5 w-3.5" />
              下一步：整理要交给官方的材料
            </p>
            <h3 className="mt-1 text-lg font-bold">不用自己组织语言，逐字段给你参考内容</h3>
            <p className="mt-1 text-xs leading-relaxed text-brand-200">
              本产品不会自动提交。材料整理好后，请由你本人在官方平台逐项填写、核对并提交。
            </p>
          </div>
          <Link
            href={`/case/${caseId}/form-assistant`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-950"
          >
            <FileText className="h-4 w-4" />
            打开材料整理参考
          </Link>
        </div>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-ink-400">{plan.disclaimer}</p>
    </div>
  );
}

function ChannelCard({ channel }: { channel: ChannelInfo }) {
  return (
    <div className={cn("rounded-xl border p-3.5", channel.recommended ? "border-brand-200 bg-brand-50/50" : "border-ink-200")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-ink-900">{channel.name}</p>
          <p className="mt-0.5 text-[10px] text-ink-400">{channelCategoryLabel(channel.category)}</p>
        </div>
        <Badge variant={channel.recommended ? "success" : channel.verification_status === "pending" ? "warning" : "neutral"}>
          {channel.recommended
            ? "推荐"
            : channel.verification_status === "transcribed"
              ? "来源待核验"
              : verificationLabel(channel.verification_status)}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{channel.description}</p>
      {channel.reason && <p className="mt-1.5 text-[10px] leading-relaxed text-brand-800">{channel.reason}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {channel.official_url && (
          <a
            href={channel.official_url}
            target="_blank"
            rel="noreferrer noopener"
            title={entryLink(channel.verification_status, channel.name).hint}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-800 hover:underline"
          >
            {entryLink(channel.verification_status, channel.name).label}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {channel.access_note && (
          <span className="text-[10px] leading-relaxed text-ink-400">{channel.access_note}</span>
        )}
      </div>
    </div>
  );
}

function StepToggle({
  step,
  pending,
  onToggle,
}: {
  step: ActionStep;
  pending: boolean;
  onToggle: () => void;
}) {
  const press = usePressFeedback();
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
        step.done
          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
          : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-800",
        pressClass(press),
      )}
      onPointerDown={press.handlers.onPointerDown}
      onPointerUp={press.handlers.onPointerUp}
      onPointerCancel={press.handlers.onPointerCancel}
      onPointerLeave={press.handlers.onPointerLeave}
      onAnimationEnd={press.onAnimationEnd}
    >
      <PressRipples ripples={press.ripples} onDone={press.removeRipple} />
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : step.done ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <span className="h-3.5 w-3.5 rounded border border-ink-300" />
      )}
      {step.done ? "已完成" : "标记完成"}
    </button>
  );
}
