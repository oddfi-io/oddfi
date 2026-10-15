import Link from "next/link";
import Image from "next/image";
import { useId, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { PredictionCardItem } from "../markets/predictionCardData";

/**
 * Figma 6937:64284 ~ 64304 — H5 单张预测卡（209×240）
 *
 * PC 卡 450×516 → H5 209×240（约 46%）。不用 CSS scale 避免文字模糊。
 *
 * 结构（z 序）：
 *   1. ParallelogramFrame  — 斜四边形 + 渐变描边 + 半透明深底（active 时 stroke #28F4D2）
 *   2. 概念图              — 卡内坐标系绝对定位，可出框（active 时 scale 1.1）
 *   3. BottomFadeOverlay   — 底部渐变蒙层（transparent → #0C0C0E）
 *   4. 标题                — active 时上移到 top 164（inactive 175）
 *   5. CTA 按钮            — 跟随 active 出现：opacity 0/top 215 → opacity 1/top 199
 *                            （等比 PC group-hover: opacity 0→1 + translateY -36）
 *
 * isActive 由 MobilePredictionCarousel 根据滚动位置注入（"1 号位"卡 active）
 * 全程 CSS transition（animation.md 例外条款：纯 transition 不受 WAAPI 限制）
 */

interface H5ImagePos {
  containerStyle: CSSProperties;
  /** 内层 wrapper（用于 transform / 横向溢出裁切） */
  innerStyle?: CSSProperties;
  /** next/image sizes 覆盖（内层溢出需调大值） */
  sizes?: string;
}

// 五张卡的 H5 视图坐标（Figma 6937:64284-64304 转录）
const H5_IMAGE_POS: Record<string, H5ImagePos> = {
  // 6937:64286 image: left=calc(50%-2.21) top=-0.35 w=110.86 h=238.33
  "world-cup-winner": {
    containerStyle: {
      left: "calc(50% - 2.21px)",
      top: -0.35,
      width: 110.86,
      height: 238.33,
      transform: "translateX(-50%)",
    },
    sizes: "120px",
  },
  // 6937:64297 image: w=201.63 h=268.84 top=-12.26
  "ronaldo-goals": {
    containerStyle: {
      left: "calc(50% - 2.21px)",
      top: -12.26,
      width: 201.63,
      height: 268.84,
      transform: "translateX(-50%)",
    },
    sizes: "210px",
  },
  // 6937:64302 image (mvp): w=202.79 h=252.09 top=-12.09，内层 width 186.55% left=-46.71%
  mvp: {
    containerStyle: {
      left: 0,
      top: -12.09,
      width: 202.79,
      height: 252.09,
      overflow: "hidden",
    },
    innerStyle: {
      position: "absolute",
      left: "-46.71%",
      top: 0,
      width: "186.55%",
      height: "100%",
    },
    sizes: "(min-width: 768px) 378px, 380px",
  },
  // 6937:64303 image (golden boot): flex 居中外层 + 内层 150.69×123.06 rotate 156.92 scaleY(-1)
  "top-scorer": {
    containerStyle: {
      left: 11.16,
      top: 6.98,
      width: 186.87,
      height: 172.29,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    innerStyle: {
      width: 150.69,
      height: 123.06,
      position: "relative",
      transform: "rotate(156.92deg) scaleY(-1)",
    },
    sizes: "160px",
  },
  // 6937:64304 image (golden glove): left=38.14 top=6.05 size=163.72
  "best-goalkeeper": {
    containerStyle: { left: 38.14, top: 6.05, width: 163.72, height: 163.72 },
    sizes: "164px",
  },
};

export default function MobilePredictionCard({
  item,
  isActive = false,
}: {
  item: PredictionCardItem;
  isActive?: boolean;
}) {
  const t = useTranslations("landing.predictions");
  const title = t(`cards.${item.id}`);
  const ctaText = t("cardCta");
  const pos = H5_IMAGE_POS[item.id] ?? H5_IMAGE_POS["world-cup-winner"];
  // useId 保证 5 张卡的 SVG <defs> id 在文档内唯一，否则 url(#...) 会引用到第一张卡的 defs
  const uid = useId().replace(/:/g, "");
  const strokeDefaultId = `mpc-stroke-default-${uid}`;
  const strokeActiveId = `mpc-stroke-active-${uid}`;
  const bottomFadeId = `mpc-bottom-fade-${uid}`;

  return (
    <Link
      href={`/markets/banner/${item.bannerCode}`}
      data-figma-node="6937:64284"
      data-card-id={item.id}
      aria-label={title}
      className="group relative shrink-0 block h-[240px] w-[209.302px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28F4D2]/60"
      style={{ scrollSnapAlign: "start" }}
    >
      <ParallelogramFrame
        isActive={isActive}
        defaultId={strokeDefaultId}
        activeId={strokeActiveId}
      />

      {/* 2. 概念图 — active 时 scale 1.1（与 PC group-hover:scale-[1.1] 同步） */}
      <div className="absolute pointer-events-none" style={pos.containerStyle}>
        <div
          className={`flex size-full items-center justify-center transition-transform duration-300 ease-out ${
            isActive ? "scale-[1.1]" : ""
          }`}
        >
          {pos.innerStyle ? (
            <div style={pos.innerStyle}>
              <Image
                src={item.imageSrc}
                alt={item.imageAlt}
                fill
                sizes={pos.sizes ?? "210px"}
                className="object-contain"
              />
            </div>
          ) : (
            <Image
              src={item.imageSrc}
              alt={item.imageAlt}
              fill
              sizes={pos.sizes ?? "210px"}
              className="object-contain"
            />
          )}
        </div>
      </div>

      <BottomFadeOverlay gradientId={bottomFadeId} />

      {/* 4. 标题 — Figma 6937:64289 active=top 164 / 6937:64300 inactive=top 175 */}
      <div
        className={`absolute left-0 right-0 z-[1] flex justify-center transition-[top] duration-300 ease-out ${
          isActive ? "top-[164px]" : "top-[175px]"
        }`}
      >
        <p className="font-noto-sc text-[16px] font-medium leading-[24px] text-[#eeeef4] whitespace-nowrap">
          {title}
        </p>
      </div>

      {/* 5. CTA 按钮 — 跟随 active 动画出现（等比 PC group-hover: opacity 0→1 + translateY -36）
            Figma 6937:64290 size 120.667×32
            left = (209.302 - 120.667) / 2 = 44.32（卡内水平居中） */}
      <div
        className={`absolute z-[1] left-[44.32px] transition-all duration-300 ease-out ${
          isActive ? "top-[199px] opacity-100" : "top-[215px] opacity-0"
        }`}
      >
        <MobileCardCtaButton text={ctaText} />
      </div>
    </Link>
  );
}

/**
 * H5 卡内 CTA 按钮（Figma 6937:64290 / 64291 / 64294）
 *
 * 形状：斜四边形 path（同 PC PredictionCardButton viewBox 181×48 等比缩放到 120.667×32）
 * 字号：12px medium（PC 16px 的 0.75 × Figma 给的精确值）
 * 箭头：16.35×6.33（PC 25.86×10.84 的 0.633 缩放，Figma 6937:64294 实际值）
 */
function MobileCardCtaButton({ text }: { text: string }) {
  return (
    <span
      data-figma-node="6937:64290"
      className="relative inline-block h-[32px] w-[120.667px]"
      style={{ touchAction: "manipulation" }}
    >
      {/* 斜四边形底色（Figma Rectangle 129，#28F4D2 实色） */}
      <svg
        aria-hidden="true"
        viewBox="0 0 181 48"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* @figma-hardcoded: #28F4D2 prediction-card cta — pending design token */}
        <path d="M18 0H181L163 48H0L18 0Z" fill="#28F4D2" />
      </svg>

      {/* 文案 + 斜箭头 */}
      <span className="absolute inset-0 flex items-center justify-center gap-[4px]">
        <span className="font-noto-sc text-[12px] font-medium leading-[18px] text-[#04060c]">
          {text}
        </span>
        <span aria-hidden="true" className="block skew-x-[-4.91deg]">
          <svg
            width="16.35"
            height="6.33"
            viewBox="0 0 25.8627 10.8355"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19.276 0.65C19.276 2.80633 24.3665 5.44185 24.3665 5.44185M24.3665 5.44185C24.3665 5.44185 20.082 7.35859 20.082 10.1855M24.3665 5.44185H0.65"
              stroke="#04060C"
              strokeWidth="1.3"
              strokeLinecap="square"
            />
          </svg>
        </span>
      </span>
    </span>
  );
}

/**
 * 斜四边形描边 + 半透明深底（PC PredictionCard 5655:7059 同 path，H5 缩 viewBox）
 * - 默认 stroke：白色 → 透明
 * - active stroke：#28F4D2 → 透明（与 PC hover stroke 同色）
 * - 400ms transition，弹性 cubic-bezier 与 PC 一致
 */
function ParallelogramFrame({
  isActive,
  defaultId,
  activeId,
}: {
  isActive?: boolean;
  defaultId: string;
  activeId: string;
}) {
  return (
    <svg
      data-figma-node="6937:64285"
      aria-hidden="true"
      viewBox="0 0 450 425"
      preserveAspectRatio="none"
      className="absolute left-0 top-[53.33px] h-[197.674px] w-[209.302px] pointer-events-none"
    >
      <defs>
        <linearGradient
          id={defaultId}
          x1="225"
          y1="0"
          x2="225"
          y2="250.875"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="1" stopColor="#0C0C0E" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={activeId}
          x1="225"
          y1="0"
          x2="225"
          y2="250.875"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#28F4D2" stopOpacity="1" />
          <stop offset="1" stopColor="#28F4D2" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* @figma-hardcoded: #0D0D0F 50% prediction-card frame fill — pending design token */}
      <path
        d="M449.342 0.5L331.102 424.5H0.658203L118.898 0.5H449.342Z"
        fill="#0D0D0F"
        fillOpacity="0.5"
        stroke={`url(#${isActive ? activeId : defaultId})`}
        className="transition-[stroke] duration-[400ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
      />
    </svg>
  );
}

/**
 * 底部渐变蒙层（Figma 6937:64288，同 PC 5655:6911 path）
 */
function BottomFadeOverlay({ gradientId }: { gradientId: string }) {
  return (
    <svg
      data-figma-node="6937:64288"
      aria-hidden="true"
      viewBox="0 0 450 425"
      preserveAspectRatio="none"
      className="pointer-events-none absolute left-0 top-[53.33px] h-[197.674px] w-[209.302px]"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="225"
          y1="212.5"
          x2="225"
          y2="425"
          gradientUnits="userSpaceOnUse"
        >
          {/* @figma-hardcoded: #0C0C0E bottom fade — pending design token */}
          <stop offset="0%" stopColor="#0C0C0E" stopOpacity="0" />
          <stop offset="100%" stopColor="#0C0C0E" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        d="M449.342 0.5L331.102 424.5H0.658203L118.898 0.5H449.342Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
