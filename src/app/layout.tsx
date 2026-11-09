import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "散装记忆与灵感手账 · Personal Memory & Vibe Space",
  description:
    "像发朋友圈一样无脑输入，像拍立得手账本一样温暖的个人散装记忆与灵感空间（支持 IndexedDB 千张大图存储与手机离线直连 DeepSeek）",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "记忆手账",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF6E9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased selection:bg-[#E7D5B4] selection:text-[#2C251E]">
        {children}
      </body>
    </html>
  );
}
