import Image from "next/image";
import { Link } from "@/i18n/navigation";

export type TradeStackCardData = {
  /** Figma node id, e.g. "4227:195184" */
  nodeId: string;
  /** Card slug for analytics + asset path */
  slug: "card1" | "card2" | "card3" | "card4";
  /** 56px bold title, e.g. 预测下注 */
  title: string;
  /** 28px regular description below title */
  description: string;
  /** 3D illustration src — slot size defaults to 144, override via displaySize */
  illustration: {
    src: string;
    alt: string;
    /** image bounding box — Figma values (used for next/image srcset hints) */
    width: number;
    height: number;
    /** rendered slot size in px (default 144); controls visual size of illustration */
    displaySize?: number;
    /** image top-left offset inside the slot */
    top?: number;
    left?: number;
  };
  /** Pill chip content. Either a single string or [bigText, smallText] split */
  pill:
    | { type: "single"; text: string }
    | { type: "split"; big: string; small: string; order: "big-first" | "small-first" };
  /** Linear gradient background (Figma hardcoded) */
  gradient: string;
  /** Bottom badge — 80×80 SVG (Figma "8" node, actually CTA arrow icon) */
  badgeSrc: string;
  /** Target page href for the CTA badge */
  href: string;
};

type Props = {
  card: TradeStackCardData;
};

/**
 * §5 Trade Stack Card — single card in the Trade Showcase section.
 *
 * Figma source: 4227:195184 (card1) and instances 195185/195186/195187.
 * Pixel-accurate reproduction:
 *   - 圆角 56px / padding 48px / backdrop-blur 24px
 *   - 主容器 flex-col gap-100，分两部分：上方 (3D + 文字) / 下方 badge 80×80
 *   - 上方内层 flex-col gap-80：3D 144×144 slot + 文字块
 *   - 文字块 flex-col gap-24：title 56px Noto Sans SC Bold + (desc + pill) gap-40
 *   - desc 28px Noto Sans SC Regular tracking -0.28
 *   - pill bg rgba(255,255,255,0.15) px-24 py-16 rounded-full, text 24px Bold tracking -0.24
 */
export default function TradeStackCard({ card }: Props) {
  const slotSize = card.illustration.displaySize ?? 144;
  return (
    <div
      data-figma-node={card.nodeId}
      data-card-slug={card.slug}
      className="relative flex h-full w-full flex-col items-start gap-[100px] overflow-clip rounded-[56px] p-[48px] backdrop-blur-[24px]"
      style={{
        // @figma-hardcoded: card gradient bg per Figma — pending design token
        backgroundImage: card.gradient,
      }}
    >
      {/* 上方：3D illustration + 文字块 */}
      <div className="flex w-full flex-1 flex-col items-start gap-[80px] min-h-0">
        {/* 3D illustration slot — 尺寸由 illustration.displaySize 控制（默认 144） */}
        <div className="relative shrink-0" style={{ width: slotSize, height: slotSize }}>
          <Image
            src={card.illustration.src}
            alt={card.illustration.alt}
            fill
            sizes={`${slotSize}px`}
            className="object-contain"
            priority={false}
          />
        </div>

        {/* 文字块 — gap 24 between title and (desc + pill) */}
        <div className="flex w-full flex-1 flex-col items-start gap-[24px] min-h-0">
          <h3 className="font-noto-sc text-[56px] font-bold leading-normal tracking-[-0.56px] text-white">
            {card.title}
          </h3>
          {/* desc + pill — gap 40 */}
          <div className="flex w-full flex-col items-start gap-[40px]">
            <p className="font-noto-sc text-[28px] font-normal leading-normal tracking-[-0.28px] text-white">
              {card.description}
            </p>
            <div
              className="inline-flex items-center rounded-full px-[24px] py-[16px]"
              style={{
                // @figma-hardcoded: rgba(255,255,255,0.15) pill bg — pending design token
                backgroundColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              {card.pill.type === "single" ? (
                <span className="font-noto-sc text-[24px] font-bold leading-normal tracking-[-0.24px] text-white whitespace-nowrap">
                  {card.pill.text}
                </span>
              ) : card.pill.order === "big-first" ? (
                <span className="text-white whitespace-nowrap">
                  <span className="font-noto-sc text-[44px] font-bold leading-normal tracking-[-0.44px]">
                    {card.pill.big}
                  </span>
                  <span className="ml-3 font-noto-sc text-[24px] font-normal leading-normal">
                    {card.pill.small}
                  </span>
                </span>
              ) : (
                <span className="text-white whitespace-nowrap">
                  <span className="font-noto-sc text-[24px] font-normal leading-normal">
                    {card.pill.small}
                  </span>
                  <span className="ml-3 font-noto-sc text-[44px] font-bold leading-normal tracking-[-0.44px]">
                    {card.pill.big}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部 badge — 80×80 (figma 节点 "8"，实际是 CTA arrow icon) */}
      <Link href={card.href} className="relative size-[80px] shrink-0 cursor-pointer">
        <Image
          src={card.badgeSrc}
          alt=""
          fill
          sizes="80px"
          className="object-contain"
          aria-hidden
        />
      </Link>
    </div>
  );
}
