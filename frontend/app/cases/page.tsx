"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import { DemoCaseButton, StartCaseButton } from "@/components/home/start-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/services/api";
import type { CaseBrief } from "@/types/api";
import { formatAmount, formatDate, statusLabel } from "@/lib/utils";

export default function CasesPage() {
  const [cases, setCases] = React.useState<CaseBrief[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<CaseBrief | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.listCases();
      setCases(result.cases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法读取案件列表。请确认本地后端已启动。");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteCase(deleteTarget.id);
      setCases((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后重试。");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
              <FolderOpen className="h-4 w-4" />
              本浏览器匿名会话
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink-900">我的案件</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-500">
              案件记录与当前浏览器的匿名会话标识绑定。其他会话无法读取；清除浏览器数据后将无法恢复访问。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StartCaseButton size="default" />
            <DemoCaseButton label="演示案件" size="default" />
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-xs leading-relaxed text-brand-950/80">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          本产品不要求身份证号，不在服务器保存身份证、银行卡或聊天截图原件。官方平台的材料提交由你本人完成。
        </div>

        {error && (
          <Alert variant="danger" className="mt-5">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner label="正在读取案件…" />
          </div>
        ) : cases.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-ink-300/80 bg-white/60 px-6 py-14 text-center backdrop-blur-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
              <FolderOpen className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-ink-900">还没有案件</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
              用日常语言说说遇到的问题，Agent 会一次问一个问题，帮你整理成可用的维权材料。
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StartCaseButton />
              <DemoCaseButton />
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {cases.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/75 bg-white/75 p-4 shadow-card backdrop-blur-sm transition hover:border-brand-200 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.status === "collecting" ? "warning" : item.status === "ready" ? "success" : "default"}>
                        {statusLabel(item.status)}
                      </Badge>
                      {item.is_demo && (
                        <Badge variant="warning">
                          <Sparkles className="h-3 w-3" />
                          虚构演示
                        </Badge>
                      )}
                      <span className="text-[10px] text-ink-400">{formatDate(item.updated_at)}</span>
                    </div>
                    <h2 className="mt-2 truncate text-base font-bold text-ink-900">{item.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-ink-400" />
                        {[item.city, item.district].filter(Boolean).join(" · ") || "地点待核实"}
                      </span>
                      <span>{item.work_type || "工种待核实"}</span>
                      <span className={item.owed_amount ? "font-semibold text-brand-900" : ""}>
                        {item.owed_amount
                          ? `陈述欠薪 ${formatAmount(item.owed_amount, item.owed_amount_approx)}`
                          : "欠薪金额待核实"}
                      </span>
                    </div>
                    <div className="mt-3 flex max-w-sm items-center gap-2">
                      <Progress value={item.progress.percent} className="h-1.5" />
                      <span className="shrink-0 text-[10px] font-medium text-ink-400">
                        核心事实 {item.progress.done}/{item.progress.total}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/case/${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-800"
                    >
                      继续
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(item)}
                      aria-label={`删除案件：${item.title}`}
                      className="text-ink-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-ink-400">
          删除案件会同时删除该案件的聊天记录和已勾选的行动步骤，且不可恢复。当前演示使用本地 SQLite，未上云。
        </p>
      </main>
      <SiteFooter />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="删除这个案件？"
        description="案件、聊天记录和行动步骤进度都会被删除，且无法恢复。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              确认删除
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {deleteTarget?.title}
        </div>
      </Modal>
    </div>
  );
}
