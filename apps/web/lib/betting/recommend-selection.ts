/**
 * DD-120：从一场赛事派生「推荐下注」selection（全场结果 1X2，单注）。
 *
 * 前向兼容设计（DD-120 §3.2）：
 *   - 当前 V1：前端选热门 —— 取 1X2 三路里赔率最低（隐含概率最高）的一方。
 *   - 几天后切后端返回：后端给出结构化 pick → 调用方传 `backendRec`，本函数走 backendRec 分支，
 *     签名 + 所有 caller + 展示组件不动。
 *
 * 赔率与赛事卡严格一致：复用 `get1X2Entry(odds, label)`（赛事卡 1X2 按钮同款解析，按 label
 * 取首个 market_id===1 entry）。因此推荐赔率必然等于赛事卡展示的某一路赔率（用户硬要求），
 * 「最低」也只在赛事卡实际展示的三路之间取，天然自洽 —— 不存在跨 bookmaker 比较出不一致 favorite。
 */
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import type { BetSelection } from "@/types/betting";
import { get1X2Entry, getTeamName } from "@/lib/match-utils";
import { makeSelectionId } from "@/lib/selection-id";
import { formatOdds } from "@/lib/odds";

/** 1X2 三路 label。 */
export type FulltimeLabel = "Home" | "Draw" | "Away";

/** 后端结构化推荐（几天后切后端返回时填充）。给定即按此 label 选取，覆盖前端选热门。 */
export interface BackendRecommendation {
  label: FulltimeLabel;
}

export interface RecommendedSelection {
  sel: BetSelection;
}

// ─── DD-136 W3：LLM 结构化 pick → 三玩法 selection 派生 ────────────────────

/** LLM picks 块的玩法枚举（与 BetSelection.marketType 同字面量）。 */
export type PickMarket = "1x2" | "asian_handicap" | "asian_total";

/** 置信度三档（业界实践：整数档位即可建立信任，不输出伪精确百分比）。 */
export type PickConfidence = "high" | "mid" | "low";

/** AI 分析正文末尾结构化 pick（lib/ai/picks.ts 解析产出）。 */
export interface AnalysisPick {
  market: PickMarket;
  /** "Home" | "Draw" | "Away"（1x2 / 让球）；"Over" | "Under"（大小球） */
  side: string;
  confidence: PickConfidence;
  /** ≤20 字一句话理由（来自 LLM，展示层直接渲染） */
  reason?: string;
}

const CONFIDENCE_ORDER: Record<PickConfidence, number> = { high: 0, mid: 1, low: 2 };

/** 按置信度降序排序（high → mid → low），用于推荐卡渲染顺序。 */
export function sortPicksByConfidence(picks: AnalysisPick[]): AnalysisPick[] {
  return [...picks].sort((a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence]);
}

function displayLabelFor(fixture: SportmonksFixture, label: string): string {
  if (label === "Home") return getTeamName(fixture, "home");
  if (label === "Away") return getTeamName(fixture, "away");
  return label; // "Draw" 等保持原值，展示层负责本地化
}

/** 三玩法共有的 selection 基础字段（id / 赔率 / 赛事元信息），差异字段由调用方展开补齐。 */
function buildBaseSelection(
  fixture: SportmonksFixture,
  entry: SportmonksOddsEntry,
  lineValue?: string
): Omit<BetSelection, "marketType" | "selection" | "displayLabel"> {
  return {
    id: makeSelectionId(fixture.id, entry.market_id, entry.label, lineValue),
    oddId: entry.id,
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    leagueName: fixture.league?.name ?? "",
    marketDescription: entry.market_description,
    odds: formatOdds(entry.value),
    homeLogo:
      fixture.participants?.find((p) => p.meta?.location === "home")?.image_path || undefined,
    awayLogo:
      fixture.participants?.find((p) => p.meta?.location === "away")?.image_path || undefined,
  };
}

function buildSelection(fixture: SportmonksFixture, entry: SportmonksOddsEntry): BetSelection {
  return {
    ...buildBaseSelection(fixture, entry),
    marketType: "1x2",
    selection: entry.label,
    displayLabel: displayLabelFor(fixture, entry.label),
  };
}

/** SportMonks AH label 变体（"1"/"2"）归一为 "Home"/"Away"（与 makeSelectionId 内部归一一致）。 */
function normalizeAhLabel(label: string): "Home" | "Away" | null {
  if (label === "Home" || label === "1") return "Home";
  if (label === "Away" || label === "2") return "Away";
  return null;
}

/**
 * DD-136 W3：按 LLM pick 派生三玩法 selection。
 * 构造逻辑与 MatchCard.makeSelection 严格一致（id 共享主线 lineValue、handicap/total 取 entry 自身值），
 * 保证与赛事卡点击产生的 selection 在 betslip 内天然去重。
 */
export function deriveSelectionForPick(
  fixture: SportmonksFixture,
  pick: AnalysisPick
): RecommendedSelection | null {
  if (fixture.has_odds === false) return null;
  const odds = fixture.odds ?? [];

  if (pick.market === "1x2") {
    if (pick.side !== "Home" && pick.side !== "Draw" && pick.side !== "Away") return null;
    const entry = get1X2Entry(odds, pick.side);
    return isPlayable(entry) ? { sel: buildSelection(fixture, entry) } : null;
  }

  if (pick.market === "asian_handicap") {
    const side = normalizeAhLabel(pick.side);
    if (!side) return null;
    const hcOdds = odds.filter((o) => o.market_id === 6);
    const homeEntry = hcOdds.find((o) => o.label === "Home" || o.label === "1");
    const awayEntry = hcOdds.find((o) => o.label === "Away" || o.label === "2");
    const entry = side === "Home" ? homeEntry : awayEntry;
    if (!isPlayable(entry)) return null;
    // 与 MatchCard 一致：selection id 用主线 lineValue（home 侧线优先），handicap 存用户所选方视角线
    const lineValue = homeEntry?.handicap ?? awayEntry?.handicap ?? undefined;
    return {
      sel: {
        ...buildBaseSelection(fixture, entry, lineValue),
        marketType: "asian_handicap",
        selection: side,
        displayLabel: displayLabelFor(fixture, side),
        handicap: entry.handicap || undefined,
      },
    };
  }

  // asian_total
  if (pick.side !== "Over" && pick.side !== "Under") return null;
  const ttOdds = odds.filter((o) => o.market_id === 7);
  const overEntry = ttOdds.find((o) => o.label === "Over");
  const underEntry = ttOdds.find((o) => o.label === "Under");
  const entry = pick.side === "Over" ? overEntry : underEntry;
  if (!isPlayable(entry)) return null;
  const lineValue = overEntry?.total ?? underEntry?.total ?? undefined;
  return {
    sel: {
      ...buildBaseSelection(fixture, entry, lineValue),
      marketType: "asian_total",
      selection: entry.label,
      displayLabel: entry.total ? `${entry.label} ${entry.total}` : entry.label,
      total: entry.total || undefined,
    },
  };
}

/** entry 是否可下注：存在 + 赔率为有限正数。 */
function isPlayable(entry: SportmonksOddsEntry | undefined): entry is SportmonksOddsEntry {
  if (!entry) return false;
  const v = Number(entry.value);
  return Number.isFinite(v) && v > 0;
}

export function deriveRecommendedSelection(
  fixture: SportmonksFixture,
  backendRec?: BackendRecommendation
): RecommendedSelection | null {
  if (fixture.has_odds === false) return null;
  const odds = fixture.odds ?? [];

  // 后端 pick 优先（前向兼容分支）
  if (backendRec) {
    const entry = get1X2Entry(odds, backendRec.label);
    return isPlayable(entry) ? { sel: buildSelection(fixture, entry) } : null;
  }

  // V1：前端选热门 —— 仅在赛事卡实际展示的三路之间取最低赔率
  let best: SportmonksOddsEntry | null = null;
  for (const label of ["Home", "Draw", "Away"] as const) {
    const entry = get1X2Entry(odds, label);
    if (!isPlayable(entry)) continue;
    if (!best || Number(entry.value) < Number(best.value)) best = entry;
  }
  return best ? { sel: buildSelection(fixture, best) } : null;
}
