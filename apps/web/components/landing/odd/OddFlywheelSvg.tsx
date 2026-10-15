"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

/**
 * §7 ODD 增长飞轮（Figma 节点 4197:191026 / 5692:7578）
 *
 * 容器 470×383，6 段青色环（带 drop-shadow 绿光） + 中心文字 + 6 个气泡。
 * 6 个气泡统一 mint 样式（bg + border + text），无高亮/普通区分。
 *
 * 动画：青色环 360° 顺时针无限旋转 18s linear。气泡静止（含文字旋转体验差）。
 */

interface BubbleChipProps {
  text: string;
  style: CSSProperties;
}

type BubbleConfig = {
  key: "userBet" | "demand" | "valueCapture" | "scenarios" | "liquidity" | "experience";
  style: CSSProperties;
};

const BUBBLE_CONFIGS: BubbleConfig[] = [
  { key: "userBet", style: { left: 196, top: 0 } },
  { key: "demand", style: { left: 382, top: 92 } },
  { key: "valueCapture", style: { left: 382, top: 250 } },
  {
    key: "scenarios",
    style: { left: "calc(50% + 7.5px)", top: 343, transform: "translateX(-50%)" },
  },
  { key: "liquidity", style: { left: 0, top: 250 } },
  { key: "experience", style: { left: 14, top: 92 } },
];

export default function OddFlywheelSvg() {
  const t = useTranslations("landing.oddToken");
  return (
    <div data-figma-node="5692:7578" className="relative h-[383px] w-[470px] shrink-0">
      {/* 6 段青色环（rotate-180 与设计基准一致，整体再 360° 慢旋转） */}
      <motion.div
        className="absolute"
        style={{ inset: "14.36% 19.57% 14.62% 22.55%" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, ease: "linear", repeat: Infinity }}
        aria-hidden="true"
      >
        <div className="relative size-full rotate-180">
          <Image
            src="/images/landing/odd-flywheel-ring-v2.svg"
            alt=""
            fill
            sizes="280px"
            className="object-contain"
            priority={false}
          />
        </div>
      </motion.div>

      {/* 中心文字 — 对齐环的视觉中心（左 inset 22.55% 右 19.57%，中心在 51.49%），而非容器 50%
          whitespace-pre-line 渲染 \n：zh 文案为单行原样展示，en 文案带 \n 自动一词一行纵向堆叠。 */}
      <div
        // @figma-hardcoded: white center-text — token text-primary
        className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 whitespace-pre-line text-center text-[20px] font-semibold leading-[28px] text-primary"
        style={{ left: "calc(22.55% + (100% - 22.55% - 19.57%) / 2)" }}
      >
        {t("flywheelCenter")}
      </div>

      {/* 6 气泡 */}
      {BUBBLE_CONFIGS.map((b) => (
        <BubbleChip key={b.key} text={t(`flywheelStages.${b.key}`)} style={b.style} />
      ))}
    </div>
  );
}

function BubbleChip({ text, style }: BubbleChipProps) {
  return (
    <div
      // @figma-hardcoded: rgba(40,244,210,0.1) chip bg, rgba(40,244,210,0.3) chip border — pending design token
      className="absolute flex h-[40px] items-center justify-center rounded-full border border-[rgba(40,244,210,0.3)] bg-[rgba(40,244,210,0.1)] px-[16px] py-[10px]"
      style={style}
    >
      <span
        // @figma-hardcoded: #28f4d2 chip text — pending design token
        className="whitespace-nowrap text-center text-[14px] font-medium leading-[18px] text-[#28f4d2]"
      >
        {text}
      </span>
    </div>
  );
}
