// ─────────────────────────────────────────────
// 联赛/赛事配置（PM 可直接编辑）
//
// 修改指南：
//   新增联赛：复制一行，改 id/name/tier/weight
//   删除联赛：删除或注释对应行
//   调整优先级：改 tier 值（1=最高，3=最低）
//   调整排序权重：改 weight 值（同分时数值大的排前面）
//   查询 SportMonks league ID：
//     curl https://www.oddfi.io/api/sportmonks/leagues | jq '.data[] | {id, name}'
// ─────────────────────────────────────────────

/** 赛事场景（可扩展） */
export type CompetitionContext = "club" | "world-cup";
// 未来扩展：| 'euro' | 'copa-america' | 'asian-cup'

/** 联赛/赛事定义 */
export interface LeagueConfig {
  id: number;
  name: string;
  tier: 1 | 2 | 3;
  context: CompetitionContext;
  weight: number; // 联赛固定权重，同分时数值大的排前面
  /** SportMonks country_id；0 = 跨国/国际赛事（UCL/UEL/世界杯） */
  countryId: number;
}

/** T1: 五大联赛（英超 → 西甲 → 德甲 → 法甲 → 意甲） */
export const TIER1_LEAGUES: LeagueConfig[] = [
  { id: 8, name: "Premier League", tier: 1, context: "club", weight: 14, countryId: 462 },
  { id: 564, name: "La Liga", tier: 1, context: "club", weight: 13, countryId: 32 },
  { id: 82, name: "Bundesliga", tier: 1, context: "club", weight: 12, countryId: 11 },
  { id: 301, name: "Ligue 1", tier: 1, context: "club", weight: 11, countryId: 17 },
  { id: 384, name: "Serie A", tier: 1, context: "club", weight: 10, countryId: 251 },
];

/** T2: 欧战 + 强力联赛 */
export const TIER2_LEAGUES: LeagueConfig[] = [
  { id: 2, name: "Champions League", tier: 2, context: "club", weight: 15, countryId: 0 },
  { id: 5, name: "Europa League", tier: 2, context: "club", weight: 9, countryId: 0 },
  // Eredivisie 原 id=1005 为历史错误值，实测后端返回 72（DD-083 Batch 1 探测产出）
  { id: 72, name: "Eredivisie", tier: 2, context: "club", weight: 5, countryId: 38 },
  { id: 462, name: "Primeira Liga", tier: 2, context: "club", weight: 4, countryId: 20 },
];

/** T3: 单国联赛（Other Tab 聚合入口，country chip 过滤） */
export const TIER3_LEAGUES: LeagueConfig[] = [
  { id: 208, name: "Belgian Pro League", tier: 3, context: "club", weight: 3, countryId: 556 },
  { id: 944, name: "Saudi Pro League", tier: 3, context: "club", weight: 3, countryId: 35376 },
  { id: 9, name: "EFL Championship", tier: 3, context: "club", weight: 2, countryId: 462 },
  { id: 567, name: "La Liga 2", tier: 3, context: "club", weight: 2, countryId: 32 },
  { id: 387, name: "Serie B", tier: 3, context: "club", weight: 2, countryId: 251 },
  { id: 600, name: "Süper Lig", tier: 3, context: "club", weight: 3, countryId: 404 },
  { id: 444, name: "Eliteserien", tier: 3, context: "club", weight: 3, countryId: 1578 },
  { id: 573, name: "Allsvenskan", tier: 3, context: "club", weight: 3, countryId: 47 },
  // TODO: MLS (USA 3484) / J2 League (JPN 479) — 后端数据落地后补充
];

/** 世界杯 */
export const WORLD_CUP_LEAGUE: LeagueConfig = {
  id: 732,
  name: "FIFA World Cup 2026",
  tier: 1,
  context: "world-cup",
  weight: 100,
  countryId: 0,
};

export const WORLD_CUP_SEASON_ID = 26618;

/** 世界杯相关联赛 ID（正赛 + 6 大洲预选赛 + 洲际附加赛） */
export const WORLD_CUP_LEAGUE_IDS = new Set([
  732, // World Cup
  720, // WC Qualification Europe
  726, // WC Qualification South America
  717, // WC Qualification Concacaf
  714, // WC Qualification Asia
  711, // CAF World Cup Qualifiers
  723, // WC Qualification Oceania
  729, // WC Qualification Intercontinental Playoffs
]);

/** 欧冠 / 欧联杯联赛 ID */
export const UCL_LEAGUE_IDS = new Set([2, 5]);

/** 热门联赛 ID：Tier 1（五大联赛）+ Tier 2（欧冠/欧联）— 用于 Hot chip 筛选 */
export const FEATURED_LEAGUE_IDS = new Set([
  8,
  564,
  82,
  301,
  384, // Tier 1: 英超/西甲/德甲/法甲/意甲
  2,
  5, // Tier 2: 欧冠/欧联
]);

/** 世界杯资格赛 ID（6 大洲预选赛）— 用于 Qualifiers chip 筛选 */
export const WC_QUALIFIER_LEAGUE_IDS = new Set([
  720, // WC Qualification Europe
  726, // WC Qualification South America
  717, // WC Qualification Concacaf
  714, // WC Qualification Asia
  711, // CAF World Cup Qualifiers
  723, // WC Qualification Oceania
  729, // WC Qualification Intercontinental Playoffs
]);

/** 赔率过滤豁免联赛 ID（世界杯正赛 + 所有预选赛 + 欧冠）— 无赔率时仍显示"待开盘" */
export const ODDS_BYPASS_LEAGUE_IDS = new Set([...WORLD_CUP_LEAGUE_IDS, ...UCL_LEAGUE_IDS]);

/** 所有已配置联赛 */
export const ALL_LEAGUES = [WORLD_CUP_LEAGUE, ...TIER1_LEAGUES, ...TIER2_LEAGUES, ...TIER3_LEAGUES];

/** 联赛权重查找表（按 league_id 索引） */
export const LEAGUE_WEIGHT_MAP: Record<number, number> = Object.fromEntries(
  ALL_LEAGUES.map((l) => [l.id, l.weight])
);
