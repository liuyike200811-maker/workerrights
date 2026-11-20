import type { CaseFacts, EvidenceCatalogItem, EvidenceItem } from "@/types/api";

import { formatAmount } from "@/lib/utils";

export const FACT_LABELS: Record<string, string> = {
  location_city: "工作城市",
  location_district: "区/县",
  location_detail: "工地位置",
  project_name: "项目名称",
  developer_name: "建设单位",
  contractor_name: "施工总承包",
  subcontractor_name: "分包/劳务单位",
  work_type: "工种",
  work_start: "开始时间",
  work_end: "结束时间",
  duration_text: "工作时长",
  recruiter_type: "招用方式",
  recruiter_name: "招用人",
  manager_role: "日常管理",
  wage_basis: "工资算法",
  daily_wage: "日工资",
  monthly_wage: "月工资",
  agreed_amount: "约定总额",
  paid_amount: "已支付",
  owed_amount: "拖欠金额",
  has_contract: "书面合同",
  evidence: "已有证据",
  prior_report: "此前反映",
  notes: "补充说明",
};

export function locationValue(facts: CaseFacts): string {
  const parts = [
    facts.location_province === "河南省" ? "河南" : facts.location_province,
    facts.location_city,
    facts.location_district,
    facts.location_detail,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "待核实";
}

export function periodValue(facts: CaseFacts): string {
  if (facts.work_start && facts.work_end) return `${facts.work_start} 至 ${facts.work_end}`;
  if (facts.work_start) return `${facts.work_start} 起`;
  if (facts.duration_text) return `约${facts.duration_text}`;
  return "待核实";
}

// 只说了时长、没说起止日期时，正式陈述里的"约三个月"不能当成日期使用，页面要提醒补。
export function periodNeedsDates(facts: CaseFacts): boolean {
  if (facts.work_start || facts.work_end) return false;
  return Boolean(facts.duration_text || facts.duration_months);
}

export function wageValue(facts: CaseFacts): string {
  const parts: string[] = [];
  if (facts.wage_basis) parts.push(facts.wage_basis);
  if (facts.daily_wage) parts.push(`每天${formatAmount(facts.daily_wage)}`);
  if (facts.monthly_wage) parts.push(`每月${formatAmount(facts.monthly_wage)}`);
  if (facts.unit_price) parts.push(`单价${formatAmount(facts.unit_price)}`);
  return parts.length ? parts.join("，") : "待核实";
}

export function evidenceLabels(keys: string[] | undefined, catalog: EvidenceCatalogItem[]): string {
  if (!keys?.length) return "待核实";
  const map = new Map(catalog.map((item) => [item.key, item.label]));
  return keys.map((key) => map.get(key) || "其他材料").join("、");
}

export function factRows(facts: CaseFacts, catalog: EvidenceCatalogItem[]) {
  return [
    { key: "location", label: "工作地点", value: locationValue(facts), known: Boolean(facts.location_city) },
    { key: "work_type", label: "工种", value: facts.work_type || "待核实", known: Boolean(facts.work_type) },
    { key: "period", label: "工作时间", value: periodValue(facts), known: Boolean(facts.work_start || facts.duration_text) },
    { key: "wage", label: "工资约定", value: wageValue(facts), known: Boolean(facts.wage_basis || facts.daily_wage || facts.monthly_wage) },
    {
      key: "owed",
      label: "目前欠薪",
      value: facts.owed_amount ? formatAmount(facts.owed_amount, facts.owed_amount_approx) : "待核实",
      known: Boolean(facts.owed_amount),
      highlight: Boolean(facts.owed_amount),
    },
    {
      key: "contract",
      label: "书面合同",
      value:
        facts.has_contract === "yes"
          ? "已签"
          : facts.has_contract === "no"
            ? "已确认未签"
            : "还没问到",
      known: Boolean(facts.has_contract),
    },
    {
      key: "recruiter",
      label: "招用/管理",
      value:
        facts.recruiter_type && facts.recruiter_type === facts.manager_role
          ? facts.recruiter_type
          : [facts.recruiter_type, facts.manager_role].filter(Boolean).join(" / ") || "待核实",
      known: Boolean(facts.recruiter_type || facts.manager_role),
    },
    {
      key: "evidence",
      label: "已有证据",
      value: evidenceLabels(facts.evidence, catalog),
      known: Boolean(facts.evidence?.length || facts.evidence_status),
    },
  ];
}

export const CHECK_LABELS: Record<string, string> = {
  location: "工作地点",
  work_type: "工种",
  period: "工作时间",
  recruiter: "招用主体",
  manager: "日常管理",
  wage_basis: "工资算法",
  amounts: "工资金额",
  owed_amount: "欠薪金额",
  paid_amount: "已支付金额",
  agreed_amount: "约定总额",
  contract: "书面合同",
  evidence: "证据材料",
};

const OPTIONAL_QUESTION_LABELS: Record<string, string> = {
  district: "区/县",
  project_info: "项目名称与总包单位",
  prior_report: "此前是否反映过",
  owed_confirm: "欠款金额复核",
  confirm: "信息确认",
};

export function checkLabel(key: string): string {
  return CHECK_LABELS[key] || OPTIONAL_QUESTION_LABELS[key] || "其他信息";
}

export function missingChecks(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, done]) => !done)
    .map(([key]) => checkLabel(key));
}

export type ContractState = "signed" | "not-signed" | "unknown";

export function contractState(facts: CaseFacts): ContractState {
  if (facts.has_contract === "yes") return "signed";
  if (facts.has_contract === "no") return "not-signed";
  return "unknown";
}

export interface EvidenceStateBadge {
  label: string;
  tone: "success" | "warning" | "neutral";
  note?: string;
}

// 合同是否签署，用户说得出口时就是"已确认未签"，不能和"没问到"混成同一句话。
export function evidenceState(item: EvidenceItem, facts: CaseFacts): EvidenceStateBadge | null {
  if (item.key !== "contract") return null;
  const state = contractState(facts);
  if (state === "not-signed") {
    return {
      label: "已确认未签",
      tone: "warning",
      note: "这是你本人说明的情况，不是遗漏项；下面按“已有材料之外还需要什么”来看。",
    };
  }
  if (state === "signed") {
    return { label: "已有", tone: "success", note: "你已说明签了书面合同，请准备好原件或照片。" };
  }
  return { label: "尚待核实", tone: "neutral" };
}

// 证据目录里合同那一行由后端只给文案，这里按材料名识别，用本人回答纠正"未确认存在"的说法。
export function evidenceRowState(label: string, facts: CaseFacts): EvidenceStateBadge | null {
  if (!label.includes("合同")) return null;
  return evidenceState({ key: "contract", label }, facts);
}

export function contractRowNote(facts: CaseFacts): string {
  const state = contractState(facts);
  if (state === "not-signed") return "你已说明双方没有签订书面合同，这里按“没有合同”整理，不是漏问。";
  if (state === "signed") return "你已说明签了书面合同，请准备原件或照片。";
  return "有没有书面合同还没有问到，可以在对话里补充。";
}
