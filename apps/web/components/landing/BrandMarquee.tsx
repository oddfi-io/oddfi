import Image from "next/image";

/**
 * §4 品牌跑马灯（Figma 4334:59631 home / 7480:53564 invest variant）
 *
 * 设计：单行水平 marquee，贯穿全屏宽度，从右往左无限循环滚动（165px 高）。
 * 复用 globals.css `oddMarquee` keyframe（0 → translateX(-50%)），`.animate-marquee-slow`（80s）。
 * 内容渲染两组连续序列保证 -50% 处无缝衔接。
 *
 * variant：
 * - "brand"（默认 · home）：mint 底 + 黑字 + 黑星（star-divider.svg）
 * - "transparent"（invest 7480:53564）：透明底 + 白字 + brand 色星（marquee-star.svg）
 */

const VARIANTS = {
  brand: {
    // @figma-hardcoded: #28f4d2 band-bg(text/brand-default) · #04060c text(static-black) — pending token
    band: "bg-[#28f4d2]",
    textColor: "#04060c",
    textSize: "text-[84px]",
    star: "/images/landing/marquee/star-divider.svg",
    starW: 60,
    starH: 70,
    rowH: "h-[70px]",
  },
  transparent: {
    band: "bg-transparent",
    textColor: "#ffffff", // text/primary
    textSize: "text-[64px] md:text-[100px]",
    // @figma-hardcoded: #28f4d2 brand 星 — pending token
    star: "/images/invest/marquee-star.svg",
    starW: 70,
    starH: 82,
    rowH: "h-[82px]",
  },
} as const;

type Variant = keyof typeof VARIANTS;
type VariantCfg = (typeof VARIANTS)[Variant];

const ITEM_PER_GROUP = 6; // 单组内 oddfi+star 重复次数，确保 group 宽度 > 屏幕宽

function MarqueeGroup({ v, ariaHidden = false }: { v: VariantCfg; ariaHidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center gap-[40px]"
      aria-hidden={ariaHidden ? true : undefined}
    >
      {Array.from({ length: ITEM_PER_GROUP }).map((_, i) => (
        <div key={i} className="flex shrink-0 items-center gap-[40px]">
          {/* inline-flex + rowH 让大字号 line-box 通过 flex 中线对齐到 star 同高，在 165px frame 内视觉居中 */}
          <span
            className={`inline-flex ${v.rowH} shrink-0 items-center whitespace-nowrap font-orbitron ${v.textSize} font-bold leading-none`}
            style={{ color: v.textColor }}
          >
            oddfi
          </span>
          <Image
            src={v.star}
            alt=""
            width={v.starW}
            height={v.starH}
            sizes={`${v.starW}px`}
            className="shrink-0"
            aria-hidden
          />
        </div>
      ))}
    </div>
  );
}

export default function BrandMarquee({ variant = "brand" }: { variant?: Variant }) {
  const v = VARIANTS[variant];
  return (
    <section
      data-section="brand-marquee"
      data-figma-node="4334:59631"
      className={`relative w-full overflow-hidden ${v.band}`}
      style={{ height: 165 }}
    >
      {/* 外层 translateY(-50%) 垂直居中（不被动画 transform 覆盖）；内层 animate-marquee-slow 跑 0 → -50% 无缝循环 */}
      <div className="absolute left-0 top-1/2 w-max -translate-y-1/2">
        <div className="flex w-max animate-marquee-slow items-center gap-[40px]">
          <MarqueeGroup v={v} />
          <MarqueeGroup v={v} ariaHidden />
        </div>
      </div>
    </section>
  );
}
