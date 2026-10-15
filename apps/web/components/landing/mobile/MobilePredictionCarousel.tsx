"use client";

import { useEffect, useRef, useState } from "react";
import { PREDICTION_CARDS } from "../markets/predictionCardData";
import MobilePredictionCard from "./MobilePredictionCard";

/**
 * Figma 6937:64283 — 5 张卡横滚（gap 16，首/末卡 padding 16）
 *
 * scroll-snap-type: x mandatory + scroll-snap-align: start 让滚动停在卡边界
 * 隐藏滚动条；touch-pan-x 让横滚不抢页面纵滚
 *
 * DD-114 R3：H5 没 hover，用"1 号位 active"模拟 PC hover：
 *   - 监听 scroll，找 offset 最接近 PADDING_LEFT 的卡 → 设为 activeId
 *   - 卡 receives isActive prop → 应用 PC hover 视觉（标题上移 / CTA 渐入 / 概念图 1.1 倍 / frame stroke 变 mint）
 *   - 全程 CSS transition（animation.md 例外：状态切换 transition 允许）
 */

const PADDING_LEFT = 16;

export default function MobilePredictionCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string>(PREDICTION_CARDS[0].id);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let rafId = 0;
    let lastId = PREDICTION_CARDS[0].id;
    const update = () => {
      const cards = el.querySelectorAll<HTMLElement>("[data-card-id]");
      const containerLeft = el.getBoundingClientRect().left;
      let bestId = "";
      let minDistance = Infinity;
      cards.forEach((card) => {
        const offset = card.getBoundingClientRect().left - containerLeft;
        if (offset < -10) return;
        const distance = Math.abs(offset - PADDING_LEFT);
        if (distance < minDistance) {
          minDistance = distance;
          bestId = card.dataset.cardId ?? "";
        }
      });
      // guard: scroll 惯性余震常触发 onScroll 但 active 不变，跳 setState 减少调度
      if (bestId && bestId !== lastId) {
        lastId = bestId;
        setActiveId(bestId);
      }
    };

    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    update();
    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      data-figma-node="6937:64283"
      className="flex h-[267px] items-center gap-[16px] overflow-x-auto overflow-y-clip px-[16px] [&::-webkit-scrollbar]:hidden"
      style={{
        scrollbarWidth: "none",
        scrollSnapType: "x mandatory",
        touchAction: "pan-x",
      }}
    >
      {PREDICTION_CARDS.map((item) => (
        <MobilePredictionCard key={item.id} item={item} isActive={item.id === activeId} />
      ))}
    </div>
  );
}
