"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSearch,
  Loader2,
  MapPin,
  Scale,
  ShieldCheck,
} from "lucide-react";

import { useCase } from "@/components/case/case-provider";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PressLink } from "@/components/ui/press-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/services/api";
import type { AnalysisResponse, CaseFacts, EvidenceItem, LegalAnalysisItem, RelationshipNode } from "@/types/api";
import { evidenceState } from "@/lib/facts";
import { intakeStage } from "@/lib/intake-progress";
import { cn, verificationLabel } from "@/lib/utils";

export default function AnalysisPage() {
  const { caseId, caseData } = useCase();
  const [analysis, setAnalysis] = React.useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [showAllLegal, setShowAllLegal] = React.useState(false);
  const [exporting, setExporting] = React.useState<"docx" | "pdf" | null>(null);
  const [exportError, setExportError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getAnalysis(caseId)
      .then((data) => {
        if (active) setAnalysis(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "无法生成案件分析。");
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
    setExportError("");
    try {
      await api.downloadExport(caseId, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "导出失败。");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="正在整理案件分析和法律依据…" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <Alert variant="danger" title="无法生成分析">
        {error || "请稍后重试。"}
      </Alert>
    );
  }

  const legalMap = new Map(analysis.legal_analysis.map((item) => [item.id, item]));
  const facts: CaseFacts = caseData?.facts || {};
  const stage = caseData
    ? intakeStage(caseData.progress, caseData.intake, caseData.messages, caseData.status)
    : null;
  const confirmed = stage
    ? stage.confirmed
    : analysis.status === "ready" || analysis.status === "planned";
  const completenessLabel = stage
    ? `核心事实 ${stage.core.done}/${stage.core.total} · ${confirmed ? "已确认" : "尚未确认"}`
    : `信息完整度 ${analysis.completeness.percent}%`;
  const visibleLegal = showAllLegal
    ? analysis.legal_analysis
    : analysis.legal_analysis.slice(0, 4);

  return (
    <div className="space-y-4">
      {analysis.preliminary && (
        <Alert
          variant="warning"
          title="案件信息尚未确认"
          action={
            <Link href={`/case/${caseId}`} className="shrink-0 text-xs font-semibold text-amber-900 underline">
              返回对话
            </Link>
          }
        >
          {analysis.preliminary_note}
        </Alert>
      )}

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">案件分析工作台</Badge>
                <Badge variant={confirmed ? "success" : "warning"}>{completenessLabel}</Badge>
                {analysis.is_demo && <Badge variant="warning">虚构演示</Badge>}
              </div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-ink-900 sm:text-2xl">
                {analysis.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
                {analysis.summary}
              </p>
              <p className="mt-2 text-[11px] text-ink-400">
                分析依据你提供的事实和本地法律知识库生成，不认定最终法律责任。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => download("docx")}
                disabled={Boolean(exporting)}
              >
                {exporting === "docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                DOCX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => download("pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </Button>
              <PressLink
                href={`/case/${caseId}/action-plan`}
                className={cn(buttonVariants({ size: "sm" }), "h-9")}
              >
                生成行动指南
                <ArrowRight className="h-3.5 w-3.5" />
              </PressLink>
            </div>
          </div>
          {exportError && <p className="mt-3 text-xs text-red-600">{exportError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-brand-700" />
            <CardTitle>案件基本情况</CardTitle>
          </div>
          <p className="text-xs text-ink-400">未知信息保留为“待核实”，不会自动补全。</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.basic_info.map((item) => (
              <div key={item.key} className="rounded-xl border border-ink-100 bg-ink-50/50 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-ink-400">{item.label}</p>
                  {item.status === "unknown" && <Badge variant="neutral">待核实</Badge>}
                  {item.status === "approx" && <Badge variant="warning">约数</Badge>}
                </div>
                <p className={cn("mt-1 text-sm font-semibold leading-snug", item.status === "unknown" ? "text-ink-400" : "text-ink-900")}>
                  {item.value}
                </p>
                {item.note && <p className="mt-1 text-[10px] leading-relaxed text-ink-400">{item.note}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-700" />
            <CardTitle>可能的用工关系</CardTitle>
          </div>
          <p className="text-xs text-ink-400">根据你的陈述生成，未知主体保留为空，不据此认定最终责任。</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
            {analysis.relationship.nodes.map((node, index) => (
              <React.Fragment key={node.id}>
                <RelationshipCard node={node} />
                {index < analysis.relationship.nodes.length - 1 && (
                  <div className="flex items-center justify-center py-1 text-ink-300 lg:py-0">
                    <ArrowDown className="h-4 w-4 lg:hidden" />
                    <ArrowRight className="hidden h-4 w-4 lg:block" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          {analysis.relationship.confirmed_notes.length > 0 && (
            <div className="mt-4 rounded-xl bg-brand-50/70 px-4 py-3">
              <p className="text-xs font-semibold text-brand-900">目前较明确的信息</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-brand-950/80">
                {analysis.relationship.confirmed_notes.map((note) => (
                  <li key={note} className="flex gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {analysis.relationship.disclaimer}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-brand-700" />
            <CardTitle>证据情况</CardTitle>
          </div>
          <p className="text-xs text-ink-500">{analysis.evidence.summary}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <EvidenceColumn
              title="已经拥有的材料"
              items={analysis.evidence.have}
              facts={facts}
              tone="success"
              empty="尚未整理出已有材料。"
            />
            <EvidenceColumn
              title="还需要寻找的材料"
              items={analysis.evidence.needed}
              facts={facts}
              tone="warning"
              empty="暂无额外必补材料。"
            />
            <EvidenceColumn
              title="可替代或辅助证明"
              items={analysis.evidence.alternatives}
              facts={facts}
              tone="info"
              empty="暂无替代材料建议。"
            />
            <EvidenceColumn
              title="需要进一步核实"
              items={analysis.evidence.verify}
              facts={facts}
              tone="neutral"
              empty="暂无待核实项。"
            />
          </div>
          <div className="mt-3 flex gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-brand-950">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />
            {analysis.evidence.disclaimer}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-brand-700" />
            <CardTitle>可能涉及的权益</CardTitle>
          </div>
          <p className="text-xs text-ink-400">以下为可能涉及的权益方向，是否成立需结合事实和程序判断。</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-2">
            {analysis.rights.map((right) => (
              <div key={right.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold leading-snug text-ink-900">{right.title}</h3>
                  <Badge variant={right.status === "核心诉求" ? "success" : "warning"}>{right.status}</Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">{right.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {right.basis.map((basis) => {
                    const item = legalMap.get(basis);
                    return (
                      <span key={basis} className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] text-ink-500">
                        {item
                          ? `${item.article}｜${item.document_title.replace("中华人民共和国", "")}`
                          : "依据条文待补充"}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-700" />
                <CardTitle>法律分析</CardTitle>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                共 {analysis.legal_analysis.length} 条可能相关的法律依据，均附适用条件和待核实事项。
              </p>
            </div>
            <Badge variant="warning">
              国家法条待逐条核验 · 河南资料待核验
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleLegal.map((item) => (
            <LegalCard key={item.id} item={item} />
          ))}
          {analysis.legal_analysis.length > 4 && (
            <Button variant="outline" className="w-full" onClick={() => setShowAllLegal((value) => !value)}>
              {showAllLegal ? "收起部分法律依据" : `展开全部 ${analysis.legal_analysis.length} 条法律依据`}
            </Button>
          )}
          <div className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-[11px] leading-relaxed text-ink-500">
            {analysis.legal_sources.verification_summary.note}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle>需要特别注意</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysis.risk_flags.map((risk) => (
              <div
                key={risk.title}
                className={cn(
                  "rounded-xl border px-3.5 py-3",
                  risk.level === "attention" ? "border-amber-200 bg-amber-50/60" : "border-ink-100 bg-ink-50/60",
                )}
              >
                <p className="text-xs font-semibold text-ink-800">{risk.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{risk.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-700" />
              <CardTitle>去哪里办</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
              <p className="text-[11px] font-medium text-brand-700">建议优先联系</p>
              <p className="mt-1 text-sm font-bold text-brand-950">{analysis.jurisdiction.primary_agency}</p>
              <p className="mt-2 text-xs leading-relaxed text-brand-950/80">{analysis.jurisdiction.guidance}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                <Badge variant="default">
                  {analysis.jurisdiction.city || "城市待确认"}
                  {analysis.jurisdiction.district ? ` · ${analysis.jurisdiction.district}` : ""}
                </Badge>
                <Badge variant={analysis.jurisdiction.confidence === "high" ? "success" : "warning"}>
                  管辖信息{analysis.jurisdiction.confidence === "high" ? "较明确" : "需核实"}
                </Badge>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">{analysis.jurisdiction.note}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <PressLink
                href={`/case/${caseId}/action-plan`}
                className={cn(buttonVariants({ size: "sm" }), "h-9")}
              >
                查看行动指南
                <ArrowRight className="h-3.5 w-3.5" />
              </PressLink>
              <PressLink
                href={`/case/${caseId}/form-assistant`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}
              >
                材料整理参考
              </PressLink>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-ink-400">{analysis.disclaimer}</p>
    </div>
  );
}

function RelationshipCard({ node }: { node: RelationshipNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        node.status === "known"
          ? "border-brand-300 bg-brand-50/60"
          : node.status === "partial"
            ? "border-amber-200 bg-amber-50/50"
            : "border-dashed border-ink-300 bg-ink-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-ink-500">{node.label}</p>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            node.status === "known" ? "bg-emerald-500" : node.status === "partial" ? "bg-amber-500" : "bg-ink-300",
          )}
        />
      </div>
      <p className={cn("mt-1 text-xs font-bold leading-snug", node.status === "unknown" ? "text-ink-400" : "text-ink-900")}>
        {node.name}
      </p>
      <p className="mt-1 text-[9px] leading-relaxed text-ink-400">{node.note}</p>
    </div>
  );
}

function EvidenceColumn({
  title,
  items,
  facts,
  tone,
  empty,
}: {
  title: string;
  items: EvidenceItem[];
  facts: CaseFacts;
  tone: "success" | "warning" | "info" | "neutral";
  empty: string;
}) {
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50/50",
    warning: "border-amber-200 bg-amber-50/50",
    info: "border-brand-200 bg-brand-50/50",
    neutral: "border-ink-200 bg-ink-50/50",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3.5", toneClass)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-ink-800">{title}</p>
        <span className="text-[10px] text-ink-400">{items.length} 项</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-ink-400">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => {
            const state = evidenceState(item, facts);
            const detail = state?.note || item.reason;
            return (
              <li key={`${title}-${item.key}-${item.label}`} className="text-[11px] leading-relaxed text-ink-600">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink-800">{item.label}</span>
                  {state && <Badge variant={state.tone}>{state.label}</Badge>}
                </div>
                {item.proves?.length ? (
                  <p className="mt-0.5 text-ink-500">能证明：{item.proves.join("、")}</p>
                ) : null}
                {detail ? <p className="mt-0.5">{detail}</p> : null}
                {item.how_to_get ? <span className="mt-0.5 block text-[10px] text-ink-400">{item.how_to_get}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "来源网站";
  }
}

function LegalCard({ item }: { item: LegalAnalysisItem }) {
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-snug text-ink-900">
            {item.document_title} · {item.article}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">{item.heading}</p>
        </div>
        <Badge variant={item.verification_status === "pending" ? "warning" : "neutral"}>
          {item.verification_label || verificationLabel(item.verification_status)}
        </Badge>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-600">{item.text}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-emerald-50 px-3 py-2">
          <p className="text-[10px] font-semibold text-emerald-800">适用判断</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-950/80">{item.applicability}</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-[10px] font-semibold text-amber-800">待核实事项</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-950/80">
            {item.pending_verification.length ? item.pending_verification.join("；") : "暂无额外待核实事项"}
          </p>
        </div>
      </div>
      {item.supporting_facts.length > 0 && (
        <div className="mt-2 text-[11px] leading-relaxed text-ink-500">
          <span className="font-medium text-ink-700">已陈述事实：</span>
          {item.supporting_facts.join(" ")}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-2 text-[10px] text-ink-400">
        <span>{item.issuing_authority}</span>
        <span>{item.document_number}</span>
        {item.official_url && (
          <a
            href={item.official_url}
            target="_blank"
            rel="noreferrer noopener"
            title={
              item.verification_status === "verified"
                ? "该来源链接已人工核验到条文原文。"
                : "这是来源网站，不一定是本条文所在页面，打开后请按文件名称自行查找。"
            }
            className="inline-flex items-center gap-1 font-medium text-brand-800 hover:underline"
          >
            {item.official_source_name
              ? `在${item.official_source_name}查原文`
              : `打开来源网站 ${hostOf(item.official_url)}`}
            <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </div>
      {item.source_note && <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">{item.source_note}</p>}
    </div>
  );
}
