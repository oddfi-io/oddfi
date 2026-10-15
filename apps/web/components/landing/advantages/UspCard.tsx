"use client";

import Image from "next/image";
import { useId } from "react";
import { useTranslations } from "next-intl";
import type { UspItem } from "./uspData";

/**
 * Landing §3 USP 卡（Figma 5692:6731 Default + 5692:6733 Variant2 / hover）
 *
 * 设计师 v2 资源已在 Figma 内打包 mask + 染色 + 卡背景，前端只需：
 * 1. 渲染满卡 404×505 主图（next/image，hover scale 1.05）
 * 2. 卡内底部 218px 渐变蒙层 + 标题 28px + 描述 18px
 * 3. Hover L 形渐变描边
 */
export type UspCardProps = UspItem & { priority?: boolean };

export default function UspCard({ id, imageSrc, imageAlt, priority }: UspCardProps) {
  const t = useTranslations("landing.advantages.cards");
  const title = t(`${id}.title`);
  const description = t(`${id}.description`);
  // SVG <linearGradient> id 必须全局唯一（多卡同时 mount 否则冲突）
  const gradientId = `usp-pi-stroke-${useId().replace(/:/g, "")}`;

  return (
    <div
      data-figma-node="5692:6731"
      className="group relative h-[505px] w-[404px] shrink-0 overflow-hidden rounded-24"
    >
      {/* 主图 — 满卡 404×505，hover 放大 1.05 */}
      <Image
        src={imageSrc}
        alt={imageAlt}
        width={404}
        height={505}
        priority={priority}
        sizes="404px"
        className="pointer-events-none absolute inset-0 h-full w-full rounded-24 object-cover transition-transform duration-300 ease-out group-hover:scale-105"
      />

      {/* 卡内底部文字蒙层 — 218px gradient transparent → black */}
      <div
        data-figma-node="5692:6728"
        className="absolute inset-x-0 bottom-0 flex h-[218px] flex-col items-start justify-end gap-[12px] bg-gradient-to-b from-transparent to-black to-[84.633%] px-[32px] pb-[40px] pt-[32px]"
      >
        <h3
          // Figma H4: Orbitron Bold 28px / lh 36 / tracking -1
          // 中文回退到 Noto Sans SC Bold
          className="text-[28px] font-bold leading-[36px] tracking-[-0.28px] text-white"
          style={{ fontFamily: "'Orbitron', 'Noto Sans SC', sans-serif" }}
        >
          {title}
        </h3>
        <p className="font-noto-sc text-[18px] leading-[26px] text-white opacity-70">
          {description}
        </p>
      </div>

      {/* Hover 描边 overlay — z-top（对齐 Figma 5692:6733 Variant2 渐变弧形描边）
         路径：左侧 ~30% 高度处渐入 → 左上角弧 → 顶边 → 临近右上角再次渐出消失。
         右侧、底部完全无 stroke。
         实现：拆成 2 段 path，各自挂"沿路径方向"的线性渐变，在 (24,0.5) 处衔接：
         - Path A 左竖 + 左上角弧：Y 渐变 y=170(0)→y=24(1)，corner 用 pad 保持满不透明
         - Path B 顶边：X 渐变 x=24(1)→0.55 仍为 1→x=380(0)，淡出集中在末段 ~45% */}
      {/* @figma-hardcoded: #28F4D2 hover L-shape gradient border — pending design token */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        viewBox="0 0 404 505"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient
            id={`${gradientId}-left`}
            x1="0"
            y1="170"
            x2="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#28F4D2" stopOpacity="0" />
            <stop offset="1" stopColor="#28F4D2" stopOpacity="1" />
          </linearGradient>
          <linearGradient
            id={`${gradientId}-top`}
            x1="24"
            y1="0"
            x2="380"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#28F4D2" stopOpacity="1" />
            <stop offset="0.55" stopColor="#28F4D2" stopOpacity="1" />
            <stop offset="1" stopColor="#28F4D2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 角弧用真正的圆弧 A r=23.5（不是 Q 二次贝塞尔，否则曲线中段距 corner center > 24，会被父级 rounded-24 overflow 裁掉，造成左上角"缺角") */}
        <path
          d="M 0.5,170 V 24 A 23.5 23.5 0 0 1 24,0.5"
          stroke={`url(#${gradientId}-left)`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 24,0.5 H 380"
          stroke={`url(#${gradientId}-top)`}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
