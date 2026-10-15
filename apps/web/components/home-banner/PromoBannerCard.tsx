"use client";

import { memo, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PROMO_BANNER_THEMES, PROMO_BANNER_CARD_BG } from "@/lib/home-banner-decorations";
import type { HomeBannerData } from "@/types/home-banner";
import PromoBetCta from "./parts/PromoBetCta";

interface PromoBannerCardProps {
  data: HomeBannerData;
  priority?: boolean;
}

/**
 * 推广 banner 卡（DD-143 · 372×162 自然尺寸 · Figma 8487:109828 等）
 *
 * 5 卡收敛为 1 数据驱动组件：布局一致，按 template_id 主题化（标题色/hover 描边/背景/插画）。
 * - 标题取后端 data.title（已本地化），颜色由主题决定（非 text-primary 白，Figma 实测各卡不同）
 * - 整卡 click → router.push 详情页（沿用 ScaledBannerCard 交互契约 + 键盘 a11y）
 * - 插画允许出框（卡根去 overflow-hidden，glow 背景单独 rounded 裁剪层贴合圆角）
 * - hover：金色/绿/蓝描边 + 插画放大 ×1.05，均为纯 CSS transition（无状态生命周期，animation.md 例外，参考 PredictionCard）
 * - 卡底色/描边色/标题色为 Figma 硬编码，待设计补 token（见 home-banner-decorations.ts @figma-hardcoded）
 */
function PromoBannerCard({ data, priority = false }: PromoBannerCardProps) {
  const router = useRouter();
  const theme = PROMO_BANNER_THEMES[data.template_id];

  const handleClick = () => {
    router.push(`/markets/banner/${data.template_id}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // 未知 template_id（后端契约外）→ 不渲染，避免主题 undefined 崩溃
  if (!theme) return null;

  const { illustration } = theme;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Open banner detail: ${data.title}`}
      className="group relative h-[162px] w-[372px] flex-shrink-0 cursor-pointer rounded-[16px] border-2 border-transparent transition-colors duration-200 hover:border-[var(--promo-hover-border)] focus:outline-none focus:ring-2 focus:ring-brand-default"
      style={
        {
          backgroundColor: PROMO_BANNER_CARD_BG,
          "--promo-hover-border": theme.hoverBorderColor,
        } as CSSProperties
      }
    >
      {/* 全卡背景装饰 SVG（themed glow）— 单独 rounded 裁剪层：
         卡根去掉 overflow-hidden 后插画可出框，glow 仍贴合圆角不溢出 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={theme.background}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full"
        />
      </div>

      {/* 标题（最多 2 行，色由主题决定） */}
      <p
        className="absolute left-[19px] top-[26px] line-clamp-2 w-[180px] text-[20px] font-semibold leading-[28px]"
        style={{ color: theme.titleColor }}
      >
        {data.title}
      </p>

      {/* 「去竞猜」CTA */}
      <div className="absolute left-[19px] top-[102px]">
        <PromoBetCta />
      </div>

      {/* 右侧插画（box 居中于卡，不裁切 → 插画出框；img 几何 Figma 实测）
         hover 整体放大 ×1.05：scale 与 -translate-x/y-1/2 同为 Tailwind class transform，
         合成为 translate(-50%,-50%) scale(1.05)，origin=box 中心=锚点，绕锚点缩放不偏移 */}
      <div
        className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-out group-hover:scale-[1.05]${
          illustration.img.center ? " flex items-center justify-center" : ""
        }`}
        style={{
          width: illustration.box.width,
          height: illustration.box.height,
          left: illustration.box.left,
          top: illustration.box.top,
        }}
      >
        <Image
          src={illustration.src}
          alt=""
          width={illustration.img.width}
          height={illustration.img.height}
          // sizes ≥ 渲染像素宽（static-assets §11 防糊）：插画为固定布局，取 img.width
          sizes={`${illustration.img.width}px`}
          priority={priority}
          className={illustration.img.center ? "max-w-none" : "absolute max-w-none"}
          style={{
            // center 模式由父 flex 居中，仅旋转/缩放；否则按 Figma 绝对偏移定位
            ...(illustration.img.center
              ? {}
              : { left: illustration.img.left, top: illustration.img.top }),
            width: illustration.img.width,
            height: illustration.img.height,
            transform: illustration.img.transform,
          }}
        />
      </div>
    </div>
  );
}

// memo：indicator 每 ~2s setActiveIndex 触发 Carousel 重渲染，但 15 张卡 props（data 引用稳定 + priority 布尔）不变
// → memo bailout，避免 15 个子树（含 next/image + useTranslations）无谓重渲染。
export default memo(PromoBannerCard);
