import { describe, expect, it } from "vitest";

import {
  CHECK_LABELS,
  checkLabel,
  contractRowNote,
  contractState,
  evidenceLabels,
  evidenceRowState,
  evidenceState,
  factRows,
  locationValue,
  missingChecks,
  periodNeedsDates,
  periodValue,
  wageValue,
} from "@/lib/facts";
import {
  channelCategoryLabel,
  entryLink,
  formatAmount,
  statusLabel,
  verificationLabel,
} from "@/lib/utils";
import type { CaseFacts, EvidenceCatalogItem, EvidenceItem } from "@/types/api";

const facts: CaseFacts = {
  location_province: "河南省",
  location_city: "郑州市",
  location_district: "金水区",
  work_type: "钢筋工",
  duration_text: "3个月",
  wage_basis: "按天",
  daily_wage: 350,
  owed_amount: 20000,
  agreed_amount: 26000,
  paid_amount: 6000,
  has_contract: "no",
  recruiter_type: "包工头",
  manager_role: "包工头",
  evidence: ["chat", "attendance"],
};

const catalog: EvidenceCatalogItem[] = [
  { key: "chat", label: "微信聊天记录", proves: [], how_to_get: "" },
  { key: "attendance", label: "考勤记录", proves: [], how_to_get: "" },
];

describe("amount and date formatting", () => {
  it("formats amounts with approximate marker", () => {
    expect(formatAmount(20000)).toBe("2万元");
    expect(formatAmount(23500)).toBe("2.4万元");
    expect(formatAmount(350)).toBe("350元");
    expect(formatAmount(20000, true)).toBe("约2万元");
    expect(formatAmount(null)).toBe("待核实");
  });

  it("maps status labels", () => {
    expect(statusLabel("ready")).toBe("信息已确认");
    expect(statusLabel("planned")).toBe("已生成行动方案");
    expect(verificationLabel("transcribed")).toBe("待逐条核验");
    expect(verificationLabel("official_only")).toBe("仅官方填写");
  });

  it("never echoes internal English identifiers", () => {
    expect(statusLabel("some_future_state")).toBe("本地演示中");
    expect(verificationLabel("some_future_state")).toBe("待核验");
    expect(checkLabel("some_future_key")).toBe("其他信息");
    expect(channelCategoryLabel("labor_supervision")).toBe("劳动保障监察");
    expect(channelCategoryLabel("official_platform")).toBe("国家级线上反映平台");
    expect(channelCategoryLabel("hotline")).toBe("服务热线");
    expect(channelCategoryLabel("unknown_channel")).toBe("其他渠道");
    expect(channelCategoryLabel(null)).toBe("其他渠道");
  });
});

describe("official entry links", () => {
  it("only calls an entry verified when the backend says so", () => {
    expect(entryLink("verified", "郑州市劳动保障监察机构").label).toBe("打开办理入口");
    const pending = entryLink("pending", "全国根治欠薪线索反映平台");
    expect(pending.label).toBe("打开机构官网首页");
    expect(pending.hint).toContain("待核验");
    const transcribed = entryLink("transcribed", "12333");
    expect(transcribed.label).toBe("打开机构官网首页");
    expect(transcribed.hint).toContain("12333");
  });
});

describe("contract and evidence states", () => {
  const contractItem: EvidenceItem = { key: "contract", label: "书面劳动合同" };

  it("separates declared-not-signed from never-asked", () => {
    expect(contractState({ has_contract: "no" })).toBe("not-signed");
    expect(contractState({ has_contract: "yes" })).toBe("signed");
    expect(contractState({})).toBe("unknown");
    expect(evidenceState(contractItem, { has_contract: "no" })?.label).toBe("已确认未签");
    expect(evidenceState(contractItem, {})?.label).toBe("尚待核实");
    expect(evidenceState(contractItem, { has_contract: "yes" })?.label).toBe("已有");
    expect(evidenceState({ key: "chat", label: "聊天记录" }, { has_contract: "no" })).toBeNull();
  });

  it("corrects the contract row in the evidence directory", () => {
    expect(evidenceRowState("劳动合同或书面劳务协议", { has_contract: "no" })?.label).toBe("已确认未签");
    expect(contractRowNote({ has_contract: "no" })).toContain("没有签订书面合同");
    expect(evidenceRowState("微信 / 短信聊天记录", { has_contract: "no" })).toBeNull();
    expect(evidenceRowState("劳动合同或书面劳务协议", {})).toEqual({
      label: "尚待核实",
      tone: "neutral",
      note: undefined,
    });
  });

  it("flags periods that only carry a duration", () => {
    expect(periodNeedsDates({ duration_text: "3个月" })).toBe(true);
    expect(periodNeedsDates({ work_start: "2025-03", work_end: "2025-06" })).toBe(false);
    expect(periodNeedsDates({})).toBe(false);
  });
});

describe("fact presentation", () => {
  it("builds location, period and wage summaries", () => {
    expect(locationValue(facts)).toBe("河南 · 郑州市 · 金水区");
    expect(locationValue({})).toBe("待核实");
    expect(periodValue(facts)).toBe("约3个月");
    expect(periodValue({ work_start: "2025-03", work_end: "2025-06" })).toBe(
      "2025-03 至 2025-06",
    );
    expect(wageValue(facts)).toBe("按天，每天350元");
  });

  it("labels evidence from the server catalog", () => {
    expect(evidenceLabels(["chat", "attendance"], catalog)).toBe("微信聊天记录、考勤记录");
    expect(evidenceLabels(["unknown-key"], catalog)).toBe("其他材料");
    expect(evidenceLabels([], catalog)).toBe("待核实");
  });

  it("marks known and unknown rows", () => {
    const rows = factRows(facts, catalog);
    expect(rows.find((row) => row.key === "owed")?.value).toBe("2万元");
    expect(rows.find((row) => row.key === "contract")?.value).toBe("已确认未签");
    expect(rows.find((row) => row.key === "recruiter")?.value).toBe("包工头");
    const empty = factRows({}, catalog);
    expect(empty.every((row) => row.known === false)).toBe(true);
    expect(empty.find((row) => row.key === "contract")?.value).toBe("还没问到");
  });

  it("lists missing checks by label", () => {
    expect(missingChecks({ location: true, owed_amount: false, evidence: false })).toEqual([
      CHECK_LABELS.owed_amount,
      CHECK_LABELS.evidence,
    ]);
  });
});
