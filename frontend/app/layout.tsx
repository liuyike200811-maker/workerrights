import type { Metadata, Viewport } from "next";

import { GuideProvider } from "@/components/guide/guide-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "工友权益助手 · 遇到劳动权益问题，不用先懂法律",
    template: "%s · 工友权益助手",
  },
  description:
    "面向劳动者的劳动权益助手：用日常语言描述你遇到的纠纷，逐步追问、检索法律、生成行动指南，并帮你整理交给官方平台的材料（不代替你提交）。",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#5f211d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <GuideProvider>{children}</GuideProvider>
      </body>
    </html>
  );
}
