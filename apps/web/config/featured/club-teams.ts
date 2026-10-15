// ─────────────────────────────────────────────
// 俱乐部精选球队配置（PM 可直接编辑）
//
// key = SportMonks league ID
// value = 球队名关键词数组（用于子串匹配）
//
// 修改指南：
//   新增球队：在对应联赛数组中加一个字符串
//   删除球队：删除对应字符串
//   新增联赛的精选：加一个新的 key-value 对
//   注意：
//     - 关键词需与 SportMonks 返回的 participant.name 子串匹配
//     - 匹配时自动忽略变音符号（如 Atletico 可匹配 Atlético Madrid）
//     - 匹配范围限定在对应 league_id 内，不会跨联赛误命中
//     - T2 联赛（欧冠/欧联）自动继承所有 T1 联赛的精选球队，无需单独配置
//     - 查看实际名称：
//       curl "https://www.oddfi.io/api/sportmonks/fixtures/date/$(date +%Y-%m-%d)?include=participants&filters=fixtureLeagues:{leagueId}"
// ─────────────────────────────────────────────

/** T1 联赛精选球队 */
const T1_FEATURED_TEAMS: Record<number, string[]> = {
  // Premier League — "Big Six"
  8: ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham'],

  // La Liga — 皇马、巴萨、马竞
  564: ['Real Madrid', 'Barcelona', 'Atletico'],

  // Bundesliga — 拜仁、多特
  82: ['Bayern', 'Borussia Dortmund'],

  // Serie A — 米兰双雄、尤文、那不勒斯、国米
  384: ['AC Milan', 'Inter', 'Juventus', 'Napoli'],

  // Ligue 1 — 巴黎
  301: ['Paris Saint'],
}

/** 所有 T1 精选球队关键词（用于 T2 联赛继承） */
const ALL_T1_TEAMS = Object.values(T1_FEATURED_TEAMS).flat()

/** 完整精选球队配置（T1 + T2 继承） */
export const CLUB_FEATURED_TEAMS: Record<number, string[]> = {
  ...T1_FEATURED_TEAMS,
  // Champions League — 参赛队来自 T1 联赛，自动继承
  2: ALL_T1_TEAMS,
  // Europa League — 同理
  5: ALL_T1_TEAMS,
}
