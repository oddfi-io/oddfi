"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import CarouselArrowButton from "./CarouselArrowButton";
import UspCard from "./advantages/UspCard";
import { USP_CARDS } from "./advantages/uspData";

const SCROLL_STEP = 428; // 卡片宽 404px + gap 24px

export default function AdvantagesSection() {
  const t = useTranslations("landing.advantages");
  const trackRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (dir: "left" | "right") => {
    trackRef.current?.scrollBy({
      left: dir === "left" ? -SCROLL_STEP : SCROLL_STEP,
      behavior: "smooth",
    });
  };

  return (
    <section data-section="advantages" data-figma-node="4227:195223" className="relative w-full">
      {/* Header — 约束在 1440 内容框内 */}
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-[120px] pb-[40px] pt-[80px]">
        <div className="flex flex-1 flex-col items-start gap-[16px]">
          <h2 className="text-[48px] font-bold leading-[64px] text-primary">{t("title")}</h2>
          <p className="text-[16px] leading-[24px] text-white opacity-70">{t("subtitle")}</p>
        </div>

        {/* 仅在右侧有遮挡时显示按钮 */}
        {hasOverflow && (
          <div className="flex shrink-0 items-start gap-[12px]">
            <CarouselArrowButton
              direction="left"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
            />
            <CarouselArrowButton
              direction="right"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
            />
          </div>
        )}
      </div>

      {/* 卡片轨道 — 全宽可滚动，左侧与内容区对齐，右侧自由延伸到视窗边缘 */}
      <div
        ref={trackRef}
        className="overflow-x-auto pb-[80px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          // 左侧对齐内容区：viewport > 1440px 时居中偏移，否则固定 120px
          paddingLeft: "max(120px, calc((100vw - 1440px) / 2 + 120px))",
        }}
      >
        <div className="flex items-start gap-[24px] pr-[120px]">
          {USP_CARDS.map((u, i) => (
            <UspCard key={u.id} {...u} priority={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
