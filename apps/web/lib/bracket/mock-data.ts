// 对决页 Bracket 数据（2026 FIFA World Cup · 真实抽签结果）
//
// 数据来源：2026 FIFA World Cup Final Draw（2025-12-05 · Washington D.C.）
//   + 2026-03 洲际/欧洲附加赛已决出全部 48 队
// 快照日期：2026-06-13（小组赛进行中；淘汰赛对阵未决 → KO 阶段渲染 TBD）
// 来源：https://en.wikipedia.org/wiki/2026_FIFA_World_Cup（各 Group_A … Group_L 子页）
// 说明：分组为官方抽签真实结果，每组 4 队按官方 1-4 号位排列；
//       3 主办国 MX / CA / US 分别为 A1 / B1 / D1。

import type { BracketMatch, BracketTeam, GroupCell, GroupKey, TournamentBracket } from "./types";

// ─── 48 强（按官方分组 A-L 排列，每组 4 队即该组 1-4 号位） ────────────────────
// 注：England 沿用本仓既有 iso2 "gb"（gb.svg）；Scotland / Curaçao 为新增旗帜资源

export const BRACKET_TEAMS: BracketTeam[] = [
  // Group A
  { id: "mx", iso2: "mx", name: "Mexico" },
  { id: "kr", iso2: "kr", name: "South Korea" },
  { id: "cz", iso2: "cz", name: "Czech Republic" },
  { id: "za", iso2: "za", name: "South Africa" },
  // Group B
  { id: "ca", iso2: "ca", name: "Canada" },
  { id: "ba", iso2: "ba", name: "Bosnia and Herzegovina" },
  { id: "qa", iso2: "qa", name: "Qatar" },
  { id: "ch", iso2: "ch", name: "Switzerland" },
  // Group C
  { id: "br", iso2: "br", name: "Brazil" },
  { id: "ma", iso2: "ma", name: "Morocco" },
  { id: "ht", iso2: "ht", name: "Haiti" },
  { id: "sct", iso2: "scotland", name: "Scotland" },
  // Group D
  { id: "us", iso2: "us", name: "USA" },
  { id: "py", iso2: "py", name: "Paraguay" },
  { id: "au", iso2: "au", name: "Australia" },
  { id: "tr", iso2: "tr", name: "Türkiye" },
  // Group E
  { id: "de", iso2: "de", name: "Germany" },
  { id: "cw", iso2: "cw", name: "Curaçao" },
  { id: "ci", iso2: "ci", name: "Ivory Coast" },
  { id: "ec", iso2: "ec", name: "Ecuador" },
  // Group F
  { id: "nl", iso2: "nl", name: "Netherlands" },
  { id: "jp", iso2: "jp", name: "Japan" },
  { id: "se", iso2: "se", name: "Sweden" },
  { id: "tn", iso2: "tn", name: "Tunisia" },
  // Group G
  { id: "be", iso2: "be", name: "Belgium" },
  { id: "eg", iso2: "eg", name: "Egypt" },
  { id: "ir", iso2: "ir", name: "Iran" },
  { id: "nz", iso2: "nz", name: "New Zealand" },
  // Group H
  { id: "es", iso2: "es", name: "Spain" },
  { id: "cv", iso2: "cv", name: "Cape Verde" },
  { id: "sa", iso2: "sa", name: "Saudi Arabia" },
  { id: "uy", iso2: "uy", name: "Uruguay" },
  // Group I
  { id: "fr", iso2: "fr", name: "France" },
  { id: "sn", iso2: "sn", name: "Senegal" },
  { id: "iq", iso2: "iq", name: "Iraq" },
  { id: "no", iso2: "no", name: "Norway" },
  // Group J
  { id: "ar", iso2: "ar", name: "Argentina" },
  { id: "dz", iso2: "dz", name: "Algeria" },
  { id: "at", iso2: "at", name: "Austria" },
  { id: "jo", iso2: "jo", name: "Jordan" },
  // Group K
  { id: "pt", iso2: "pt", name: "Portugal" },
  { id: "cd", iso2: "cd", name: "DR Congo" },
  { id: "uz", iso2: "uz", name: "Uzbekistan" },
  { id: "co", iso2: "co", name: "Colombia" },
  // Group L
  { id: "gb", iso2: "gb", name: "England" },
  { id: "hr", iso2: "hr", name: "Croatia" },
  { id: "gh", iso2: "gh", name: "Ghana" },
  { id: "pa", iso2: "pa", name: "Panama" },
];

const TEAMS_BY_ID: Record<string, BracketTeam> = Object.fromEntries(
  BRACKET_TEAMS.map((t) => [t.id, t])
);

// ─── 12 组官方抽签结果 ────────────────────────────────────────────────────────

const GROUP_KEYS: GroupKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const GROUP_DRAW: Record<GroupKey, string[]> = {
  A: ["mx", "kr", "cz", "za"],
  B: ["ca", "ba", "qa", "ch"],
  C: ["br", "ma", "ht", "sct"],
  D: ["us", "py", "au", "tr"],
  E: ["de", "cw", "ci", "ec"],
  F: ["nl", "jp", "se", "tn"],
  G: ["be", "eg", "ir", "nz"],
  H: ["es", "cv", "sa", "uy"],
  I: ["fr", "sn", "iq", "no"],
  J: ["ar", "dz", "at", "jo"],
  K: ["pt", "cd", "uz", "co"],
  L: ["gb", "hr", "gh", "pa"],
};

export const BRACKET_GROUPS: GroupCell[] = GROUP_KEYS.map((groupKey) => ({
  groupKey,
  teams: GROUP_DRAW[groupKey].map((id) => TEAMS_BY_ID[id]),
}));

// ─── 淘汰赛 32 场比赛 ────────────────────────────────────────────────────────
// 小组赛未决前所有 KO 阶段的 home/awayTeamId 一律为 null（cell 渲染 TBD），
// 仅 R32 cell 携带 groupKey 用于 hover 弹层定位（"该 cell 由组 X 晋级"）
// startsAt 按 2026-06-21 ~ 2026-07-19 推进

const R32_BASE_DATE = new Date("2026-06-21T16:00:00.000Z");
const HOURS_PER_MATCH = 4;

// R32 = 12 组 top-2（24 队）+ 8 个最佳 3rd（8 队）= 32 队 → 16 场
// 用 groupKey 序列充当 16 场的种子标记
const R32_SEED_GROUPS: GroupKey[] = [
  ...GROUP_KEYS, // 12 场：组 A-L 的 top-2 配对
  ...GROUP_KEYS.slice(0, 4), // 4 场：8 个 3rd-place 中前 4 组的种子
];

const R32_MATCHES: BracketMatch[] = R32_SEED_GROUPS.map((groupKey, idx) => ({
  id: `M-R32-${String(idx + 1).padStart(2, "0")}`,
  round: "r32" as const,
  homeTeamId: null,
  awayTeamId: null,
  startsAt: new Date(
    R32_BASE_DATE.getTime() + idx * HOURS_PER_MATCH * 60 * 60 * 1000
  ).toISOString(),
  groupKey,
}));

function makeStub(round: BracketMatch["round"], count: number, baseIso: string): BracketMatch[] {
  const base = new Date(baseIso).getTime();
  return Array.from({ length: count }, (_, idx) => ({
    id: `M-${round.toUpperCase()}-${String(idx + 1).padStart(2, "0")}`,
    round,
    homeTeamId: null,
    awayTeamId: null,
    startsAt: new Date(base + idx * HOURS_PER_MATCH * 60 * 60 * 1000).toISOString(),
  }));
}

const R16_MATCHES = makeStub("r16", 8, "2026-06-29T16:00:00.000Z");
const QF_MATCHES = makeStub("qf", 4, "2026-07-09T20:00:00.000Z");
const SF_MATCHES = makeStub("sf", 2, "2026-07-14T20:00:00.000Z");
const FINAL_MATCHES = makeStub("final", 1, "2026-07-19T20:00:00.000Z");
const BRONZE_MATCHES = makeStub("bronze", 1, "2026-07-18T20:00:00.000Z");

export const BRACKET_MATCHES: BracketMatch[] = [
  ...R32_MATCHES,
  ...R16_MATCHES,
  ...QF_MATCHES,
  ...SF_MATCHES,
  ...FINAL_MATCHES,
  ...BRONZE_MATCHES,
];

// ─── 完整 mock 出口 ───────────────────────────────────────────────────────────

export const MOCK_BRACKET: TournamentBracket = {
  teams: TEAMS_BY_ID,
  groups: BRACKET_GROUPS,
  matches: BRACKET_MATCHES,
  champion: undefined,
  bronze: undefined,
};
