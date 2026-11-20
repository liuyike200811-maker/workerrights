import type { CaseRecord, CaseStatus, ChatMessage, Progress } from "@/types/api";

export interface AskedQuestion {
  key: string;
  optional: boolean;
}

export interface IntakeStage {
  core: { done: number; total: number };
  optional: { done: number; total: number };
  confirmed: boolean;
  unverifiedCount: number;
  fullButUnconfirmed: boolean;
  barValue: number;
  headline: string;
}

export function askedQuestions(messages: ChatMessage[]): AskedQuestion[] {
  const seen = new Map<string, AskedQuestion>();
  for (const message of messages) {
    const question = message.meta?.question;
    if (message.role !== "assistant" || !question?.key) continue;
    seen.set(question.key, { key: question.key, optional: Boolean(question.optional) });
  }
  return [...seen.values()];
}

// 后端的 percent 只统计核心事实，问完就是 100；确认这一步必须由前端单独呈现。
export function intakeStage(
  progress: Progress,
  intake: CaseRecord["intake"],
  messages: ChatMessage[],
  status?: CaseStatus,
): IntakeStage {
  const checks = progress.checks || {};
  const coreDone = Object.values(checks).filter(Boolean).length;
  const coreTotal = Object.keys(checks).length;

  const optionalAsked = askedQuestions(messages).filter((item) => item.optional);
  const lastQuestionKey = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.meta?.question)?.meta?.question?.key;
  const answered = optionalAsked
    .filter((item) => item.key !== lastQuestionKey)
    .map((item) => item.key);

  const confirmed = Boolean(intake.confirmed) || status === "planned";
  const fullButUnconfirmed = coreTotal > 0 && coreDone === coreTotal && !confirmed;

  const parts = [`核心事实 ${coreDone}/${coreTotal}`];
  if (optionalAsked.length) parts.push(`可选信息 ${answered.length}/${optionalAsked.length}`);
  parts.push(confirmed ? "已确认" : "尚未确认");

  return {
    core: { done: coreDone, total: coreTotal },
    optional: { done: answered.length, total: optionalAsked.length },
    confirmed,
    unverifiedCount: Object.keys(intake.unknowns || {}).length,
    fullButUnconfirmed,
    barValue: progress.percent,
    headline: parts.join(" · "),
  };
}

export function unconfirmedNotice(stage: IntakeStage): string {
  if (!stage.fullButUnconfirmed) return "";
  return stage.unverifiedCount
    ? `核心事实都问到了，但还有 ${stage.unverifiedCount} 项标为待核实，你也还没点确认。先核对案件信息，再生成分析和行动步骤。`
    : "核心事实都问到了，但你还没有点确认。先核对案件信息，再生成分析和行动步骤。";
}
