// Banner 下注流水 meta 映射 — 临时方案
//
// 后端 LedgerEventInfo 当前不含 banner_title / banner_image 字段，
// portfolio Active / Settled 列表想要按 Figma 3471:72197 渲染 banner 行卡，
// 需要从 event_info.market_type （= banner_market 枚举：champion_winner / golden_ball
// / golden_boot / golden_glove / total_goals）映射到展示标题。
//
// TODO(banner-meta): 后端在 LedgerEventInfo 增加 banner_title 字段后，
// portfolio adapter 直接消费后端字段，本文件可整体删除。

import type { BannerMarket } from "@/types/betting";

/** market_type → banner 主标题（用于 PortfolioBannerCell 标题展示） */
const TITLE_BY_MARKET: Record<BannerMarket, string> = {
  champion_winner: "2026 FIFA World Cup Winner",
  golden_ball: "World Cup MVP",
  golden_boot: "World Cup Top Scorer",
  golden_glove: "World Cup Best Goalkeeper",
  total_goals: "Player Total Goals",
};

/**
 * 由 event_info.market_type 推断 banner 标题。
 * 未识别的 market_type → 返回 null（调用方应回退到 selection 文本，避免 UI 空白）。
 */
export function bannerTitleFromMarket(market: string): string | null {
  return TITLE_BY_MARKET[market as BannerMarket] ?? null;
}
