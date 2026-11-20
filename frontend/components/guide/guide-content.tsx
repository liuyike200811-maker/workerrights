"use client";

import {
  ClipboardCheck,
  Database,
  ExternalLink,
  FileSearch,
  MessageSquareText,
  Scale,
} from "lucide-react";

import { ScrollStackItem } from "@/components/home/scroll-stack";

export type GuideKey = "how" | "scope" | "sources";

export const GUIDE_MODULES: { key: GuideKey; label: string }[] = [
  { key: "how", label: "工作原理" },
  { key: "scope", label: "服务范围" },
  { key: "sources", label: "官方来源" },
];

const steps = [
  {
    icon: MessageSquareText,
    title: "你用大白话说",
    description: "不用懂法律术语，也不用填长表格。说清楚在哪儿干活、谁欠你多少钱就行。",
  },
  {
    icon: FileSearch,
    title: "Agent 一次问一个问题",
    description: "根据回答逐步追问招工主体、日常管理、工资约定、证据情况，自动整理成案件事实。",
  },
  {
    icon: Scale,
    title: "匹配法律和渠道",
    description: "从国家法律和河南办事规则中检索相关条文，标出适用条件和还需核实的事实。",
  },
  {
    icon: ClipboardCheck,
    title: "照着步骤去办",
    description: "生成行动清单、证据目录和材料整理参考，可复制、可下载；提交仍由你在官方平台完成。",
  },
];

const cities = [
  "郑州市", "开封市", "洛阳市", "平顶山市", "安阳市", "鹤壁市",
  "新乡市", "焦作市", "濮阳市", "许昌市", "漯河市", "三门峡市",
  "南阳市", "商丘市", "信阳市", "周口市", "驻马店市", "济源市",
];

const laws = [
  ["中华人民共和国劳动合同法", "劳动报酬 · 书面合同 · 未签合同时的赔偿争议"],
  ["中华人民共和国劳动争议调解仲裁法", "仲裁受理范围 · 申请时限"],
  ["保障农民工工资支付条例", "工程建设领域 · 工资支付责任主体 · 实名制"],
  ["劳动保障监察条例", "投诉举报 · 责令支付 · 查处时限"],
  ["中华人民共和国法律援助法", "劳动报酬 · 确认劳动关系"],
];

const officialLinks = [
  { label: "国家法律法规数据库", href: "https://flk.npc.gov.cn/" },
  { label: "河南省人社厅", href: "https://hrss.henan.gov.cn/" },
  { label: "中国法律服务网", href: "https://12348.gov.cn/" },
];

export function GuideCard({ module }: { module: GuideKey }) {
  if (module === "how") {
    return (
      <ScrollStackItem id="guide-how" itemClassName="guide-card">
        <div className="guide-card__body">
          <header className="guide-card__head">
            <div>
              <p className="guide-eyebrow">工作原理</p>
              <h3 className="guide-title">
                不是给你一篇<span className="whitespace-nowrap">法律文章</span>，
                是<span className="whitespace-nowrap">陪你走完一段路</span>
              </h3>
            </div>
            <span className="guide-index" aria-hidden="true">01</span>
          </header>
          <p className="guide-lead">
            接待、法律检索、案件分析、行动规划、材料整理参考由不同 Agent 分工完成。每次只问当前最需要的一个问题，
            问清了再往下走。
          </p>
          <div className="guide-steps">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="guide-step">
                  <span className="guide-step__num">0{index + 1}</span>
                  <Icon className="guide-step__icon" aria-hidden="true" />
                  <span className="guide-step__text">
                    <span className="guide-step__name">{step.title}</span>
                    <span className="guide-step__desc">{step.description}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollStackItem>
    );
  }

  if (module === "scope") {
    return (
      <ScrollStackItem id="guide-scope" itemClassName="guide-card guide-card--ink">
        <div className="guide-card__body">
          <header className="guide-card__head">
            <div>
              <p className="guide-eyebrow">服务范围</p>
              <h3 className="guide-title">河南 <span className="whitespace-nowrap">18 个地级市</span>，县区级定位</h3>
            </div>
            <span className="guide-index" aria-hidden="true">02</span>
          </header>
          <p className="guide-lead guide-lead--ink">
            行政区划已录入河南省 18 个地级市及县、县级市、市辖区。维权渠道不会按“每个县区一个机构”套用，
            而是提示你按项目所在地的劳动保障管辖规则，通过 12333 确认具体受理机构。
          </p>
          <div className="guide-cities">
            {cities.map((city, index) => (
              <span
                key={city}
                className={index === 0 ? "guide-city guide-city--hot" : "guide-city"}
              >
                {city}
                {index === 0 && <em>演示</em>}
              </span>
            ))}
          </div>
          <div className="guide-foot">
            <dl className="guide-stats">
              {[
                ["县区级区划", "已录入"],
                ["功能区", "郑州部分录入"],
                ["机构匹配", "按管辖核实"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="guide-note guide-note--ink">
              河南地方政策库中的办事指南、最低工资等条目当前标记为“待核验”，不会被当作最终法律依据。
            </p>
          </div>
        </div>
      </ScrollStackItem>
    );
  }

  return (
    <ScrollStackItem id="guide-sources" itemClassName="guide-card">
      <div className="guide-card__body">
        <header className="guide-card__head">
          <div>
            <p className="guide-eyebrow">官方来源与核验</p>
            <h3 className="guide-title">不靠模型记忆编法条</h3>
          </div>
          <span className="guide-index" aria-hidden="true">03</span>
        </header>
        <p className="guide-lead">
          法律检索来自独立的本地知识库，每条结果都带文件名称、发布机关、条款、官方入口和核验状态。
        </p>
        <ul className="guide-laws" role="list">
          {laws.map(([title, topics]) => (
            <li key={title} className="guide-law">
              <Database aria-hidden="true" />
              <span>
                <span className="guide-law__name">{title}</span>
                <span className="guide-law__desc">{topics}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="guide-foot">
          <div className="guide-links">
            {officialLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="guide-link"
              >
                {item.label}
                <span className="text-[10px] font-medium text-ink-400">官网首页</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="guide-note">
            上面只是每部文件涉及的主题，不是对你案件的结论。时限怎么算、适用多久取决于你的具体事实，
            以官方受理机构的答复为准。
          </p>
        </div>
      </div>
    </ScrollStackItem>
  );
}
