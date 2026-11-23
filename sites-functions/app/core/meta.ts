import { EVIDENCE_CATALOG } from "./evidence.ts";
import { KNOWLEDGE_VERSION } from "../knowledge/data.ts";
import { REGION_INDEX } from "./regions.ts";
import type { ProviderInfo } from "./types.ts";

export const QCA_PROVIDER: ProviderInfo = {
  provider_id: "qca",
  display_name: "Qoder Cloud Agents（Agent v1）",
  is_mock: false,
  note: "已配置 Agent v1 工具循环；是否成功调用以具体消息和动作记录为准。分析/行动/表单页面仍使用原有规则模块。",
};

export const SCENES = [
  {
    id: "construction_wage_arrears",
    title: "工资一直没拿到",
    description: "建筑工地、包工头、总包分包场景的欠薪线索整理。",
    status: "available",
    tag: "首期完整支持",
  },
  {
    id: "wage_deduction",
    title: "工资被克扣",
    description: "无故扣款、罚款、少算工天等场景，正在整理法律和办事规则。",
    status: "coming_soon",
    tag: "后续开放",
  },
  {
    id: "overtime",
    title: "加班没有报酬",
    description: "加班费计算和举证规则正在整理。",
    status: "coming_soon",
    tag: "后续开放",
  },
  {
    id: "work_injury",
    title: "工作中受伤",
    description: "工伤认定、劳动能力鉴定和赔偿路径复杂，首期暂不开放。",
    status: "coming_soon",
    tag: "后续开放",
  },
  {
    id: "unfair_dismissal",
    title: "被无故辞退",
    description: "违法解除、经济补偿和仲裁规则正在整理。",
    status: "coming_soon",
    tag: "后续开放",
  },
  {
    id: "other",
    title: "其他劳动权益问题",
    description: "社保、平台就业等场景将在后续版本逐步开放。",
    status: "coming_soon",
    tag: "后续开放",
  },
];

export function metaPayload(): Record<string, unknown> {
  return {
    product_name: "工友权益助手",
    service_region: "河南省",
    scene: "建筑工地欠薪",
    scenes: SCENES,
    cities: Object.values(REGION_INDEX).map((city) => city.name),
    provider: QCA_PROVIDER,
    knowledge_version: KNOWLEDGE_VERSION,
    evidence_catalog: EVIDENCE_CATALOG,
    privacy: {
      session_scoped: true,
      stores_id_card: false,
      asks_for_phone: false,
      file_upload: "本版本不在本产品服务器保存身份证、银行卡或聊天截图原件，官方填报材料请直接在官方平台提交。",
      deletion: "支持在“我的案件”中删除案件及聊天记录。",
    },
    limitations: [
      "首期完整支持河南省建筑工地欠薪场景，其他场景显示为待开放。",
      "不自动登录、不自动提交任何政府平台。",
      "地方条文以工地所在地为准；外省案件不适用河南条文，地点未知时优先提供全国资料。",
      "法律知识库中标注“待核验”的内容不作为最终法律依据；已核验条文以官方原文为准。",
      "本产品不承诺追回工资或胜诉。",
    ],
    disclaimer: "工友权益助手提供信息整理、法律资料检索和办事路径参考，不构成正式法律意见。复杂案件请拨打12348或咨询专业律师。",
  };
}