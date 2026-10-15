// Banner item → BetSelection 字段映射（DD-085 §3.5 决策 #12）
//
// banner 投注（夺冠盘 / 球员特殊盘 / MVP 投票 / 金靴 / 金手套）不绑定具体 fixture，
// BetSelection 接口为 SportMonks fixture 投注设计，本映射用占位字段填 fixture 相关字段，
// 让 BetSlip 视觉显示得到，banner 专属 selection 在 id 前缀加 "banner-{bannerId}-" 与 fixture selection 隔离。
//
// Phase 3 接入 banner_bet_place 真接口时，BetSlip Place Bet 入口需要按 selection.id 前缀分流，
// banner-* selection 走 banner_bet_place，fixture selection 走现有 placeBet。

import type { BetSelection, BannerMarket } from "@/types/betting";
import type { BannerItem, TemplateId } from "@/types/home-banner";

const MARKET_DESC: Record<TemplateId, string> = {
  top_wins_the_world_cup: "Champion Winner",
  total_goals: "Player Total Goals",
  top_golden_ball_name: "MVP Player",
  top_golden_boot_name: "Top Scorer",
  top_golden_glove_name: "Best Goalkeeper",
};

// 后端 banner_bet_place 文档要求的玩法枚举（DD-085 §3.5 #12）
const BANNER_MARKET: Record<TemplateId, BannerMarket> = {
  top_wins_the_world_cup: "champion_winner",
  total_goals: "total_goals",
  top_golden_ball_name: "golden_ball",
  top_golden_boot_name: "golden_boot",
  top_golden_glove_name: "golden_glove",
};

const LEAGUE_NAME = "2026 FIFA World Cup";

export function bannerItemToBetSelection(
  item: BannerItem,
  templateId: TemplateId,
  bannerId: string,
  /** Banner 主标题（如 "WHO WINS THE WORLD CUP ?"），BetCard 顶部展示；缺省时回退到玩法描述 */
  bannerTitle?: string
): BetSelection {
  // 2026-04-27 后端契约统一为 int64 — 直接透传，banner_bet_place 服务端校验 > 0
  return {
    id: `banner-${bannerId}-${item.selection_id}`,
    oddId: 0, // banner 不绑定 SportMonks odd_id（占位）
    fixtureId: 0, // 不绑定 fixture（占位）
    fixtureName: bannerTitle ?? MARKET_DESC[templateId],
    leagueName: LEAGUE_NAME,
    marketType: "1x2", // 占位（BetSelection.marketType 类型限定为枚举，沿用最简的 1x2）
    marketDescription: MARKET_DESC[templateId],
    selection: item.name,
    displayLabel: item.name,
    odds: String(item.odds),
    bannerMeta: {
      bannerId,
      marketId: item.market_id,
      selectionId: item.selection_id,
      market: BANNER_MARKET[templateId],
      countryCode: item.country_code,
    },
  };
}

/** 判断一个 selection 是否来自 banner（用于 BetSummary 分流到 placeBannerBet） */
export const isBannerSelection = (s: BetSelection): boolean => Boolean(s.bannerMeta);
