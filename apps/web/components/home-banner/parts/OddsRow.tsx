"use client";

import type { BannerItem, TemplateId } from "@/types/home-banner";
import { formatAmount } from "@/lib/decimal";
import CountryFlag from "./CountryFlag";
import HeatFlames from "./HeatFlames";
import GoalsBar from "./GoalsBar";
import SavesPill from "./SavesPill";
import RankMedal from "./RankMedal";
import BetButton from "./BetButton";

interface OddsRowProps {
  item: BannerItem;
  variant: Extract<
    TemplateId,
    | "top_wins_the_world_cup"
    | "top_golden_ball_name"
    | "top_golden_boot_name"
    | "top_golden_glove_name"
  >;
  /** banner_id 短 ID（bnr_xxx），用于构造 BetSelection 的 bannerMeta.bannerId */
  bannerId: string;
  /** 行序（1-based），金球/金靴/金手套渲染奖牌 */
  rank?: 1 | 2 | 3 | 4;
  /** top_golden_boot_name 用：items 中最大 goals，用于归一化进度条 */
  maxGoals?: number;
  /** top_golden_ball_name Bet 按钮橙色渐变覆盖；夺冠盘使用默认黄绿 */
  betGradient?: string;
  /** top_golden_ball_name Bet 按钮文字色覆盖 */
  betTextColor?: string;
}

/**
 * 赔率行（Figma 3109:44199 / 3229:207 / 3231:314）
 * top_wins_the_world_cup: 384×42（名字 + heat flames + odds + Bet 黄绿）
 * top_golden_ball_name: 335×42（奖牌 + 国旗 + 名字 + odds + Bet 橙）
 * top_golden_boot_name: 335×42（奖牌 + 国旗 + 名字 + GoalsBar + odds，无 Bet）
 * top_golden_glove_name: 335×42（奖牌 + 国旗 + 名字 + SavesPill + odds，无 Bet）
 */
export default function OddsRow({
  item,
  variant,
  bannerId,
  rank,
  maxGoals,
  betGradient,
  betTextColor,
}: OddsRowProps) {
  const heat = item.extra.heat ?? 0;
  const goals = item.extra.goals;
  const saves = item.extra.saves;
  const showBet = variant === "top_wins_the_world_cup" || variant === "top_golden_ball_name";
  const showMedal = variant !== "top_wins_the_world_cup" && rank !== undefined;
  const showFlag = !!item.country_code;

  // 夺冠盘精确布局（Figma 3231:421）：384 宽，justify-between 四段
  // [左块 155px: flag + name] [火焰 47px] [odds] [Bet]
  if (variant === "top_wins_the_world_cup") {
    return (
      <div
        className="flex items-center justify-between"
        style={{
          width: 384,
          borderRadius: 20,
          paddingLeft: 8,
          paddingRight: 6,
          paddingTop: 6,
          paddingBottom: 6,
          // @figma-hardcoded: rgba(0,0,0,0.7) → rgba(0,0,0,0.35) odds-row-gradient — pending design token
          background: "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 100%)",
        }}
      >
        <div className="flex items-center" style={{ gap: 13, paddingLeft: 8, width: 155 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            {item.country_code && <CountryFlag code={item.country_code} />}
            <span
              className="font-noto-sc font-bold text-white uppercase whitespace-nowrap"
              style={{ fontSize: 15, lineHeight: 1.8 }}
            >
              {item.name}
            </span>
          </div>
          <HeatFlames heat={heat} />
        </div>
        <span
          className="font-noto-sc font-bold text-white tabular-nums flex-shrink-0"
          style={{ fontSize: 16, lineHeight: 1.8 }}
        >
          {formatAmount(item.odds, 2)}
        </span>
        <BetButton
          item={item}
          templateId={variant}
          bannerId={bannerId}
          gradient={betGradient}
          textColor={betTextColor}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-3"
      style={{
        width: 335,
        height: 42,
        borderRadius: 20,
        // @figma-hardcoded: rgba(0,0,0,0.7) → rgba(0,0,0,0.35) odds-row-gradient — pending design token
        background: "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 100%)",
      }}
    >
      {showMedal && rank && <RankMedal rank={rank} />}

      {showFlag && item.country_code && <CountryFlag code={item.country_code} />}

      <span
        className="font-noto-sc font-bold text-white uppercase truncate flex-1 min-w-0"
        style={{ fontSize: 15 }}
      >
        {item.name}
      </span>

      {variant === "top_golden_boot_name" && goals !== undefined && (
        <GoalsBar goals={goals} maxGoals={maxGoals ?? goals} />
      )}

      {variant === "top_golden_glove_name" && saves !== undefined && <SavesPill saves={saves} />}

      <span
        className="font-noto-sc font-bold text-white tabular-nums flex-shrink-0"
        style={{ fontSize: 16 }}
      >
        {formatAmount(item.odds, 2)}
      </span>

      {showBet && (
        <BetButton
          item={item}
          templateId={variant}
          bannerId={bannerId}
          gradient={betGradient}
          textColor={betTextColor}
        />
      )}
    </div>
  );
}
