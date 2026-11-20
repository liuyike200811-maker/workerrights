import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { GuideLink } from "@/components/guide/guide-link";

const sources = [
  { label: "国家法律法规数据库", href: "https://flk.npc.gov.cn/" },
  { label: "人力资源社会保障部", href: "https://www.mohrss.gov.cn/" },
  { label: "河南省人力资源和社会保障厅", href: "https://hrss.henan.gov.cn/" },
  { label: "中国法律服务网", href: "https://12348.gov.cn/" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,252,248,0.45),rgba(248,236,226,0.85))] backdrop-blur-sm">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
            让不懂法律的劳动者，也能知道自己的权益、找到正确的维权渠道，并知道具体应该怎么做。
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 text-xs text-ink-600">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-700" />
            本地演示版 · 未部署公网 · 不自动提交官方平台
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">官方信息来源</h3>
          <ul className="mt-3 space-y-2">
            {sources.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-ink-600 transition hover:text-brand-800"
                >
                  {item.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">产品说明</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            <li>
              <GuideLink module="how">工作原理</GuideLink>
            </li>
            <li>
              <GuideLink module="scope">服务范围</GuideLink>
            </li>
            <li>
              <Link href="/cases" className="hover:text-brand-800">我的案件</Link>
            </li>
            <li>法条核验状态：国家法条待逐条核验，河南政策待核验</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs leading-relaxed text-ink-400 sm:px-6">
          免责声明：本产品提供信息整理、法律资料检索和办事路径参考，不构成正式法律意见，不承诺追回工资或胜诉。
          复杂或不确定案件请拨打12348或咨询专业律师。法律条文与地方政策请以官方最新公布为准。
        </div>
      </div>
    </footer>
  );
}
