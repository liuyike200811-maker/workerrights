"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Upload,
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
import type { CaseFacts, FormAssistantResponse, FormField } from "@/types/api";
import { contractRowNote, evidenceRowState, periodNeedsDates, periodValue } from "@/lib/facts";
import { cn, entryLink } from "@/lib/utils";

const statusStyle: Record<FormField["status"], { label: string; variant: "success" | "warning" | "accent" | "neutral" }> = {
  ready: { label: "可填写", variant: "success" },
  missing: { label: "待补充", variant: "warning" },
  verify: { label: "需核对", variant: "accent" },
  official_only: { label: "仅官方填写", variant: "neutral" },
};

// 后端目前把"约三个月"这类时长直接放进起止日期字段，复制过去会填成假日期。
function durationAsDateRisk(field: FormField): boolean {
  return field.key === "work_period" && Boolean(field.value) && !field.value!.includes("至");
}

export default function FormAssistantPage() {
  const { caseId, caseData } = useCase();
  const [data, setData] = React.useState<FormAssistantResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [activeStep, setActiveStep] = React.useState(0);
  const [exporting, setExporting] = React.useState<"docx" | "pdf" | null>(null);
  const [actionError, setActionError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getFormAssistant(caseId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "无法生成材料整理参考。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [caseId]);

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
        <Spinner label="正在整理要交给官方的材料参考…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="danger" title="无法生成材料整理参考">
        {error || "请稍后重试。"}
      </Alert>
    );
  }

  const step = data.steps[activeStep];
  const facts: CaseFacts = caseData?.facts || {};
  const readyFields = data.steps.reduce(
    (sum, item) =>
      sum + item.fields.filter((field) => field.status === "ready" || field.status === "official_only").length,
    0,
  );

  return (
    <div className="space-y-4">
      {data.preliminary && (
        <Alert
          variant="warning"
          title="案件信息尚未确认"
          action={
            <Link href={`/case/${caseId}`} className="shrink-0 text-xs font-semibold text-amber-900 underline">
              返回对话
            </Link>
          }
        >
          {data.preliminary_note}
        </Alert>
      )}
      {actionError && <Alert variant="danger">{actionError}</Alert>}

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dark">欠薪材料整理参考</Badge>
                <Badge variant="neutral">{data.platform.name}</Badge>
                <Badge variant="warning">
                  字段结构与顺序待核验
                </Badge>
              </div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-ink-900 sm:text-2xl">
                逐字段给你解释和参考内容，你本人核对后提交
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500">
                这里按材料类别分组整理，不代表官方页面的字段名称和先后顺序。
                每个字段都说明“是什么意思、该填什么、你现在有什么、还缺什么”。
                本产品不会自动登录或代替你提交。
              </p>
              <div className="mt-4 flex max-w-md items-center gap-3">
                <Progress value={data.progress.percent} className="h-2 flex-1" />
                <span className="text-xs font-bold text-brand-900">
                  {readyFields}/{data.progress.total} 字段可用
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={data.copy_summary} label="复制全部字段参考" />
              <Button variant="outline" size="sm" onClick={() => download("docx")} disabled={Boolean(exporting)}>
                {exporting === "docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                DOCX
              </Button>
              <Button variant="outline" size="sm" onClick={() => download("pdf")} disabled={Boolean(exporting)}>
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-ink-200 bg-white p-2 shadow-card lg:flex-col lg:gap-1">
            {data.steps.map((item, index) => {
              const ready = item.fields.filter(
                (field) => field.status === "ready" || field.status === "official_only",
              ).length;
              return (
                <StepTab
                  key={item.id}
                  index={index}
                  title={item.title}
                  fieldCount={item.fields.length}
                  ready={ready}
                  active={activeStep === index}
                  onClick={() => setActiveStep(index)}
                />
              );
            })}
          </div>

          <div className="hidden rounded-2xl border border-ink-200 bg-white p-4 shadow-card lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-800">
              <ShieldCheck className="h-4 w-4 text-brand-700" />
              隐私提醒
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-500">{data.privacy_notice}</p>
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 py-2 text-[10px] text-ink-500">
              <LockKeyhole className="h-3.5 w-3.5" />
              本产品不收集身份证号
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">
                    整理顺序 第 {activeStep + 1} 组 / 共 {data.steps.length} 组（参考，非官方顺序）
                  </p>
                  <CardTitle className="mt-1">{step.title}</CardTitle>
                </div>
                <Badge variant="default">{step.fields.length ? `${step.fields.length} 个字段` : "操作指引"}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-ink-500">{step.goal}</p>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-brand-900">
                  <Info className="h-3.5 w-3.5" />
                  这一步要注意
                </p>
                <ul className="mt-2 space-y-1.5">
                  {step.tips.map((tip) => (
                    <li key={tip} className="flex gap-2 text-[11px] leading-relaxed text-brand-950/80">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-600" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {step.fields.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {step.fields.map((field) => (
                    <FormFieldCard key={field.key} field={field} />
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  {activeStep === 0 && (
                    <div className="rounded-xl border border-ink-200 p-4">
                      <p className="text-sm font-semibold text-ink-900">从官方平台进入</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">{data.platform.access_note}</p>
                      <PressLink
                        href={data.platform.official_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={cn(buttonVariants({ size: "sm" }), "mt-3 h-9")}
                      >
                        {entryLink(data.platform.verification_status, data.platform.name).label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </PressLink>
                      <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
                        {entryLink(data.platform.verification_status, data.platform.name).hint}
                      </p>
                      <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
                        {data.platform.source_note}
                      </p>
                    </div>
                  )}
                  {activeStep === data.steps.length - 1 && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                          <ClipboardCheck className="h-4 w-4" />
                          提交前最后核对
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-emerald-950/80">
                          {[
                            "姓名、手机号和身份证号由你本人在官方平台填写",
                            "项目所在地、项目名称和欠薪金额已核对",
                            "证据图片清晰，能打开，且没有发给陌生人",
                            "保存提交成功页面、查询码或受理编号",
                          ].map((item) => (
                            <li key={item} className="flex gap-1.5">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-ink-200 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink-900">全部字段参考</p>
                          <CopyButton text={data.copy_summary} label="复制全部" />
                        </div>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-600">
                          {data.copy_summary}
                        </pre>
                        {periodNeedsDates(facts) && (
                          <p className="mt-2 text-[10px] leading-relaxed text-amber-800">
                            其中「工作时间」目前只有时长，官方表单要日期时请自己补具体起止日期。
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((index) => Math.max(0, index - 1))}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  上一步
                </Button>
                {activeStep < data.steps.length - 1 ? (
                  <Button size="sm" onClick={() => setActiveStep((index) => Math.min(data.steps.length - 1, index + 1))}>
                    下一步
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <PressLink href={`/case/${caseId}/action-plan`} className={cn(buttonVariants({ size: "sm" }), "h-9")}>
                    回到行动指南
                    <ArrowRight className="h-3.5 w-3.5" />
                  </PressLink>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-700" />
                  <CardTitle>正式事实陈述</CardTitle>
                </div>
                <CopyButton text={data.formal_statement} label="复制陈述" />
              </div>
              <p className="text-xs text-ink-400">
                用语更正式，可用于投诉、仲裁或书面沟通。带【】的内容需要你补充。
              </p>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-xl border border-ink-200 bg-ink-50/60 p-4 text-xs leading-6 text-ink-700">
                {data.formal_statement}
              </div>
              {periodNeedsDates(facts) && (
                <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  陈述中的工作时间写的是「{periodValue(facts)}」。官方表单要填起止日期时，请按你的记录补上具体日期，不要把这个时长当日期填进去。
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-brand-700" />
                <CardTitle>证据目录</CardTitle>
              </div>
              <p className="text-xs text-ink-400">
                官方平台上传由你本人操作。本产品不保存聊天截图、身份证或银行卡照片。
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-ink-200 text-[10px] uppercase tracking-wide text-ink-400">
                      <th className="py-2 pr-3 font-medium">材料</th>
                      <th className="py-2 pr-3 font-medium">能证明什么</th>
                      <th className="py-2 pr-3 font-medium">状态</th>
                      <th className="py-2 font-medium">获取方式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evidence_directory.map((item, index) => {
                      const rowState = evidenceRowState(item.label, facts);
                      // 后端把合同列在"待补充"里，本人已说明没签时不能再写成"未确认存在"；签了的情况保留原状态。
                      const state = rowState?.label === "已有" ? null : rowState;
                      const contradicted = Boolean(state) && item.proves.includes("未确认");
                      return (
                        <tr key={`${item.label}-${index}`} className="border-b border-ink-100 align-top">
                          <td className="py-2.5 pr-3 font-semibold text-ink-800">{item.label}</td>
                          <td className="py-2.5 pr-3 leading-relaxed text-ink-500">
                            {contradicted ? contractRowNote(facts) : item.proves}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge
                              variant={
                                state
                                  ? state.tone
                                  : item.status === "已有"
                                    ? "success"
                                    : item.status === "待补充"
                                      ? "warning"
                                      : "neutral"
                              }
                            >
                              {state ? state.label : item.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 leading-relaxed text-ink-500">{item.how_to_get}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-500">
                <Upload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />
                上传时优先使用原始截图和带时间地点信息的照片；聊天记录要保留对方身份信息与完整上下文。
              </div>
            </CardContent>
          </Card>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <AlertTriangle className="h-4 w-4" />
              重要说明
            </div>
            <p className="mt-1.5">{data.submit_notice}</p>
            <p className="mt-1.5">{data.platform.source_note}</p>
          </div>

          <div className="hidden items-center justify-between rounded-xl border border-ink-200 bg-white px-4 py-3 text-[10px] text-ink-400 sm:flex">
            <span className="inline-flex items-center gap-1">
              <Copy className="h-3 w-3" />
              复制内容后，回到官方平台粘贴；提交前请逐项核对。
            </span>
            <span>生成于 {new Date(data.generated_at).toLocaleString("zh-CN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormFieldCard({ field }: { field: FormField }) {
  const style = statusStyle[field.status];
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        field.status === "missing"
          ? "border-amber-200 bg-amber-50/40"
          : field.status === "verify"
            ? "border-orange-200 bg-orange-50/30"
            : field.status === "official_only"
              ? "border-ink-200 bg-ink-50/50"
              : "border-ink-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink-900">
            {field.label}
            {field.required && <span className="ml-1 text-[10px] font-medium text-red-600">必填</span>}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{field.explanation}</p>
        </div>
        <Badge variant={style.variant}>{style.label}</Badge>
      </div>

      <div className="mt-3 rounded-lg border border-ink-100 bg-white px-3 py-2.5">
        {field.status === "official_only" ? (
          <p className="text-xs font-medium text-ink-500">{field.placeholder || "请仅在官方平台填写"}</p>
        ) : field.value ? (
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-800">
            {field.value}
          </p>
        ) : (
          <p className="text-xs text-ink-400">{field.placeholder || "暂未整理出可用内容，请补充后再填写。"}</p>
        )}
      </div>

      {durationAsDateRisk(field) ? (
        <p className="mt-2 flex gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          上面整理出来的只是工作时长，不是起止日期。官方平台的开始、结束时间请留空，或想起具体月份后再补，
          不要把“约三个月”直接填进日期栏。
        </p>
      ) : null}

      {field.note && (
        <p className="mt-2 flex gap-1.5 text-[10px] leading-relaxed text-ink-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {field.note}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {field.source_facts.map((source) => (
            <span key={source} className="rounded bg-ink-100 px-1.5 py-0.5 text-[9px] text-ink-500">
              来自：{source}
            </span>
          ))}
        </div>
        {field.value && field.status !== "official_only" && !durationAsDateRisk(field) ? (
          <CopyButton text={field.value} label="复制此字段" compact />
        ) : field.status === "missing" ? (
          <span className="text-[10px] text-amber-700">补充后生成参考内容</span>
        ) : null}
      </div>
    </div>
  );
}

function StepTab({
  index,
  title,
  fieldCount,
  ready,
  active,
  onClick,
}: {
  index: number;
  title: string;
  fieldCount: number;
  ready: number;
  active: boolean;
  onClick: () => void;
}) {
  const press = usePressFeedback();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[150px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition lg:min-w-0 lg:w-full",
        active ? "bg-brand-900 text-white" : "text-ink-600 hover:bg-ink-50",
        pressClass(press),
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
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          active ? "bg-white/15 text-white" : "bg-ink-100 text-ink-500",
        )}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{title}</span>
        <span className={cn("mt-0.5 block text-[9px]", active ? "text-brand-200" : "text-ink-400")}>
          {fieldCount ? `${ready}/${fieldCount} 字段可用` : "操作步骤"}
        </span>
      </span>
    </button>
  );
}
