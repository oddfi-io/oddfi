import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { PredictionCardItem } from "./predictionCardData";
import PredictionCardButton from "./PredictionCardButton";

/**
 * Landing §2 单张预测卡（Figma 5655:7058 默认 / 5655:7065 hover）
 *
 * 层级（从下到上）：
 * 1. 斜四边形 frame（描边 + 透明深底） — 450×425 @ top=91
 *    - default 白色描边 → 透明 / hover #28F4D2 → 透明
 * 2. 概念图（trophy / 球员 / 金靴 / 金手套） — 浮在 frame 之上，可出框
 * 3. 标题（28px） — hover 上移 35px
 * 4. 「开始预测 →」按钮 — default 隐藏，hover 渐入
 *
 * hover 动画用 CSS group-hover transition（无状态生命周期 → 不需要 WAAPI，符合 animation.md 例外）
 */
export default function PredictionCard({ item }: { item: PredictionCardItem }) {
  const t = useTranslations("landing.predictions");
  const title = t(`cards.${item.id}`);
  const ctaText = t("cardCta");
  return (
    <Link
      href={`/markets/banner/${item.bannerCode}`}
      data-figma-node="5655:7058"
      aria-label={title}
      className="group relative block h-[516px] w-[450px] shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28F4D2]/60"
    >
      {/* 1. 斜四边形 frame — 底层 */}
      <ParallelogramFrame />

      {/* 2. 概念图 — 浮在 frame 之上，允许出框
         hover 放大 ×1.1（视觉走查后从 1.2 微调）
         注意：外层定位容器有 inline transform: translateX(-50%) 时（Card 1/2/3），
         必须把 scale 放到内层 wrapper，否则 inline transform 会覆盖 Tailwind class transform */}
      <div className="absolute pointer-events-none" style={item.imageContainerStyle}>
        {/* scale wrapper 必须继承 outer 的 flex 居中（Card 4 imageInnerStyle 依赖父级 flex 居中），
           否则塞这层后 inner 旋转图会跌回 top-left=0 */}
        <div className="flex size-full items-center justify-center transition-transform duration-300 ease-out group-hover:scale-[1.1]">
          {item.imageInnerStyle ? (
            <div style={item.imageInnerStyle}>
              <Image
                src={item.imageSrc}
                alt={item.imageAlt}
                fill
                sizes={item.imageSizes ?? "(min-width: 1440px) 450px, 50vw"}
                priority={item.priority}
                className="object-contain"
              />
            </div>
          ) : (
            <Image
              src={item.imageSrc}
              alt={item.imageAlt}
              fill
              sizes={item.imageSizes ?? "(min-width: 1440px) 450px, 50vw"}
              priority={item.priority}
              className="object-contain"
            />
          )}
        </div>
      </div>

      {/* 2.5 卡内底部渐变蒙层（Figma 5655:6911）— 斜四边形内 50% → 100% 由透明渐变到 #0C0C0E
         盖在 image 之上，让奖杯/球员图底部自然渐隐到深色，与标题区融合 */}
      <BottomFadeOverlay />

      {/* 3. 标题（Figma 5655:7063→5655:7127）
         位置（Figma center y 转 top-edge）：default 402.5-18=384.5 / hover 367.5-18=349.5（delta -35）
         line-height 36px 与 Figma 文本 bbox 一致；hover gap = 404 - (384.5-35+36) = 18.5 ≈ 20 ✓
         横向：calc(50%-128px) → calc(50%-112px) = +16px */}
      <div
        data-figma-node="5655:7063"
        className="absolute left-0 right-0 top-[384.5px] z-[1] flex justify-center transition-transform duration-300 ease-out group-hover:translate-x-[16px] group-hover:-translate-y-[35px]"
      >
        <p className="font-noto-sc text-[28px] font-medium leading-[36px] text-[#eeeef4] whitespace-nowrap">
          {title}
        </p>
      </div>

      {/* 4. 开始预测按钮（default y=440 + opacity 0 / hover y=404 + opacity 1，对齐 Figma 5655:7064→5655:7065） */}
      <div className="absolute bottom-[28px] left-1/2 z-[1] -translate-x-1/2 opacity-0 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:-translate-y-[36px]">
        <PredictionCardButton text={ctaText} />
      </div>
    </Link>
  );
}

/**
 * 卡内底部渐变蒙层（Figma 5655:6911）
 * - 形状：跟 ParallelogramFrame 同一斜四边形 path
 * - 渐变：viewBox 中部 (y=212.5) 起 transparent，底部 (y=425) 到 #0C0C0E
 *   对应 Figma 5655:6911 的 top=303.5 height=212.5（卡 frame 内坐标 y=[212.5, 425]）
 * - 渲染顺序在 image 之后、title 之前 → 盖住 image 底部、被 title z[1] 盖住
 */
function BottomFadeOverlay() {
  return (
    <svg
      data-figma-node="5655:6911"
      aria-hidden="true"
      viewBox="0 0 450 425"
      preserveAspectRatio="none"
      className="pointer-events-none absolute left-0 top-[91px] h-[425px] w-[450px]"
    >
      <defs>
        <linearGradient
          id="pc-bottom-fade"
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
        fill="url(#pc-bottom-fade)"
      />
    </svg>
  );
}

/**
 * 斜四边形描边 + 半透明深底（Figma 5655:7059 / 5655:7066）
 * - 路径完全保留 Figma exported path（450×425 viewBox）
 * - 默认 stroke：白色 → 透明（top 60% 高度衰减）
 * - hover stroke：#28F4D2 → 透明
 * - 通过 CSS class 切换两组渐变（同 SVG 内置两个 linearGradient）
 */
function ParallelogramFrame() {
  return (
    <svg
      data-figma-node="5655:7059"
      aria-hidden="true"
      viewBox="0 0 450 425"
      preserveAspectRatio="none"
      className="absolute left-0 top-[91px] h-[425px] w-[450px] pointer-events-none"
    >
      <defs>
        <linearGradient
          id="pc-stroke-default"
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
          id="pc-stroke-hover"
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
        stroke="url(#pc-stroke-default)"
        className="transition-[stroke] duration-[400ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-hover:[stroke:url(#pc-stroke-hover)]"
      />
    </svg>
  );
}
