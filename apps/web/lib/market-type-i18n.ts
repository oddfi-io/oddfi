// TODO: 等后端接口返回标准 market_type 后移除此文件，搜索 @mock-market-type 清理所有引用
// @mock-market-type: 前端 mock market_type i18n 映射

/**
 * 将 marketTag 原始值映射为 i18n 翻译文本。
 * @mock-market-type — 等接口适配后移除
 */

const MARKET_TYPE_KEY_MAP: Record<string, string> = {
  "Fulltime Result": "mtMatchWinner",
  "Match Result": "mtMatchWinner",
  "Match Winner": "mtMatchWinner",
  Handicap: "mtHandicap",
  "Asian Handicap": "mtHandicap",
  "Over/Under": "mtOverUnder",
  "Asian Total": "mtOverUnder",
  "Total Goals": "mtOverUnder",
};

export function translateMarketType(raw: string | undefined, t: (key: string) => string): string {
  if (!raw) return "--";
  const key = MARKET_TYPE_KEY_MAP[raw];
  return key ? t(key) : raw;
}
