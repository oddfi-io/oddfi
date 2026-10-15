import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IS_PRESALE_ENABLED } from "@/lib/presale/presale-visibility";
import OddPresaleWrapper from "./OddPresaleWrapper";

export const metadata: Metadata = {
  title: "ODD Presale — Token Economics",
  description: "ODD Token presale information, tokenomics, vesting schedule and economic flywheel.",
};

// 凸起区背景云朵 SVG：server 端 fs 读 raw 字符串 inline 注入（复用线上 invest 认购页同一资产）。
// inline 渲染才能让 backdrop-filter 雾化 + feTurbulence 颗粒生效（<img> 会丢失这些滤镜）。
const CLOUD_SVG = fs.readFileSync(
  path.join(process.cwd(), "public/images/invest/subscribe-bg-glow.svg"),
  "utf-8"
);

export default function OddPresalePage() {
  // DD-119 §3.5 page 级兜底：认购仅 prod 上线，testnet 与 middleware 双保险
  if (!IS_PRESALE_ENABLED) notFound();
  return <OddPresaleWrapper cloudSvg={CLOUD_SVG} />;
}
