"use client";

// DD-095 Bracket 页客户端编排器
// 响应式：lg+ 渲染 PC 主树（5 列），lg- 渲染 H5（Switcher + Group/Bracket 子视图）
// Hover 状态由本组件托管，向下透传给 R32 cell + 12 组小组卡，向 Portal 弹层提供 trigger rect
// 缩放：PC 视图宽度不足时用 transform: scale() 等比缩小，避免内容被遮挡

import { useCallback, useEffect, useRef, useState } from "react";

// xl (≥1280px)：侧边小组列 118px×2 可见 → 总宽 118+24+442+24+420+24+442+24+118 = 1636px
// lg (1024-1279px)：侧边列 display:none → 总宽 442+24+420+24+442 = 1352px
// 高度：pt-48 + max(mt-31+h-996 侧边列, mt-29+h-996 树列) + pb-24 = 48+1027+24 = 1099px
const NATURAL_WIDTH_XL = 1636;
const NATURAL_WIDTH_LG = 1352;
const NATURAL_HEIGHT = 1099;

import BracketGroupCard from "@/components/bracket/BracketGroupCard"; // ensure tree-shake retains shared component types
import BracketGroupHoverCard from "@/components/bracket/BracketGroupHoverCard";
import BracketBronzeWinner from "@/components/bracket/desktop/BracketBronzeWinner";
import BracketChampionCenter from "@/components/bracket/desktop/BracketChampionCenter";
import BracketGroupSideColumn from "@/components/bracket/desktop/BracketGroupSideColumn";
import BracketTreeDesktop from "@/components/bracket/desktop/BracketTreeDesktop";
import BracketGroupView from "@/components/bracket/mobile/BracketGroupView";
import BracketSwitcher from "@/components/bracket/mobile/BracketSwitcher";
import BracketTreeMobile from "@/components/bracket/mobile/BracketTreeMobile";
import ContentTypeTabs from "@/components/game-markets/ContentTypeTabs";
import { MOCK_BRACKET } from "@/lib/bracket/mock-data";
import type { GroupKey } from "@/lib/bracket/types";

void BracketGroupCard; // explicit reference to silence unused-import linter

export default function BracketPageClient() {
  const finalMatch = MOCK_BRACKET.matches.find((m) => m.round === "final");
  const bronzeMatch = MOCK_BRACKET.matches.find((m) => m.round === "bronze");

  const [hoverGroupKey, setHoverGroupKey] = useState<GroupKey | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

  const handleHoverStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, groupKey: GroupKey) => {
      setHoverGroupKey(groupKey);
      setHoverRect(e.currentTarget.getBoundingClientRect());
    },
    []
  );

  const handleHoverEnd = useCallback(() => {
    setHoverGroupKey(null);
    setHoverRect(null);
  }, []);

  const [mobileMode, setMobileMode] = useState<"group" | "bracket">("group");

  // 缩放逻辑：监听容器宽度变化，等比缩放以防止内容被遮挡
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [bracketScale, setBracketScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      // 两侧各 56px padding，内容可用宽度需扣掉
      const available = el.offsetWidth - 56 * 2;
      const naturalWidth = window.innerWidth >= 1280 ? NATURAL_WIDTH_XL : NATURAL_WIDTH_LG;
      setBracketScale(Math.min(1, available / naturalWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      {/* H5 视图（md 及以下） */}
      <div className="lg:hidden flex flex-col gap-[16px] px-[16px] py-[16px]">
        <ContentTypeTabs />
        <div className="flex justify-center">
          <BracketSwitcher mode={mobileMode} onChange={setMobileMode} />
        </div>
        {mobileMode === "group" ? <BracketGroupView /> : <BracketTreeMobile />}
      </div>

      {/* PC 视图（lg 及以上）
          外层：测量可用宽度 + overflow:hidden；宽度不足时压缩高度使页面不留空白
          内层：5 列 flex，宽度不足时等比缩放（transform-origin: top center） */}
      <div
        ref={wrapperRef}
        className="hidden lg:flex justify-center overflow-hidden px-[56px]"
        style={bracketScale < 1 ? { height: Math.round(NATURAL_HEIGHT * bracketScale) } : undefined}
      >
        <div
          className="flex flex-row items-start flex-shrink-0 gap-[24px] pt-[48px] pb-[24px]"
          style={
            bracketScale < 1
              ? { transform: `scale(${bracketScale})`, transformOrigin: "top center" }
              : undefined
          }
        >
          <div className="mt-[31px]">
            <BracketGroupSideColumn
              side="left"
              onMouseEnter={handleHoverStart}
              onMouseLeave={handleHoverEnd}
            />
          </div>
          <div className="mt-[29px]">
            <BracketTreeDesktop
              side="left"
              bracket={MOCK_BRACKET}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          </div>
          {/* 中央列：标题 → chip lg → trophy → 130px spacer → BRONZE WINNER → chip md（Figma 整页 4474:166853 精确还原） */}
          <div className="flex flex-col items-center flex-shrink-0">
            <BracketChampionCenter finalMatch={finalMatch} />
            <div className="h-[130px]" aria-hidden />
            <BracketBronzeWinner bronzeMatch={bronzeMatch} />
          </div>
          <div className="mt-[29px]">
            <BracketTreeDesktop
              side="right"
              bracket={MOCK_BRACKET}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          </div>
          <div className="mt-[31px]">
            <BracketGroupSideColumn
              side="right"
              onMouseEnter={handleHoverStart}
              onMouseLeave={handleHoverEnd}
            />
          </div>
        </div>
      </div>

      <BracketGroupHoverCard
        groupKey={hoverGroupKey}
        triggerRect={hoverRect}
        visible={hoverGroupKey !== null}
      />
    </>
  );
}
