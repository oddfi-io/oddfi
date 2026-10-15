// ─────────────────────────────────────────────
// 世界杯精选国家队配置（PM 可直接编辑）
//
// 修改指南：
//   新增国家：在数组中加一个字符串（使用 SportMonks 中的英文国名）
//   删除国家：删除对应字符串
//   更新排名：重新排列数组顺序（仅影响注释可读性，不影响逻辑）
//   注意：
//     - 名称必须与 SportMonks participant.name 子串匹配
//     - 匹配时自动忽略变音符号
//     - 常见差异：USA → "United States"，Iran → "IR Iran"
//     - 世界杯上线前务必用实际 API 数据核对一次：
//       curl "https://www.oddfi.io/api/sportmonks/fixtures/date/2026-06-11?include=participants&filters=fixtureLeagues:732"
// ─────────────────────────────────────────────

export const WORLD_CUP_FEATURED_TEAMS: Record<number, string[]> = {
  // league_id=732 (FIFA World Cup 2026)
  732: [
    // ── FIFA Top 10 ──
    'Spain',
    'Argentina',
    'France',
    'England',
    'Brazil',
    'Portugal',
    'Netherlands',
    'Morocco',
    'Belgium',
    'Germany',
    // ── FIFA 11-20 ──
    'Croatia',
    'Senegal',
    'Italy',
    'Colombia',
    'United States',
    'Mexico',
    'Uruguay',
    'Switzerland',
    'Japan',
    'Iran',
  ],
}
