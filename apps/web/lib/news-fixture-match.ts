/**
 * DD-120：把一条新闻匹配到我方一场赛事（WC 732 / 欧冠 2），命中则卡内嵌推荐下注卡。
 *
 * 为什么扫文本而不是读 `card.match`：真实新闻 feed 几乎不带结构化 `match` 字段
 * （20 条仅 1 条有，且是橄榄球），靠它新闻推荐卡永不触发。改为扫新闻**英文** originalText
 * 里出现的队名 —— "Arsenal transfer..." 命中 Arsenal、"...carried Argentina..." 命中 Argentina。
 *
 * 队名取英文（DD-120 验收）：dev 后端 `participant.name` 恒中文且 `app_lang` 无效，故经
 * `short_code` 查 `TEAM_NAME_BY_SHORT_CODE` 拿英文名（prod 的 name 本就英文，`?? name` 兜底）。
 *
 * 误匹配防护：
 *   - 英文名归一化后按**词边界**整词匹配（" arsenal " 不会被 "internationale" 误命中）。
 *   - 名长 < 4 跳过（避免超短词噪音）。
 *   - 命中的队若分属**多场不同赛事** → 视为歧义，返回 null。
 *   - 同一队多场未来赛事 → 取最近一场（依赖 fixtures 已按 kickoff 升序，useUclWcFixtures 保证）。
 */
import type { SportmonksFixture, SportmonksParticipant } from "@/types/api";
import { TEAM_ALIASES_BY_SHORT_CODE } from "./team-name-aliases";

/** 归一化：去重音 + 小写 + 非字母数字折叠为单空格 + trim。 */
export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * participant → 可匹配英文别名（归一化）。
 * dev：short_code 命中映射表（人工审定的简称集）；prod：name 本就英文，归一化兜底（长度 ≥4）。
 * 返回空 = 该队无法匹配（如 dev 下未映射的中文名归一化为空）。
 */
function teamAliases(p: SportmonksParticipant): string[] {
  const mapped = p.short_code
    ? TEAM_ALIASES_BY_SHORT_CODE[p.short_code.trim().toUpperCase()]
    : undefined;
  if (mapped) return mapped;
  const norm = normalizeTeamName(p.name ?? "");
  return norm.length >= 4 ? [norm] : [];
}

/**
 * 扫描新闻文本，命中我方赛事则返回（否则 null）。
 *
 * @param text     新闻英文文本（通常是 card.originalText）
 * @param fixtures 我方 WC/欧冠 fixtures，**须按 starting_at_timestamp 升序**
 */
export function resolveFixtureByText(
  text: string | undefined | null,
  fixtures: SportmonksFixture[]
): SportmonksFixture | null {
  if (!text) return null;
  const haystack = ` ${normalizeTeamName(text)} `;
  if (haystack.trim() === "") return null;

  // 每支被提及的队（按 short_code/名去重）→ 其最近一场赛事（fixtures 升序 → 首次命中即最近）
  const nearestByTeam = new Map<string, SportmonksFixture>();
  for (const fx of fixtures) {
    for (const p of fx.participants ?? []) {
      const aliases = teamAliases(p);
      if (aliases.length === 0) continue;
      const key = (p.short_code || aliases[0]!).toUpperCase();
      if (nearestByTeam.has(key)) continue;
      if (aliases.some((a) => haystack.includes(` ${a} `))) nearestByTeam.set(key, fx);
    }
  }
  if (nearestByTeam.size === 0) return null;

  const ids = new Set([...nearestByTeam.values()].map((f) => f.id));
  if (ids.size !== 1) return null; // 跨多场不同赛事 → 歧义，不渲染
  return nearestByTeam.values().next().value ?? null;
}
