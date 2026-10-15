"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import TradeStackCard, { type TradeStackCardData } from "./trade/TradeStackCard";

/**
 * §5 Trade Showcase — Figma 4227:195182 (1440×916 root frame)
 *
 * Sticky horizontal scroll：整个 scene（左侧内容 + 卡片 track）随用户向下滚动一起向左横移。
 *
 * Figma 节点坐标（相对 root 4227:195182 左上 = (0,0)）：
 *   - 左侧 4227:195188 (120, 23, 1200×870)
 *     · odd 3D logo 4197:169470 → 全局 (696, 23, 48, 48)
 *     · heading frame 4227:195189 → 全局 (120, 119, 1200, 100)
 *       · h2 4227:195190 → 全局 (504, 119, 432, 64)
 *       · p  4227:195191 → 全局 (490, 199, 459, 20)
 *     · market preview frame 4227:195192 → 全局 (120, 267, 1200, 626)
 *   - 右侧卡片 track 4227:195183 起始 (1523, -3, 2643×922)（在 root 右边**外**）
 *     · card1 (4227:195184) at track (0, 90), 718×861 — 预测下注
 *     · card2 (4227:195185) at track (756, 0), 802×922 — 做市（与 card3 重叠 227px）
 *     · card3 (4227:195186) at track (1331, 53), 676×828 — 质押（与 card4 重叠 120px）
 *     · card4 (4227:195187) at track (1887, 131), 756×889 — 仓位借贷
 *
 * Scene 总宽 = cards track right edge = 1523 + 2643 = 4166
 * Viewport 设计宽 = 1440（root frame）
 * translateX 范围：0 → -(4166 - 1440) = -2726px
 */

const SCENE_W = 4166;
const VIEWPORT_W = 1440;
const TRANSLATE_END = -(SCENE_W - VIEWPORT_W);

// 设计稿总高（pt-[120px] 头部留白 + Figma root 922 内容区，cards top:-3 height:922 占满）
const DESIGN_H = 1042;

// 卡片垂直居中对齐：当视口 > DESIGN_H 时，计算 marginTop 使卡片中心对齐 nav 以下可见区中线
// CARD_CENTER_Y = pt(120) - track.top(3) + trackTop(61) + CARD_H/2(400) = 578
const NAV_H = 80;
const CARD_CENTER_Y = 578;

type TradeStackCardWithLayout = TradeStackCardData & {
  trackLeft: number;
  trackTop: number;
  cardWidth: number;
  cardHeight: number;
};

type CardWithRotation = TradeStackCardWithLayout & { rotate: number };

// 统一卡片 source size — figma metadata 的尺寸差异源于 rotation 后 bounding box
const CARD_W = 600;
const CARD_H = 800;

type CardConfig = Omit<CardWithRotation, "title" | "description" | "pill"> & {
  pillBig?: string; // 仅 split pill 用；single pill 见 pillSingleText
  pillSingleText?: string;
  pillOrder?: "big-first" | "small-first";
  pillType: "single" | "split";
};

const CARD_CONFIGS: CardConfig[] = [
  {
    nodeId: "4227:195184",
    slug: "card1",
    illustration: {
      src: "/images/landing/trade/card1-football-v2.png",
      alt: "3D football",
      width: 119,
      height: 117,
      displaySize: 96,
    },
    pillType: "single",
    pillSingleText: "1X2 · AH · OU",
    gradient:
      "linear-gradient(-35.6054deg, rgba(35, 35, 43, 0.8) 4.6316%, rgba(109, 109, 140, 0.8) 97.6%)",
    badgeSrc: "/images/landing/trade/badge-8.svg",
    href: "/markets",
    trackLeft: 324,
    trackTop: 61,
    cardWidth: CARD_W,
    cardHeight: CARD_H,
    rotate: -8,
  },
  {
    nodeId: "4227:195185",
    slug: "card2",
    illustration: {
      src: "/images/landing/trade/card2-coin.png",
      alt: "3D liquidity",
      width: 144,
      height: 144,
      displaySize: 160,
    },
    pillType: "split",
    pillBig: "180%+",
    pillOrder: "big-first",
    gradient:
      "linear-gradient(144.578deg, rgba(255, 237, 202, 0.8) 5.0736%, rgba(164, 107, 0, 0.8) 97.706%)",
    badgeSrc: "/images/landing/trade/badge-8.svg",
    href: "/liquidity",
    trackLeft: 884,
    trackTop: 61,
    cardWidth: CARD_W,
    cardHeight: CARD_H,
    rotate: 6,
  },
  {
    nodeId: "4227:195186",
    slug: "card3",
    illustration: {
      src: "/images/landing/trade/card3-coin.png",
      alt: "3D lock",
      width: 109,
      height: 144,
    },
    pillType: "split",
    pillBig: "225%+",
    pillOrder: "big-first",
    gradient:
      "linear-gradient(-35.6054deg, rgba(68, 19, 152, 0.8) 4.6316%, rgba(171, 133, 236, 0.8) 97.6%)",
    badgeSrc: "/images/landing/trade/badge-8.svg",
    href: "/stake",
    trackLeft: 1444,
    trackTop: 61,
    cardWidth: CARD_W,
    cardHeight: CARD_H,
    rotate: -6,
  },
  {
    nodeId: "4227:195187",
    slug: "card4",
    illustration: {
      src: "/images/landing/trade/card4-shield.png",
      alt: "3D shield",
      width: 115,
      height: 144,
    },
    pillType: "split",
    pillBig: "50%",
    pillOrder: "small-first",
    gradient:
      "linear-gradient(143.933deg, rgba(164, 213, 176, 0.8) 9.2834%, rgba(27, 91, 42, 0.8) 97.676%)",
    badgeSrc: "/images/landing/trade/badge-8.svg",
    href: "/lend",
    trackLeft: 2004,
    trackTop: 61,
    cardWidth: CARD_W,
    cardHeight: CARD_H,
    rotate: 8,
  },
];

export default function TradeShowcaseSection() {
  const t = useTranslations("landing.tradeShowcase");
  const sectionRef = useRef<HTMLElement>(null);

  const CARDS: CardWithRotation[] = useMemo(
    () =>
      CARD_CONFIGS.map((c) => ({
        ...c,
        title: t(`${c.slug}.title`),
        description: t(`${c.slug}.description`),
        pill:
          c.pillType === "single"
            ? { type: "single", text: c.pillSingleText! }
            : {
                type: "split",
                big: c.pillBig!,
                small: t(`${c.slug}.small`),
                order: c.pillOrder!,
              },
      })),
    [t]
  );

  // 视口 > DESIGN_H 时将卡片组垂直居中于 nav 以下可见区
  const [marginTop, setMarginTop] = useState(0);
  useEffect(() => {
    const update = () => {
      const vh = window.innerHeight;
      setMarginTop(vh >= DESIGN_H ? Math.max(0, (NAV_H + vh) / 2 - CARD_CENTER_Y) : 0);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // 整个 scene 横向平移：0 → -2726px（让 cards track 末尾完整可见）
  const x = useTransform(scrollYProgress, [0, 1], [0, TRANSLATE_END]);

  return (
    <section
      ref={sectionRef}
      data-section="trade-showcase"
      data-figma-node="4227:195182"
      className="relative w-full bg-primary"
      style={{ height: `${CARDS.length * 100}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* 等比缩放壳 — viewport 高度 < 设计稿 DESIGN_H 时整体按高度缩放，避免下半部分被 h-screen 裁掉 */}
        <div
          className="relative mx-auto"
          style={{
            width: VIEWPORT_W,
            height: DESIGN_H,
            transformOrigin: "50% 0",
            transform: `scale(min(1, calc(100vh / ${DESIGN_H}px)))`,
            marginTop,
          }}
        >
          <div className="relative h-full pt-[120px]">
            {/* Scene wrapper — 1440 设计区居中显示，整体由 framer-motion translateX 横移 */}
            <motion.div
              data-figma-node="4227:195182"
              className="relative h-full"
              style={{
                width: SCENE_W,
                left: "50%",
                marginLeft: -VIEWPORT_W / 2, // 让 root frame 1440 区域在 viewport 居中
                x,
              }}
            >
              {/* 左侧内容 4227:195188 (120, 23, 1200×870) */}
              <div
                data-figma-node="4227:195188"
                className="absolute"
                style={{ left: 120, top: 23, width: 1200, height: 870 }}
              >
                {/* odd 3D logo at (576, 0, 48, 48) */}
                <Image
                  src="/images/logo-icon-mint.svg"
                  alt="oddfi"
                  width={48}
                  height={48}
                  data-figma-node="4197:169470"
                  className="absolute"
                  style={{ left: 576, top: 0, width: 48, height: 48 }}
                />

                {/* Heading frame 4227:195189 at (0, 96, 1200, 100) */}
                <div
                  data-figma-node="4227:195189"
                  className="absolute"
                  style={{ left: 0, top: 96, width: 1200, height: 100 }}
                >
                  <h2
                    data-figma-node="4227:195190"
                    className="absolute whitespace-nowrap text-center font-bold leading-[64px] text-white"
                    style={{
                      left: 0,
                      top: 0,
                      width: 1200,
                      height: 64,
                      fontSize: 48,
                    }}
                  >
                    {t("title")}
                  </h2>
                  <p
                    data-figma-node="4227:195191"
                    className="absolute whitespace-nowrap text-center text-secondary"
                    style={{
                      left: 0,
                      top: 80,
                      width: 1200,
                      height: 20,
                      fontSize: 15,
                      lineHeight: "20px",
                    }}
                  >
                    {t("subtitle")}
                  </p>
                </div>

                {/* Market preview frame 4227:195192 at (0, 244, 1200, 626) */}
                <div
                  data-figma-node="4227:195192"
                  className="absolute overflow-hidden rounded-[24px]"
                  style={{ left: 0, top: 244, width: 1200, height: 626 }}
                >
                  <Image
                    data-figma-node="4227:195193"
                    src="/images/landing/market-preview.png"
                    alt="Oddfi market page preview"
                    width={1200}
                    height={627}
                    sizes="1200px"
                    className="object-cover object-top"
                    priority={false}
                  />
                  {/* Bottom gradient mask 4227:195194 at (0, 433, 1200, 197) — fade into bg */}
                  <div
                    data-figma-node="4227:195194"
                    aria-hidden
                    className="pointer-events-none absolute"
                    style={{
                      left: 0,
                      top: 433,
                      width: 1200,
                      height: 197,
                      // @figma-hardcoded: gradient mask — pending design token
                      background: "linear-gradient(180deg, rgba(4, 6, 12, 0) 0%, #04060c 80%)",
                    }}
                  />
                </div>
              </div>

              {/* 卡片 track 4227:195183 (1523, -3, 2643×922) */}
              <div
                data-figma-node="4227:195183"
                className="absolute"
                style={{ left: 1523, top: -3, width: 2643, height: 922 }}
              >
                {CARDS.map((card) => (
                  <div
                    key={card.slug}
                    data-figma-node={card.nodeId}
                    className="absolute"
                    style={{
                      left: card.trackLeft,
                      top: card.trackTop,
                      width: card.cardWidth,
                      height: card.cardHeight,
                      transform: `rotate(${card.rotate}deg)`,
                      transformOrigin: "center center",
                    }}
                  >
                    <TradeStackCard card={card} />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
