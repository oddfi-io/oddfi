/**
 * Calendar 派生器：从 SportmonksFixture 提取 Calendar 业务字段。
 *
 * 设计原则：所有派生集中此处，避免渲染层散写 `if (has_odds && enable_bet)`。
 */
import type { SportmonksFixture, SportmonksParticipant } from "@/types/api";
import type { CalendarMarketStatus, CalendarStageId } from "@/types/calendar";
import { STAGE_ID_MAP } from "./constants";

/** FIFA 3-letter code → ISO alpha-2（用于 public/images/flags/{iso}.svg） */
const FIFA_TO_ISO: Record<string, string> = {
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CIV: "ci",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRO: "hr",
  CZE: "cz",
  DZA: "dz",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HTI: "ht",
  IRN: "ir",
  IRQ: "iq",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  POR: "pt",
  PRY: "py",
  QAT: "qa",
  SCO: "gb",
  SEN: "sn",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  URU: "uy",
  USA: "us",
  UZB: "uz",
  ZAF: "za",
};

/** 返回球队国旗路径（public/images/flags/），无映射时返回 null */
export function getFlagSrc(shortCode: string | undefined): string | null {
  if (!shortCode) return null;
  const iso = FIFA_TO_ISO[shortCode.toUpperCase()];
  return iso ? `/images/flags/${iso}.svg` : null;
}

/**
 * 比赛开盘状态（PRD 派生规则）。
 * - both has_odds && enable_bet → 'open'
 * - 任意一项为 false → 'pre_open'
 */
export function getMarketStatus(fixture: SportmonksFixture): CalendarMarketStatus {
  return fixture.has_odds && fixture.enable_bet === true ? "open" : "pre_open";
}

/**
 * SportMonks stage_id 映射到 CalendarStageId。
 * 未识别 stage_id 默认归为 'group'（防御兜底，正常不应触发）。
 */
export function getStageId(fixture: SportmonksFixture): CalendarStageId {
  return STAGE_ID_MAP[fixture.stage_id] ?? "group";
}

/**
 * 提取球队短码。优先用接口 short_code，缺失则用 name 前 3 字母。
 */
export function getTeamShortCode(p: SportmonksParticipant | undefined, fallback = "TBD"): string {
  if (!p) return fallback;
  if (p.short_code) return p.short_code;
  if (p.name) return p.name.slice(0, 3).toUpperCase();
  return fallback;
}

/**
 * 取主/客队 participant；约定 meta.location='home' / 'away'。
 */
export function getHomeAway(fixture: SportmonksFixture): {
  home: SportmonksParticipant | undefined;
  away: SportmonksParticipant | undefined;
} {
  const home = fixture.participants.find((p) => p.meta?.location === "home");
  const away = fixture.participants.find((p) => p.meta?.location === "away");
  return { home, away };
}

/**
 * 比赛在所属 stage 中的序号（1-indexed，按 kickoff 升序）。
 * Mock 数据未含 group_id / round 字段，故 Figma "Group F · M1" 文案中的
 * "M1" 暂以 stage 全局 ordinal 替代；group_id 接入后再细化为 per-group。
 */
export function buildStageOrdinalMap(fixtures: SportmonksFixture[]): Map<number, number> {
  const map = new Map<number, number>();
  const byStage = new Map<CalendarStageId, SportmonksFixture[]>();
  for (const f of fixtures) {
    const stage = getStageId(f);
    const arr = byStage.get(stage) ?? [];
    arr.push(f);
    byStage.set(stage, arr);
  }
  for (const arr of byStage.values()) {
    arr.sort((a, b) => a.starting_at_timestamp - b.starting_at_timestamp);
    arr.forEach((f, idx) => map.set(f.id, idx + 1));
  }
  return map;
}
