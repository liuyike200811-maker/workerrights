"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Info,
  MapPin,
  Settings2,
} from "lucide-react";

import { useCase } from "@/components/case/case-provider";
import { CaseInfoPanel } from "@/components/case/case-info-panel";
import { ChatBubble, TypingBubble } from "@/components/case/chat-message";
import { AssistantMessage } from "@/components/case/assistant-message";
import { FactsEditor } from "@/components/case/facts-editor";
import { PromptComposer } from "@/components/case/prompt-composer";
import { QuickReplyBar } from "@/components/case/quick-replies";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { factRows, locationValue } from "@/lib/facts";
import { intakeStage } from "@/lib/intake-progress";
import { formatAmount } from "@/lib/utils";
import { api } from "@/services/api";
import type { ChatMessage } from "@/types/api";

export default function ChatPage() {
  const { caseId, caseData, meta, setCaseData } = useCase();
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [draftReply, setDraftReply] = React.useState("");
  const [draftCitations, setDraftCitations] = React.useState<Array<Record<string, unknown>>>([]);
  const [streamStatus, setStreamStatus] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const streamController = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => streamController.current?.abort(), []);

  const messages = caseData?.messages || [];

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending, draftReply]);

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const currentQuestion =
    !sending && lastAssistant?.meta?.question ? lastAssistant.meta.question : null;

  const speech = useSpeechRecognition((text) => setInput(text));

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending || !caseData) return;
    setError("");
    setSending(true);
    setDraftReply(""); setDraftCitations([]); setStreamStatus("工友正在看你的消息…");
    streamController.current = new AbortController();
    const optimistic: ChatMessage = {
      id: -Date.now(),
      role: "user",
      content,
      meta: {},
      created_at: new Date().toISOString(),
    };
    setCaseData((current) =>
      current ? { ...current, messages: [...current.messages, optimistic] } : current,
    );
    if (input.trim() === content) setInput("");
    try {
      const result = await api.sendMessageStream(caseId, content, event => {
        if (event.type === "reply_snapshot") { setDraftReply(event.text); setDraftCitations(event.citations ?? []); }
        if (event.type === "reply_reset") setDraftReply("");
        if (event.type === "status") setStreamStatus(event.text);
        if (event.type === "action") setStreamStatus(event.action === "search_law" ? "已查到资料，正在组织回答…" : "正在整理…");
      }, streamController.current.signal);
      setCaseData(result.case);
    } catch (err) {
      setCaseData((current) =>
        current
          ? { ...current, messages: current.messages.filter((item) => item.id !== optimistic.id) }
          : current,
      );
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试。");
      setInput(content);
    } finally {
      setSending(false);
      streamController.current = null;
      setDraftReply(""); setStreamStatus("");
    }
  };

  if (!caseData) return null;
  const facts = caseData.facts;
  const catalog = meta?.evidence_catalog || [];
  const mobileRows = factRows(facts, catalog);
  const stage = intakeStage(caseData.progress, caseData.intake, messages, caseData.status);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5 shadow-sm lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink-800">{locationValue(facts)}</p>
            <p className="mt-0.5 text-[10px] text-ink-400">
              {facts.owed_amount
                ? `陈述欠薪 ${formatAmount(facts.owed_amount, facts.owed_amount_approx)}`
                : "欠薪金额待核实"}
              {" · "}
              {stage.headline}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setInfoOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            案件信息
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold text-ink-800">AI 劳动权益助手</p>
              <span className="text-[10px] text-ink-400">
                {meta?.provider.is_mock ? "演示模式 · 本地规则引擎" : meta?.provider.display_name}
              </span>
            </div>
            <span className="hidden text-[10px] text-ink-400 sm:inline">慢慢说，我们一起理清楚</span>
          </div>

          <div className="max-h-[38vh] min-h-[240px] space-y-4 overflow-y-auto px-3 py-4 sm:max-h-[46vh] sm:px-5 lg:max-h-[calc(100vh-24rem)] lg:min-h-[440px]">
            {messages.map((message, index) => (
              <ChatBubble
                key={`${message.id}-${index}`}
                message={message}
                showProvider={
                  index === messages.findIndex((item) => item.role === "assistant")
                }
              />
            ))}
            {sending && (draftReply ? <div className="mr-6 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm leading-7 text-ink-800"><AssistantMessage content={draftReply} citations={draftCitations} /></div> : <><TypingBubble /><p className="text-xs text-ink-500">{streamStatus}</p></>)}
            <div ref={bottomRef} />
          </div>

          {caseData.intake.confirmed && (
            <div className="border-t border-emerald-200 bg-emerald-50 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-emerald-900">
                  案件信息已确认。你可以查看分析，或直接生成行动指南。
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/case/${caseId}/analysis`}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    案件分析
                  </Link>
                  <Link
                    href={`/case/${caseId}/action-plan`}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    行动指南
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {currentQuestion && (
            <QuickReplyBar
              question={currentQuestion}
              onSend={send}
              onEdit={() => setEditOpen(true)}
              disabled={sending}
            />
          )}

          <div className="border-t border-ink-100 bg-white px-3 py-3 sm:px-4">
            {error && (
              <Alert variant="danger" className="mb-2 py-2 text-xs">
                {error}
              </Alert>
            )}
            {speech.error && (
              <Alert variant="warning" className="mb-2 py-2 text-xs">
                {speech.error}
              </Alert>
            )}
            <PromptComposer
              value={input}
              onChange={setInput}
              onSend={(text) => void send(text)}
              onStop={() => streamController.current?.abort()}
              busy={sending}
              placeholder={
                caseData.intake.confirmed
                  ? "还有补充或问题？可以继续告诉我…"
                  : "用平时说话的方式回答，不用懂法律…"
              }
              mic={{
                supported: speech.supported,
                listening: speech.listening,
                onToggle: () => (speech.listening ? speech.stop() : speech.start()),
              }}
              onEditInfo={() => setEditOpen(true)}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-400">
              <span className="inline-flex items-center gap-1">
                <Info className="h-3 w-3" />
                AI 辅助整理，不构成正式法律意见；重要决定请咨询 12348。
              </span>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="font-medium text-brand-800 hover:underline"
              >
                修改案件信息
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[10px] text-ink-400">
          <MapPin className="h-3.5 w-3.5 text-brand-700" />
          服务范围：河南省。语音输入依赖浏览器能力，不会上传音频到本产品服务器。
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-40">
          <CaseInfoPanel />
        </div>
      </aside>

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="案件信息"
        description="这些信息只对当前浏览器会话可见。"
      >
        <div className="mb-4 grid grid-cols-2 gap-2">
          {mobileRows.slice(0, 4).map((row) => (
            <div key={row.key} className="rounded-lg bg-ink-50 px-3 py-2">
              <p className="text-[10px] text-ink-400">{row.label}</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-ink-800">{row.value}</p>
            </div>
          ))}
        </div>
        <CaseInfoPanel compact />
        <Button
          className="mt-4 w-full"
          variant="outline"
          onClick={() => {
            setInfoOpen(false);
            setEditOpen(true);
          }}
        >
          <Settings2 className="h-4 w-4" />
          修改案件信息
        </Button>
      </Modal>

      <FactsEditor open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
