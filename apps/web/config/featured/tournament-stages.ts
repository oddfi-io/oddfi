// ─── Tournament Configuration (DD-052) ──────────────────────────────────
// Drives sidebar tabs + API routing.

export type TournamentKey = "worldcup" | "ucl" | "other";

export interface TournamentConfig {
  key: TournamentKey;
  leagueId: number; // 0 = Other matches (小国比赛聚合，后端按 league=0 识别)
  labelKey: string; // i18n key under "markets.*"
  imagePath: string;
}

export const TOURNAMENT_CONFIGS: TournamentConfig[] = [
  {
    key: "worldcup",
    leagueId: 732,
    labelKey: "worldCup",
    imagePath: "https://cdn.sportmonks.com/images/soccer/leagues/28/732.png",
  },
  // UCL tab 暂停展示：后端不再提供欧冠真实数据，仅保留测试比赛（注入到世界杯列表首项）
  {
    key: "other",
    leagueId: 0,
    labelKey: "otherMatches",
    imagePath: "",
  },
];

/**
 * DD-144：tab 渲染层用的可见配置（主网只保留世界杯，隐藏 Other Match tab）。
 * 仅过滤渲染入口，保留 TOURNAMENT_CONFIGS 与 getTournamentConfig 的数据能力 —— 与 lend/swap
 * 「隐藏入口、保留底层」一致。回归时把 HIDDEN_TOURNAMENT_KEYS 清空即可。
 */
const HIDDEN_TOURNAMENT_KEYS: ReadonlySet<TournamentKey> = new Set<TournamentKey>(["other"]);

export const VISIBLE_TOURNAMENT_CONFIGS: TournamentConfig[] = TOURNAMENT_CONFIGS.filter(
  (t) => !HIDDEN_TOURNAMENT_KEYS.has(t.key)
);

/** Lookup helper: find TournamentConfig by key */
export function getTournamentConfig(key: TournamentKey): TournamentConfig {
  const config = TOURNAMENT_CONFIGS.find((t) => t.key === key);
  if (!config) throw new Error(`[TournamentConfig] Unknown tournament key: ${key}`);
  return config;
}
