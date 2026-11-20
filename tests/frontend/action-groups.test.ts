import { describe, expect, it } from "vitest";

import { groupSteps } from "@/lib/action-groups";
import type { ActionStep, ChannelInfo } from "@/types/api";

function channel(id: string, category: string): ChannelInfo {
  return {
    id,
    name: id,
    category,
    description: "",
    official_url: null,
    access_note: null,
    jurisdiction_rule: null,
    verification_status: "pending",
    last_verified_at: null,
    source_note: null,
    recommended: false,
    reason: "",
    legal_basis: [],
  };
}

function step(id: string, position: number, channel_id: string | null): ActionStep {
  return {
    id,
    step_key: id,
    position,
    title: id,
    why: "",
    prepare: [],
    channel_id,
    channel_name: channel_id,
    legal_basis: [],
    deadline_note: null,
    risk_note: null,
    draft_text: null,
    done: false,
    done_at: null,
  };
}

const channels = [
  channel("supervision", "labor_supervision"),
  channel("platform", "official_platform"),
  channel("hotline", "hotline"),
  channel("arb", "arbitration"),
  channel("aid", "legal_aid"),
  channel("court", "litigation"),
];

describe("action plan grouping", () => {
  it("splits self-service, parallel reporting and professional decisions", () => {
    const groups = groupSteps(
      [
        step("gather", 1, null),
        step("report", 2, "supervision"),
        step("online", 3, "platform"),
        step("call", 4, "hotline"),
        step("arbitrate", 5, "arb"),
        step("aid", 6, "aid"),
        step("sue", 7, "court"),
      ],
      channels,
    );
    expect(groups.map((group) => group.id)).toEqual(["self", "parallel", "professional"]);
    expect(groups[0].steps.map((item) => item.id)).toEqual(["gather"]);
    expect(groups[1].steps.map((item) => item.id)).toEqual(["report", "online", "call"]);
    expect(groups[2].steps.map((item) => item.id)).toEqual(["arbitrate", "aid", "sue"]);
  });

  it("never words the groups as a required order", () => {
    const groups = groupSteps([step("arbitrate", 1, "arb")], channels);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("先咨询再决定");
    expect(groups[0].description).toContain("取决于");
    expect(groups[0].title).not.toMatch("按顺序");
  });

  it("drops empty buckets", () => {
    const groups = groupSteps([step("gather", 1, null)], channels);
    expect(groups.map((group) => group.id)).toEqual(["self"]);
  });

  it("treats a channel id missing from the list as self-service", () => {
    const groups = groupSteps([step("odd", 1, "not-returned")], channels);
    expect(groups.map((group) => group.id)).toEqual(["self"]);
  });
});
