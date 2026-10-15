// ─────────────────────────────────────────────
// 精选赛事评分与展示参数（PM 可直接编辑）
//
// 修改指南：
//   调整 Hero 展示数量：改 HERO_MATCH_LIMIT
//   调整精选门槛：改 MIN_SCORE_FOR_HERO（2=至少一方豪门，3=双方都是豪门）
//   调整世界杯加权：改 WORLD_CUP_BONUS
// ─────────────────────────────────────────────

export const SCORING = {
  /** 双方都是精选球队/国家队 */
  BOTH_FEATURED: 3,
  /** 一方是精选球队/国家队 */
  ONE_FEATURED: 2,
  /** Top 联赛/赛事但非精选球队 */
  TOP_LEAGUE_ONLY: 1,
  /** 不在任何精选配置中 */
  NOT_FEATURED: 0,

  /** 世界杯赛事额外加权（同分时世界杯排前面） */
  WORLD_CUP_BONUS: 0.5,

  /** Hero Carousel 最低展示分数（>= 此分数才进 Hero） */
  MIN_SCORE_FOR_HERO: 2,

  /** Hero Carousel 最大展示数量 */
  HERO_MATCH_LIMIT: 5,
} as const
