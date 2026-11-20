import { describe, expect, it } from "vitest";

import { intakeStage, unconfirmedNotice } from "@/lib/intake-progress";
import type { CaseRecord, ChatMessage, Progress } from "@/types/api";

const coreChecks: Progress["checks"] = {
  location: true,
  work_type: true,
  period: true,
  recruiter: true,
  manager: true,
  wage_basis: true,
  amounts: true,
  owed_amount: true,
  contract: true,
  evidence: true,
};

function progress(overrides: Partial<Progress> = {}): Progress {
  return {
    checks: coreChecks,
    done: Object.values(coreChecks).filter(Boolean).length,
    total: Object.keys(coreChecks).length,
    percent: 100,
    unknown_count: 0,
    ...overrides,
  };
}

const intake: CaseRecord["intake"] = { confirmed: false, unknowns: {}, skipped: [] };

function question(key: string, optional = false): ChatMessage {
  return {
    id: Math.random(),
    role: "assistant",
    content: `${key}?`,
    meta: { question: { key, text: key, quick_replies: [], optional } },
    created_at: new Date().toISOString(),
  };
}

function user(text: string): ChatMessage {
  return { id: Math.random(), role: "user", content: text, meta: {}, created_at: new Date().toISOString() };
}

describe("intake progress wording", () => {
  it("keeps confirmation separate from core facts", () => {
    const stage = intakeStage(progress(), intake, [question("location"), question("confirm", true)]);
    expect(stage.core).toEqual({ done: 10, total: 10 });
    expect(stage.confirmed).toBe(false);
    expect(stage.fullButUnconfirmed).toBe(true);
    expect(stage.headline).toContain("核心事实 10/10");
    expect(stage.headline).toContain("尚未确认");
    expect(stage.headline).not.toContain("100%");
  });

  it("counts asked optional questions as answered only after a reply", () => {
    const stage = intakeStage(progress(), intake, [
      user("我在郑州干活"),
      question("district", true),
      user("金水区"),
      question("prior_report", true),
    ]);
    expect(stage.optional).toEqual({ done: 1, total: 2 });
    expect(stage.headline).toContain("可选信息 1/2");
  });

  it("switches to confirmed once the user confirms", () => {
    const stage = intakeStage(progress(), { ...intake, confirmed: true }, [question("confirm", true)]);
    expect(stage.confirmed).toBe(true);
    expect(stage.fullButUnconfirmed).toBe(false);
    expect(stage.headline).toContain("已确认");
    expect(unconfirmedNotice(stage)).toBe("");
  });

  it("does not claim completion while core facts are still missing", () => {
    const partial = progress({
      checks: { ...coreChecks, owed_amount: false, evidence: false },
      percent: 80,
    });
    const stage = intakeStage(partial, intake, []);
    expect(stage.core).toEqual({ done: 8, total: 10 });
    expect(stage.fullButUnconfirmed).toBe(false);
    expect(unconfirmedNotice(stage)).toBe("");
  });

  it("mentions the pending items when the bar is full but nothing is confirmed", () => {
    const stage = intakeStage(
      progress({ unknown_count: 2 }),
      { ...intake, unknowns: { project_name: "不知道", contractor_name: "没问过" } },
      [],
    );
    expect(unconfirmedNotice(stage)).toContain("2 项标为待核实");
  });
});
