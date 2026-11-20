import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowUpRight,
  Database,
  FolderOpen,
  LockKeyhole,
  MapPin,
  Route,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from "lucide-react";

import { DemoCaseButton, StartCaseButton } from "@/components/home/start-actions";
import { NavGallery } from "@/components/home/nav-gallery";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-brand-950 text-white">
          <Image
            src="/images/hero-labor-rights.jpg"
            alt="插画：劳动权益，法律守护。劳动者与法律工作者站在天平与法槌前，白鸽掠过天际。"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[58%_30%] sm:object-[50%_32%]"
          />

          <div
            className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-transparent"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-brand-950/85 via-brand-950/35 to-transparent"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(120%_95%_at_6%_92%,rgba(43,14,12,0.82)_0%,rgba(43,14,12,0.45)_42%,transparent_70%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(59,20,17,0.35)_100%)]"
            aria-hidden="true"
          />

          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="hero-ribbon bottom-[-16%] left-[-12%] h-[36%] w-[78%] rounded-[100%] bg-gradient-to-r from-brand-500/45 via-brand-400/30 to-transparent" />
            <div
              className="hero-ribbon bottom-[-10%] right-[-18%] h-[30%] w-[62%] rounded-[100%] bg-gradient-to-l from-brand-400/40 via-brand-500/25 to-transparent"
              style={{ animationDuration: "34s", animationDelay: "-9s" }}
            />
            <div
              className="hero-ribbon left-[-8%] top-[-12%] h-[26%] w-[44%] rounded-[100%] bg-gradient-to-r from-brand-600/35 via-brand-500/20 to-transparent"
              style={{ animationDuration: "30s", animationDelay: "-16s" }}
            />
            <div className="hero-sheen absolute inset-x-[-20%] bottom-0 h-1/2 bg-[linear-gradient(105deg,transparent_38%,rgba(255,247,237,0.16)_50%,transparent_62%)]" />
          </div>

          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <Dove
              className="left-[74%] top-[15%] h-6 w-10 sm:h-7 sm:w-12"
              style={{ animationDelay: "-4s", "--dove-opacity": "0.9" } as CSSProperties}
            />
            <Dove
              className="left-[88%] top-[29%] h-4 w-7"
              style={{ animationDelay: "-17s", animationDuration: "36s", "--dove-opacity": "0.8" } as CSSProperties}
            />
            <Dove
              className="left-[62%] top-[9%] h-3.5 w-6"
              style={{ animationDelay: "-26s", animationDuration: "42s", "--dove-opacity": "0.65" } as CSSProperties}
            />
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-brand-950 via-brand-950/85 to-transparent sm:h-36"
          />

          <div className="relative z-10 mx-auto flex min-h-[82svh] max-w-6xl flex-col justify-end px-4 pb-12 pt-32 sm:px-6 sm:pb-16 lg:min-h-[calc(100svh-4rem)] lg:pb-20">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/25 bg-white/10 text-white backdrop-blur-sm">
                  <MapPin className="h-3 w-3" />
                  河南首期 · 劳动权益
                </Badge>
                <span className="text-xs font-medium text-white/60">Hack4Good · 技术向善</span>
              </div>
              <h1 className="mt-5 text-balance text-[2.2rem] font-black leading-[1.06] tracking-[-0.02em] sm:text-5xl lg:text-[3.7rem]">
                不用先懂法律，
                <br />
                说说你遇到的事。
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
                我们一步步问清情况，帮你查条文、理证据、列出可以照着做的步骤。
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-start">
                <StartCaseButton className="[&>button]:bg-[#fffaf5] [&>button]:text-brand-900 [&>button]:shadow-lift [&>button]:hover:bg-white" />
                <DemoCaseButton
                  label="先看虚构演示案件"
                  className="[&>button]:border-white/40 [&>button]:bg-white/10 [&>button]:text-white [&>button]:backdrop-blur-sm [&>button]:hover:bg-white/20"
                />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/75">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  不要求身份证号
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  法律资料附来源
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  仅本浏览器会话可见
                </span>
              </div>
              <div className="mt-5">
                <Link
                  href="/cases"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
                >
                  <FolderOpen className="h-4 w-4" />
                  已有案件？继续查看
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div aria-hidden="true" className="hero-horizon" />

        <section className="bg-[linear-gradient(180deg,rgba(248,241,233,0),rgba(255,252,248,0.55)_55%,rgba(250,236,226,0.35))]">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6">
            {[
              ["5 部", "首期国家法律知识库"],
              ["18 个", "河南地级市，县区级选择"],
              ["4 类", "证据缺口与替代材料提示"],
            ].map(([value, label]) => (
              <div key={label} className="flex items-baseline gap-3">
                <span className="text-xl font-black tracking-tight text-brand-900">{value}</span>
                <span className="text-xs leading-snug text-ink-500">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <NavGallery />

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: UserRoundCheck,
                  title: "不要求身份证号",
                  text: "本产品不收集身份证号、银行卡等敏感信息，实名信息只在官方平台由你本人填写。",
                },
                {
                  icon: LockKeyhole,
                  title: "匿名会话隔离",
                  text: "案件与本浏览器生成的会话标识绑定，其他会话无法读取你的案件。",
                },
                {
                  icon: Trash2,
                  title: "随时删除",
                  text: "可在“我的案件”中删除案件及聊天记录，删除后不可恢复。",
                },
                {
                  icon: ShieldCheck,
                  title: "不自动提交",
                  text: "只辅助整理填报内容，不登录、不代替你向任何政府平台提交材料。",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-card backdrop-blur-sm">
                    <Icon className="h-5 w-5 text-brand-700" />
                    <h3 className="mt-3 text-sm font-bold text-ink-900">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-ink-500">{item.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 overflow-hidden rounded-3xl bg-[linear-gradient(140deg,#3b1411_0%,#5f211d_52%,#782822_100%)] p-6 text-white shadow-lift sm:p-10">
              <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-100">
                    虚构演示案例 · 不涉及真实劳动者
                  </span>
                  <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                    先用一个郑州工地欠薪案例，把流程完整走一遍
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-100">
                    对话追问、案件事实、用工关系图、证据缺口、法律依据、行动步骤和材料整理参考，全部可实际操作。
                    演示中的人物、项目、公司均为虚构。
                  </p>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-brand-200">
                    <span className="inline-flex items-center gap-1.5"><Route className="h-3.5 w-3.5" />对话 → 分析 → 行动 → 材料整理</span>
                    <span className="inline-flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" />支持 DOCX / PDF 导出</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <DemoCaseButton
                    label="打开演示案件"
                    variant="secondary"
                    size="lg"
                    className="[&>button]:bg-white [&>button]:text-brand-950 [&>button]:hover:bg-brand-50"
                  />
                  <StartCaseButton
                    children="直接说我的情况"
                    variant="outline"
                    size="lg"
                    className="[&>button]:border-white/25 [&>button]:bg-transparent [&>button]:text-white [&>button]:hover:bg-white/10"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/70 bg-white/70 px-5 py-4 text-xs leading-relaxed text-ink-500 backdrop-blur-sm">
              <strong className="font-semibold text-ink-700">法律辅助服务免责声明：</strong>
              本产品不是律师事务所，不提供正式法律意见，不承诺追回工资或胜诉。案件分析、法律引用和行动建议仅供参考，
              最终以行政机关、仲裁机构或人民法院认定为准。遇到复杂、紧急或人身安全风险，请及时拨打 110、12348 或联系专业律师。
              <span className="mt-2 block text-ink-400">当前版本为本地开发预览，未部署公网，未接入付费模型 API。</span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Dove({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 22" className={cn("hero-dove", className)} style={style} aria-hidden="true">
      <g className="dove-wings" fill="currentColor">
        <path d="M1 16C6 7 14 4 19.4 9.4c.2.2.4.4.6.6.2-.2.4-.4.6-.6C26 4 34 7 39 16c-8-3-14.5-3-19 0-4.5-3-11-3-19 0Z" />
      </g>
      <ellipse cx="20" cy="16.6" rx="4.4" ry="1.8" fill="currentColor" />
      <path d="M15.8 18 13.6 21.2 18 19.6Z" fill="currentColor" />
    </svg>
  );
}
