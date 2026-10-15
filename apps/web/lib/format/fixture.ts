// 支持英文 vs / 中文 对 / 对阵(DD-105 验收 — 后端中文翻译 fixture_name 如"巴黎圣日耳曼 对 阿森纳")
const SEPARATOR = /\s+(?:vs|对阵|对)\s+/i;

/**
 * 解析后端 fixture_name："Argentina vs Brazil" / "Mexico VS South Africa" /
 * "巴黎圣日耳曼 对 阿森纳" / "皇马 对阵 拜仁" 均正确拆分。
 * 无法解析时 fallback，home 展示完整原文、away 为空串。
 */
export function parseFixtureName(name?: string): { home: string; away: string } {
  if (!name) return { home: "", away: "" };
  const parts = name.split(SEPARATOR);
  if (parts.length < 2) return { home: name, away: "" };
  return { home: parts[0].trim(), away: parts.slice(1).join(" vs ").trim() };
}

/**
 * 比赛标题展示格式：
 *  - 双方都有 → "Home VS Away"
 *  - 只 home（banner_single 走 selection 当 home + away="" 占位）→ 仅 home
 */
export function formatMatchTitle(home: string, away: string): string {
  return away ? `${home} VS ${away}` : home;
}
