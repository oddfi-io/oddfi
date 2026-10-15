"use client";

import type { CSSProperties, ReactNode } from "react";
import type { HomeBannerData } from "@/types/home-banner";
import BannerFrame from "../BannerFrame";
import BrandTag from "./BrandTag";
import OddsRow from "./OddsRow";

interface OddsListBannerProps {
  data: HomeBannerData;
  /** OddsRow 变体（夺冠 / 金球 / 金靴 / 金手套）；total_goals 不走此壳 */
  variant:
    | "top_wins_the_world_cup"
    | "top_golden_ball_name"
    | "top_golden_boot_name"
    | "top_golden_glove_name";
  background: string;
  /** 标题 inline 样式（fontSize/lineHeight/color 或渐变 backgroundImage） */
  titleStyle: CSSProperties;
  /** 标题大小写 */
  titleTransform?: "capitalize" | "uppercase";
  /** 标题使用渐变填充（自动注入 backgroundClip 三件套） */
  titleGradient?: boolean;
  /** 品牌标签文字色（B3 GOLDEN BALL 为黑，其余白） */
  tagTextColor?: string;
  /** 背景装饰层（B1 斜切 rectangle） */
  backdrop?: ReactNode;
  illustration: string;
  illustrationStyle?: CSSProperties;
  bodyPadding?: { top: number; right: number; bottom: number; left: number };
  rowGap?: number;
  /** Bet 按钮渐变覆盖（B3 橙） */
  betGradient?: string;
  /** Bet 按钮文字色覆盖 */
  betTextColor?: string;
  priority?: boolean;
}

/**
 * 行版 Banner 公共壳（夺冠 / 金球 / 金靴 / 金手套 复用）
 *
 * 各 variant 差异通过 props 注入：
 *   - top_wins_the_world_cup：无 rank、无 maxGoals；backdrop + illustrationStyle + 紧凑 body padding
 *   - top_golden_ball_name：rank=idx+1；Bet 橙色渐变
 *   - top_golden_boot_name：rank + maxGoals 归一化 GoalsBar；无 Bet
 *   - top_golden_glove_name：rank + SavesPill；无 Bet
 */
export default function OddsListBanner({
  data,
  variant,
  background,
  titleStyle,
  titleTransform = "uppercase",
  titleGradient = false,
  tagTextColor,
  backdrop,
  illustration,
  illustrationStyle,
  bodyPadding,
  rowGap,
  betGradient,
  betTextColor,
  priority = false,
}: OddsListBannerProps) {
  const needsRank = variant !== "top_wins_the_world_cup";
  const maxGoals =
    variant === "top_golden_boot_name"
      ? Math.max(...data.items.map((i) => i.extra.goals ?? 0), 1)
      : undefined;

  const resolvedTitleStyle: CSSProperties = titleGradient
    ? {
        ...titleStyle,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }
    : titleStyle;

  return (
    <BannerFrame
      background={background}
      backdrop={backdrop}
      tag={<BrandTag label={data.tag_text} color={data.tag_color} textColor={tagTextColor} />}
      title={
        <h2
          className={`font-poppins font-extrabold whitespace-pre-line ${
            titleTransform === "capitalize" ? "capitalize" : "uppercase"
          }`}
          style={resolvedTitleStyle}
        >
          {data.title}
        </h2>
      }
      illustration={illustration}
      illustrationStyle={illustrationStyle}
      bodyPadding={bodyPadding}
      rowGap={rowGap}
      priority={priority}
    >
      {data.items.map((item, idx) => (
        <OddsRow
          key={item.selection_id}
          item={item}
          variant={variant}
          bannerId={data.banner_id}
          rank={needsRank ? ((idx + 1) as 1 | 2 | 3 | 4) : undefined}
          maxGoals={maxGoals}
          betGradient={betGradient}
          betTextColor={betTextColor}
        />
      ))}
    </BannerFrame>
  );
}
