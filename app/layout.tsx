import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
    title: "wymcxvsure｜学习倒计时与每日证据",
    description: "进入横屏学习画面，用倒计时守住眼前这一小段，再留下一条真实行动证据。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "wymcxvsure",
      description: "别等状态，先进入画面。",
      type: "website",
    },
    twitter: { card: "summary", title: "wymcxvsure", description: "别等状态，先进入画面。" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
