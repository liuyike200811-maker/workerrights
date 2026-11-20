"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  PencilLine,
  ShieldCheck,
} from "lucide-react";

import { useCase } from "@/components/case/case-provider";
import { FactsEditor } from "@/components/case/facts-editor";
import { LegalSourcesModal } from "@/components/case/legal-sources-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { checkLabel, factRows, missingChecks } from "@/lib/facts";
import { intakeStage, unconfirmedNotice } from "@/lib/intake-progress";
import { statusLabel } from "@/lib/utils";

export function CaseInfoPanel({ compact = false }: { compact?: boolean }) {
  const { caseId, caseData, meta } = useCase();
  const [editOpen, setEditOpen] = React.useState(false);
  const [legalOpen, setLegalOpen] = React.useState(false);

  if (!caseData) return null;
  const catalog = meta?.evidence_catalog || [];
  const rows = factRows(caseData.facts, catalog);
  const missing = missingChecks(caseData.progress.checks);
  const stage = intakeStage(caseData.progress, caseData.intake, caseData.messages, caseData.status);
  const unknownEntries = Object.entries(caseData.intake.unknowns || {});

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-400">案件信息</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">{statusLabel(caseData.status)}</p>
          </div>
          <Badge variant={stage.confirmed ? "success" : "warning"}>
            {stage.confirmed ? "已确认" : stage.fullButUnconfirmed ? "尚未确认" : "补充中"}
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Progress value={stage.barValue} className="h-1.5 flex-1" />
          <span className="text-[10px] font-bold text-brand-900">
            核心 {stage.core.done}/{stage.core.total}
          </span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">
          {stage.optional.total ? `可选信息 ${stage.optional.done}/${stage.optional.total} · ` : ""}
          {stage.confirmed ? "你已确认" : "你尚未确认"}
        </p>
        {stage.fullButUnconfirmed && (
          <p className="mt-2 flex gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-900">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            {unconfirmedNotice(stage)}
          </p>
        )}

        <div className="mt-4 divide-y divide-ink-100">
          {rows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-3 py-2.5">
              <span className="shrink-0 text-xs text-ink-400">{row.label}</span>
              <span
                className={
                  row.highlight
                    ? "text-right text-xs font-bold text-brand-900"
                    : row.known
                      ? "text-right text-xs font-medium text-ink-800"
                      : "text-right text-xs text-ink-400"
                }
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {missing.length > 0 && (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>还需补充：{missing.join("、")}</span>
          </div>
        )}
        {unknownEntries.length > 0 && (
          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            以下信息已标记为待核实，不影响继续整理：
            {unknownEntries.map(([key]) => checkLabel(key)).join("、")}
          </p>
        )}

        <div className="mt-4 grid gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilLine className="h-3.5 w-3.5" />
            修改案件信息
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLegalOpen(true)}>
            <BookOpenCheck className="h-3.5 w-3.5" />
            查看相关法律依据
          </Button>
        </div>

        {!compact && (
          <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[10px] leading-relaxed text-ink-500">
            <span className="inline-flex items-center gap-1 font-medium text-ink-600">
              <ShieldCheck className="h-3 w-3" />
              匿名会话语义
            </span>
            <p className="mt-1">案件只对当前浏览器会话可见，可在“我的案件”中删除。</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-400">下一步</p>
        {caseData.intake.confirmed ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs leading-relaxed text-ink-500">
              信息已确认，可以查看分析和行动指南。
            </p>
            <Link
              href={`/case/${caseId}/analysis`}
              className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900"
            >
              查看案件分析
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/case/${caseId}/action-plan`}
              className="flex items-center justify-between rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white"
            >
              生成维权行动指南
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <span>继续在对话中回答一个问题，信息确认后即可生成完整分析和行动步骤。</span>
          </div>
        )}
      </div>

      <FactsEditor open={editOpen} onClose={() => setEditOpen(false)} />
      <LegalSourcesModal open={legalOpen} onClose={() => setLegalOpen(false)} />
    </div>
  );
}
