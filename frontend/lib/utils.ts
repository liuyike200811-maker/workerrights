import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(value?: number | null, approximate = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "待核实";
  let text: string;
  if (value >= 10000) {
    text = `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万元`;
  } else {
    text = `${value.toLocaleString("zh-CN")}元`;
  }
  return approximate ? `约${text}` : text;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function statusLabel(status: string): string {
  return (
    {
      collecting: "补充信息中",
      ready: "信息已确认",
      planned: "已生成行动方案",
    }[status] || "本地演示中"
  );
}

export function verificationLabel(status: string): string {
  return (
    {
      verified: "已核验",
      transcribed: "待逐条核验",
      pending: "待核验",
      official_only: "仅官方填写",
      ready: "可填写",
      missing: "待补充",
      verify: "需核对",
    }[status] || "待核验"
  );
}

const CHANNEL_CATEGORY_LABELS: Record<string, string> = {
  labor_supervision: "劳动保障监察",
  official_platform: "国家级线上反映平台",
  hotline: "服务热线",
  industry_authority: "行业主管部门",
  arbitration: "劳动人事争议仲裁",
  legal_aid: "法律援助",
  litigation: "法院诉讼服务",
};

export function channelCategoryLabel(category?: string | null): string {
  if (!category) return "其他渠道";
  return CHANNEL_CATEGORY_LABELS[category] || "其他渠道";
}

export interface EntryLinkInfo {
  label: string;
  hint: string;
}

// 未逐条核验前，官方链接只能是机构首页，不能伪装成具体办理入口。
export function entryLink(verificationStatus?: string | null, name?: string | null): EntryLinkInfo {
  if (verificationStatus === "verified") {
    return { label: "打开办理入口", hint: "该入口已人工核验。" };
  }
  const who = name ? `${name}` : "该机构";
  if (verificationStatus === "pending") {
    return { label: "打开机构官网首页", hint: `${who}的页面结构待核验，具体办理入口请在官网内查找或电话确认。` };
  }
  return {
    label: "打开机构官网首页",
    hint: `${who}的具体办理入口尚未逐条核验，请按官网提示查找。`,
  };
}
