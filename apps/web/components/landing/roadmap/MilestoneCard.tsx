"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export type MilestonePhase = {
  /** 稳定标识（i18n key + 首/末判定） */
  id: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
  /** 阶段编号标签（"第一阶段：启动"） */
  label: string;
  /** 阶段标题（"世界杯首发"） */
  title: string;
  /** Figma 绝对定位（相对 1200 容器） */
  left: number;
  top: number;
  width: number;
  /** Popover 时间（"2026年6月"） */
  month: string;
  /** Popover 子任务（4 条），文案待产品确认 */
  details: string[];
};

const POPOVER_W = 440;
const POPOVER_OFFSET_TOP = 24; // 卡片底部到 popover 顶部的距离

/** 星形 bullet icon — 复用 AiAgentSection "即将上线" badge 内的 ai-sparkle.svg */
function StarBullet() {
  return (
    <div className="relative size-[18px] shrink-0">
      <Image
        src="/images/landing/ai-sparkle.svg"
        alt=""
        fill
        sizes="18px"
        className="object-contain"
        aria-hidden="true"
      />
    </div>
  );
}

export default function MilestoneCard({ phase }: { phase: MilestonePhase }) {
  const [isHover, setIsHover] = useState(false);
  // 50ms 防抖：防止鼠标在 button→bridge→popover 之间移动时闪烁消失
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleEnter = () => {
    clearTimeout(hideTimerRef.current);
    setIsHover(true);
  };

  const handleLeave = () => {
    hideTimerRef.current = setTimeout(() => setIsHover(false), 50);
  };

  // 卡片高度：第一/第五阶段 80px，其他 79px（来自 RoadmapSection 原有规则）
  const cardHeight = phase.id === "phase1" || phase.id === "phase5" ? 80 : 79;

  // popover 左边永远对齐 milestone 按钮左边（图 #1 反馈）
  const popoverLeft = phase.left;

  return (
    <>
      {/* Phase Card 主体 — 绝对定位
          z-10 显式指定卡片层级，让 popover (z-30) 永远在卡片之上，避免 hover 瞬间 popover 落在卡下 */}
      <div
        className="absolute z-10 cursor-pointer"
        style={{
          left: `${phase.left}px`,
          top: `${phase.top}px`,
          width: `${phase.width}px`,
          height: `${cardHeight}px`,
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div
          // @figma-hardcoded: #38393d phase-border — pending design token
          className="relative h-full w-full overflow-hidden rounded-[8px] border border-solid border-[#38393d]"
        >
          {/* 青色高亮层 — w 从 0 → 100% 从左向右填充 */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-full"
            style={{
              // @figma-hardcoded: #28f4d2 brand-default fill — pending design token
              backgroundColor: "#28f4d2",
            }}
            initial={false}
            // 退出走 keyframes 反弹：100% → 0%（碰到左边）→ 8%（反弹回来一下）→ 0%（贴住）
            animate={{ width: isHover ? "100%" : ["100%", "0%", "8%", "0%"] }}
            transition={
              isHover
                ? // 进入：平滑 ease-out，无反弹（慢 30%：0.3 → 0.39）
                  { duration: 0.39, ease: [0.16, 1, 0.3, 1] }
                : // 退出：keyframes bounce — 收回到 0 后小幅反弹再贴住（慢 30%：0.5 → 0.65）
                  { duration: 0.65, times: [0, 0.55, 0.78, 1], ease: "easeOut" }
            }
          />

          {/* 文字层 — 颜色随 hover 切换（青底 → 黑字 / 黑底 → 白字）*/}
          <div className="relative z-10 flex h-full flex-col items-start justify-center gap-[8px] px-[24px]">
            <p
              className="font-noto-sc text-[12px] font-normal leading-none transition-colors duration-200"
              style={{
                // @figma-hardcoded: hover #04060c opacity 70 / default white opacity 40
                color: isHover ? "rgba(4,6,12,0.7)" : "rgba(255,255,255,0.4)",
              }}
            >
              {phase.label}
            </p>
            <p
              className="whitespace-nowrap font-noto-sc text-[20px] font-bold leading-none transition-colors duration-200"
              style={{
                // @figma-hardcoded: hover #04060c / default #f4f5f7
                color: isHover ? "#04060c" : "#f4f5f7",
              }}
            >
              {phase.title}
            </p>
          </div>
        </div>
      </div>

      {/* 透明填充桥 — 覆盖 button 底部到 popover 顶部的间隙，防止鼠标经过时触发 mouseLeave */}
      {isHover && (
        <div
          className="absolute z-20"
          style={{
            left: `${popoverLeft}px`,
            top: `${phase.top + cardHeight}px`,
            width: `${POPOVER_W}px`,
            height: `${POPOVER_OFFSET_TOP}px`,
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        />
      )}

      {/* Popover — Figma 4218:192010 timline
          无入场动画：immediately mount at full opacity，避免淡入过程中
          相邻按钮被透出来给人 z-order 错乱的视觉错觉 */}
      {isHover && (
        <div
          className="absolute z-30"
          style={{
            left: `${popoverLeft}px`,
            top: `${phase.top + cardHeight + POPOVER_OFFSET_TOP}px`,
            width: `${POPOVER_W}px`,
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <div
            // Figma 4218:192010: bg rgba(35,35,43,0.30) + backdrop-blur 24（border 由下方两层 mask span 合成）
            className="relative isolate flex flex-col gap-[32px] rounded-[16px] p-[24px] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] backdrop-blur-[24px]"
            style={{ backgroundColor: "rgba(35, 35, 43, 0.30)" }}
          >
            {/* Layer 1: 4 条 edge linear-gradient 各占 1px 边宽，从对应角端 0.85 alpha 渐变到 50% 处透明 */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[16px]"
              style={{
                padding: 1,
                background: [
                  "linear-gradient(90deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 0 0 / 100% 1px no-repeat",
                  "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 0 0 / 1px 100% no-repeat",
                  "linear-gradient(270deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 100% 100% / 100% 1px no-repeat",
                  "linear-gradient(0deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%) 100% 100% / 1px 100% no-repeat",
                ].join(", "),
                WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />
            {/* Layer 2: TL/BR 角圆形高光 — 补 edge 渐变在 rounded corner 弧线段缺失的那块高光 */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[16px]"
              style={{
                padding: 1,
                background:
                  "radial-gradient(circle 60px at 0% 0%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%), radial-gradient(circle 60px at 100% 100%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
                WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />
            {/* 时间标题 */}
            <h3 className="font-noto-sc text-[28px] font-bold leading-none text-white">
              {phase.month}
            </h3>
            {/* 子任务列表 */}
            <ul className="flex flex-col gap-[16px]">
              {phase.details.map((d) => (
                <li key={d} className="flex items-center gap-[12px]">
                  <StarBullet />
                  <span className="font-noto-sc text-[14px] font-normal leading-[19px] text-white">
                    {d}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
