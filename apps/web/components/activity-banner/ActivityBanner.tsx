"use client";

import { useState } from "react";
import Image from "next/image";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * 活动 Banner（DD-145 · Figma 8866:155439 · PC 1200×120）
 *
 * 庄家金库页 / 质押页 共用：视觉一致，文案 props 化（走 i18n）。
 * - PC(≥md)：左标签 pill + 双色正文（lead mint 高亮 + body 白）、右世界杯 hero 图带左缘渐变遮罩、右上会话内可关 X
 * - H5(<md)：仅标签 + 正文，撑满容器，无图 / 无遮罩 / 无关闭按钮（用户明确「H5 简单展示，不展示图片」）
 * - 关闭：会话内 useState（不持久化，刷新/重进复现）
 *
 * @figma-hardcoded: #14161a banner-bg / 渐变遮罩终点 — pending design token（介于 bg-secondary #111114 与 bg-tertiary #212124）
 */
interface ActivityBannerProps {
  /** 标签 pill 文案，如「世界杯限时活动」 */
  tag: string;
  /** 正文前段（mint 高亮），如「每日 5 万 ODD」 */
  lead: string;
  /** 正文后段（白），如「注入质押池，按质押份额分配给参与用户」 */
  body: string;
  /** PC hero 图路径（H5 不渲染）；默认共用世界杯 hero */
  heroSrc?: string;
  className?: string;
}

const DEFAULT_HERO = "/images/activity-banner/world-cup-hero.png";

export default function ActivityBanner({
  tag,
  lead,
  body,
  heroSrc = DEFAULT_HERO,
  className,
}: ActivityBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    // @figma-hardcoded: #14161a banner-bg — pending design token（介于 bg-secondary #111114 与 bg-tertiary #212124）
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-16 border border-secondary bg-[#14161a]",
        "h-auto md:h-[120px]",
        className
      )}
    >
      {/* 右侧 hero 图区（PC only）：导出图已裁为 517×120，直接铺满 hero 区 */}
      <div className="pointer-events-none absolute right-0 top-0 hidden h-[120px] w-[517px] md:block">
        <Image
          src={heroSrc}
          alt=""
          aria-hidden="true"
          width={517}
          height={120}
          // sizes ≥ 渲染像素宽（static-assets §11）：hero 固定布局，取图宽 517
          sizes="517px"
          className="absolute inset-0 h-[120px] w-[517px] max-w-none object-cover"
        />
        {/* 左缘渐变遮罩：image → bg 淡出 */}
        {/* @figma-hardcoded: #14161a gradient-mask-end（与 banner-bg 同色）— pending design token */}
        <div className="absolute left-0 top-0 h-full w-[113px] bg-gradient-to-l from-transparent to-[#14161a]" />
      </div>

      {/* 关闭按钮（PC only · 会话内可关）
          尺寸 16×16 来自 Figma 8866:155479（设计明确指定）→ 例外于 mobile-h5 min-h-44px；
          且仅 md:flex 渲染，H5 不显示，无触屏小热区问题 */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        style={{ touchAction: "manipulation" }}
        className="absolute right-[8px] top-[9px] z-10 hidden size-[16px] items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 md:flex"
      >
        <XIcon size={11} weight="bold" className="text-static-white" />
      </button>

      {/* 文案区：H5 静态 padding 流（容器高度 auto）；PC 绝对定位垂直居中 */}
      <div className="flex flex-col items-start gap-[12px] p-[16px] md:absolute md:left-[23px] md:top-1/2 md:w-[505px] md:-translate-y-1/2 md:p-0">
        <span className="inline-flex items-center justify-center rounded-[100px] bg-tag-brand px-[16px] py-[8px] text-[14px] font-medium leading-[18px] text-brand-default">
          {tag}
        </span>
        <p className="text-[20px] font-medium leading-[28px] md:whitespace-nowrap">
          <span className="text-brand-default">{lead}</span>
          {/* text-static-white：banner 底色硬编码深色，须用静态白（text-primary 在浅色主题会翻深色 → 不可见） */}
          <span className="text-static-white"> {body}</span>
        </p>
      </div>
    </div>
  );
}
