"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import CarouselArrowButton from "../CarouselArrowButton";
import PredictionCard from "./PredictionCard";
import { PREDICTION_CARDS } from "./predictionCardData";

/**
 * §2 Hot Markets 横滚 Carousel（Figma 5639:70361）
 *
 * 标题区：文案 48px bold / lh 64 + 右侧切换按钮
 * 卡区（5639:70361）：5 张 PredictionCard（450×516，gap 20）
 */

const CARD_WIDTH = 450;
const CARD_GAP = 20;
const SCROLL_DELTA = CARD_WIDTH + CARD_GAP;

export default function HotMarketsCarousel() {
  const t = useTranslations("landing.predictions");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateState();
    window.addEventListener("resize", updateState);
    return () => window.removeEventListener("resize", updateState);
  }, []);

  const scrollByDelta = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <>
      {/* 标题 + 按钮 — 1440 内层居中（Figma 5664:2999） */}
      <div className="relative mx-auto h-[116px] w-[1440px]">
        <div className="absolute left-[80px] top-0 flex h-[116px] w-[1360px] items-center justify-between pr-[80px]">
          <h2
            data-figma-node="5639:70334"
            className="whitespace-nowrap font-noto-sc text-[48px] font-bold leading-[64px] text-white"
          >
            {t("sectionTitle")}
          </h2>

          <div className="flex shrink-0 items-start gap-[12px]">
            <CarouselArrowButton
              direction="left"
              onClick={() => scrollByDelta(-SCROLL_DELTA)}
              disabled={!canPrev}
            />
            <CarouselArrowButton
              direction="right"
              onClick={() => scrollByDelta(SCROLL_DELTA)}
              disabled={!canNext}
            />
          </div>
        </div>
      </div>

      {/* 标题与卡片之间 45px gap（- 图片顶部 50px 出框 = 视觉 -5px，让图片头部贴近文案下方） */}
      <div className="h-[45px]" />

      {/* 卡片横滚 — 5 张 450×516；pt-[50px] 给图片顶部 -50 出框留位（避免 overflow-x-auto 隐式裁剪 Y） */}
      <div
        ref={scrollRef}
        onScroll={updateState}
        data-figma-node="5639:70361"
        className="relative z-10 flex h-[566px] w-full items-stretch gap-[20px] overflow-x-auto overflow-y-clip scroll-smooth pt-[50px] px-[80px] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {PREDICTION_CARDS.map((item) => (
          <PredictionCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
