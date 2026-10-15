import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OddFi AI Agent · Dyson",
  description: "OddFi 体育预测市场 AI 助手 — 设置原型",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
