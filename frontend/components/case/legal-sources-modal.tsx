"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink, Scale } from "lucide-react";

import { useCase } from "@/components/case/case-provider";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/services/api";
import type { LegalBasisResponse } from "@/types/api";

export function LegalSourcesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { caseId } = useCase();
  const [data, setData] = React.useState<LegalBasisResponse | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    api
      .getLegalBasis(caseId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "无法读取法律依据。"))
      .finally(() => setLoading(false));
  }, [open, caseId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="相关法律依据"
      description="来自本地法律知识库，条条附来源和核验状态。请以官方原文为准。"
      wide
    >
      {loading && <Spinner label="正在检索国家法律与河南资料…" />}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {data && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              核验状态说明
            </div>
            <p className="mt-1">{data.verification_summary.note}</p>
            <p className="mt-1">
              共检索到 {data.provisions.length} 条：已核验 {data.verification_summary.verified} 条，
              按公开文本整理待逐条核验 {data.verification_summary.transcribed} 条，
              待核验 {data.verification_summary.pending} 条。
            </p>
          </div>

          <div className="space-y-3">
            {data.provisions.map((item) => {
              const isExpanded = expanded.includes(item.id);
              return (
                <div key={item.id} className="rounded-xl border border-ink-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-800">
                        <Scale className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-snug text-ink-900">
                          {item.document.title} · {item.article}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">{item.heading}</p>
                      </div>
                    </div>
                    <Badge variant={item.verification_status === "pending" ? "warning" : "neutral"}>
                      {item.verification_label}
                    </Badge>
                  </div>
                  <p className={`mt-3 text-xs leading-relaxed text-ink-600 ${isExpanded ? "" : "line-clamp-3"}`}>
                    {item.text}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-brand-800">{item.why_relevant}</p>
                  {isExpanded && (
                    <div className="mt-3 space-y-2 rounded-lg bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-500">
                      <p>发布机关：{item.document.issuing_authority}</p>
                      <p>文件编号：{item.document.doc_number}</p>
                      <p>效力状态：{item.document.validity}</p>
                      {item.conditions.length > 0 && <p>适用条件：{item.conditions.join("；")}</p>}
                      {item.source_note && <p>核验说明：{item.source_note}</p>}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                      className="text-[11px] font-semibold text-brand-800 hover:underline"
                    >
                      {isExpanded ? "收起条文详情" : "查看条文详情"}
                    </button>
                    {item.official_url && (
                      <a
                        href={item.official_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={
                          item.verification_status === "verified"
                            ? "该来源链接已人工核验。"
                            : "这是来源网站，打开后请按文件名自行查找条文原文。"
                        }
                        className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-brand-800"
                      >
                        {item.official_source_name
                          ? `在${item.official_source_name}查原文`
                          : "打开来源网站"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] leading-relaxed text-ink-400">{data.disclaimer}</p>
        </div>
      )}
    </Modal>
  );
}
