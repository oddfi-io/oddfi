/**
 * DD-107 §3.3 / §3.6：Match Analysis CONTEXT 拉取 + 拼装。
 * 5 路并发 + Promise.race(4s timeout)；全失败 → ContextUnavailableError；
 * inflight Map 去重；字段顺序：缺失数据 + 伤停提前（避开 lost-in-the-middle 衰减）。
 */

import type {
  MatchDetailOverviewWire,
  MatchDetailH2HWire,
  MatchDetailStandingsWire,
  MatchDetailLineupsWire,
} from "@/types/match-detail";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import { getMainHandicapLine, getMainTotalLine } from "@/lib/match-utils";
import { MARKET_API_BASE } from "@/lib/market-api";

const MARKET_API_URL = MARKET_API_BASE;
const SINGLE_TIMEOUT_MS = 3_000;
const OVERALL_TIMEOUT_MS = 4_000;

/** DD-136 W1：H2H 样本 < 5 场视为小样本，交锋史降权（业界共识：国家队赛事用评级/状态/盘口替代）。 */
export const H2H_SMALL_SAMPLE_THRESHOLD = 5;

export class ContextUnavailableError extends Error {
  constructor(message = "All match-data sources failed") {
    super(message);
    this.name = "ContextUnavailableError";
  }
}

export interface MatchDataBundle {
  overview: MatchDetailOverviewWire | null;
  h2h: MatchDetailH2HWire | null;
  standings: MatchDetailStandingsWire | null;
  lineups: MatchDetailLineupsWire | null;
  fixture: SportmonksFixture | null;
}

export interface BuildContextOptions {
  fetchFn?: typeof fetch;
  singleTimeoutMs?: number;
  overallTimeoutMs?: number;
  /** test 注入：跳过 inflight + cache wrapper，直接走底层 assemble。生产代码不传 */
  bypassCoalescing?: boolean;
}

interface CodedEnvelope<T> {
  code: number;
  data: T | null;
  msg?: string;
  message?: string;
}

/** Match-detail group uses code:0, fixture detail uses code:200. Accept both as success. */
function unwrapEnvelope<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const env = json as CodedEnvelope<T>;
  if (env.code !== 0 && env.code !== 200) return null;
  return env.data ?? null;
}

async function fetchOne<T>(
  path: string,
  fetchFn: typeof fetch,
  timeoutMs: number
): Promise<T | null> {
  try {
    const res = await fetchFn(`${MARKET_API_URL}/api/${path}`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[match-context] ${path} non-2xx`, res.status);
      return null;
    }
    const json = (await res.json()) as unknown;
    return unwrapEnvelope<T>(json);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[match-context] ${path} fetch failed`, msg);
    return null;
  }
}

export async function fetchMatchData(
  matchId: string,
  opts: BuildContextOptions = {}
): Promise<MatchDataBundle> {
  const { fetchFn = fetch, singleTimeoutMs = SINGLE_TIMEOUT_MS } = opts;
  const overallTimeoutMs = opts.overallTimeoutMs ?? OVERALL_TIMEOUT_MS;

  const tasks = Promise.all([
    fetchOne<MatchDetailOverviewWire>(
      `v1/match-detail/overview/${matchId}`,
      fetchFn,
      singleTimeoutMs
    ),
    fetchOne<MatchDetailH2HWire>(`v1/match-detail/h2h/${matchId}`, fetchFn, singleTimeoutMs),
    fetchOne<MatchDetailStandingsWire>(
      `v1/match-detail/standings/${matchId}`,
      fetchFn,
      singleTimeoutMs
    ),
    fetchOne<MatchDetailLineupsWire>(
      `v1/match-detail/lineups/${matchId}`,
      fetchFn,
      singleTimeoutMs
    ),
    fetchOne<SportmonksFixture[]>(
      `v1/detail/fixture/${matchId}?type=preview`,
      fetchFn,
      singleTimeoutMs
    ),
  ]);

  const overallTimeout = new Promise<null>((resolve) =>
    setTimeout(resolve, overallTimeoutMs, null)
  );

  const result = await Promise.race([tasks, overallTimeout]);
  if (!result) {
    return { overview: null, h2h: null, standings: null, lineups: null, fixture: null };
  }
  const [overview, h2h, standings, lineups, fixtures] = result;
  return {
    overview,
    h2h,
    standings,
    lineups,
    fixture: fixtures && fixtures.length > 0 ? fixtures[0]! : null,
  };
}

function isAllNull(b: MatchDataBundle): boolean {
  return !b.overview && !b.h2h && !b.standings && !b.lineups && !b.fixture;
}

function formatNow(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

interface MoneylineSnapshot {
  home: string;
  draw: string;
  away: string;
  /** 后端给的隐含概率字符串（如 "47.6%"），缺失为 null。 */
  homeProb: string | null;
  drawProb: string | null;
  awayProb: string | null;
}

function pickMoneyline(odds: SportmonksOddsEntry[] | undefined): MoneylineSnapshot | null {
  if (!odds || odds.length === 0) return null;
  const ml = odds.filter((o) => o.market_id === 1);
  if (ml.length === 0) return null;
  const homeEntry = ml.find((o) => o.label === "Home");
  const drawEntry = ml.find((o) => o.label === "Draw");
  const awayEntry = ml.find((o) => o.label === "Away");
  if (!homeEntry?.value || !awayEntry?.value) return null;
  return {
    home: homeEntry.value,
    draw: drawEntry?.value ?? "—",
    away: awayEntry.value,
    homeProb: homeEntry.probability || null,
    drawProb: drawEntry?.probability || null,
    awayProb: awayEntry.probability || null,
  };
}

/** "2.10（隐含 47.6%）" — 无概率时只输出赔率。 */
function oddsWithProb(value: string, prob: string | null): string {
  return prob ? `${value}（隐含 ${prob}）` : value;
}

/**
 * 按 DD-107 §3.1 Layer 2 顺序拼装 CONTEXT 字符串。
 * 字段顺序：基本信息 → 关键缺失数据 → 伤停 → 实时盘口 → 近期状态 → H2H → 积分。
 */
export function assembleContext(
  bundle: MatchDataBundle,
  matchId: string,
  now: Date = new Date()
): string {
  const missing: string[] = [];
  if (!bundle.overview) missing.push("赛事基本信息 / 球队 / 场馆 / 近期状态 / 排名");
  if (!bundle.h2h) missing.push("历史交锋");
  if (!bundle.standings) missing.push("联赛积分榜");
  if (!bundle.lineups || !bundle.lineups.lineups) missing.push("阵容 / 伤停");
  if (!bundle.fixture || !bundle.fixture.has_odds) missing.push("实时盘口");

  const o = bundle.overview;
  const home = o?.homeTeam.name ?? "未获取";
  const away = o?.awayTeam.name ?? "未获取";
  const startingAt = o?.startingAt ?? "未获取";
  const venue = o?.venue
    ? `${o.venue.name}${o.venue.city ? `（${o.venue.city}）` : ""}${o.venue.capacity ? `，容量 ${o.venue.capacity}` : ""}`
    : "未获取";
  const referee = o?.referee.name || "未公布";

  const moneyline = pickMoneyline(bundle.fixture?.odds);
  const fixtureOdds = bundle.fixture?.odds ?? [];
  const ahLine = fixtureOdds.length > 0 ? getMainHandicapLine(fixtureOdds) : null;
  const totalLine = fixtureOdds.length > 0 ? getMainTotalLine(fixtureOdds) : null;

  // DD-136 W1：H2H 段输出"样本充分性"标注。小样本（< 5 场）时显式降权，
  // 指引 LLM 改以排名差 / 近期状态 / 盘口隐含概率为主信号（业界做法，RES-021 §C）。
  const h2hSection = (() => {
    if (!bundle.h2h) return "- 未获取";
    const n = bundle.h2h.h2h_sample_size ?? 0;
    const summary = o?.h2hSummary;
    const record =
      summary && n > 0
        ? `历史战绩：${home} ${summary.home_wins} 胜 · 平 ${summary.draws} · ${away} ${summary.away_wins} 胜`
        : "历史战绩：未获取";
    if (n < H2H_SMALL_SAMPLE_THRESHOLD) {
      return [
        `- 样本充分性：⚠️ 小样本（仅 ${n} 场，统计参考价值低）`,
        `- ${record}`,
        `- 分析指引：交锋史一句带过即可，禁止逐项复述小样本胜率/百分比；实力判断改以排名差、近期状态、盘口隐含概率为主信号`,
      ].join("\n");
    }
    const avg = bundle.h2h.h2hAverageGoals?.scored;
    const avgLine = avg ? `场均进球：${home} ${avg.home} · ${away} ${avg.away}` : null;
    return [`- 样本充分性：充分（${n} 场）`, `- ${record}`, avgLine ? `- ${avgLine}` : null]
      .filter(Boolean)
      .join("\n");
  })();

  const standingsLines = (() => {
    if (!bundle.standings || !o) return "未获取";
    const rank = o.standingsRank;
    if (!rank || (rank.home === 0 && rank.away === 0)) return "未获取";
    return `${home} 第 ${rank.home} 名 · ${away} 第 ${rank.away} 名（联赛：${bundle.standings.league_name}）`;
  })();

  const seasonGoalsLine = (() => {
    if (!o?.seasonGoals) return "未获取";
    const { home: hg, away: ag } = o.seasonGoals;
    if (hg === 0 && ag === 0) return "未获取";
    return `${home} 本赛季 ${hg} 球 · ${away} 本赛季 ${ag} 球`;
  })();

  const recentForm = (() => {
    if (!o?.recentResults) return "未获取";
    const hf = o.recentResults.home?.slice(0, 5).join("-");
    const af = o.recentResults.away?.slice(0, 5).join("-");
    if (!hf && !af) return "未获取";
    return `${home}: ${hf || "未获取"} · ${away}: ${af || "未获取"}`;
  })();

  // h2hForm 实为"近期表现胜率"（wire 注释），归位到近期状态段，不再混入 H2H 段误导 LLM。
  // REV-v1-B C1：双 0% 视为零值陷阱（无效信息源头），守卫为"未获取"，禁止 0%/0% 流入 CONTEXT；
  // REV-v1-B N1：h2h 接口失败/零值时回退 overview.formPercentage（同语义双源）。
  const recentWinRate = (() => {
    const pickPair = (h?: number, a?: number) =>
      typeof h === "number" && typeof a === "number" && !(h === 0 && a === 0)
        ? { home: h, away: a }
        : null;
    const pair =
      pickPair(bundle.h2h?.h2hForm?.home_percentage, bundle.h2h?.h2hForm?.away_percentage) ??
      pickPair(o?.formPercentage?.home, o?.formPercentage?.away);
    if (!pair) return null;
    return `近况胜率：${home} ${Math.round(pair.home)}% · ${away} ${Math.round(pair.away)}%`;
  })();

  const lineupsAbsent = bundle.lineups?.lineups
    ? "已有阵容（详见赛事页）"
    : `阵容预计 ${bundle.lineups?.available_at ?? "未公布"}发布`;

  return `<CONTEXT type="match-analysis" fixture_id="${matchId}" fetched_at="${formatNow(now)}">

# 1. 赛事基本信息
- 主队 vs 客队：${home} vs ${away}
- 开赛时间：${startingAt}
- 场馆：${venue}
- 裁判：${referee}

# 2. ⚠️ 关键缺失数据（生成回答时必须标注以下字段无数据）
${missing.length === 0 ? "无缺失" : missing.map((m) => `- ${m}`).join("\n")}

# 3. 伤停 / 阵容
- ${lineupsAbsent}

# 4. 实时盘口（OddFi market-api）
${moneyline ? `- 1×2：主胜 ${oddsWithProb(moneyline.home, moneyline.homeProb)} / 平 ${oddsWithProb(moneyline.draw, moneyline.drawProb)} / 客胜 ${oddsWithProb(moneyline.away, moneyline.awayProb)}` : "- 未获取实时盘口"}
${ahLine ? `- 让球（亚盘）：主队线 ${ahLine.line} · 主 ${ahLine.homeOdds} / 客 ${ahLine.awayOdds}` : "- 让球（亚盘）：未获取详细让球盘"}
${totalLine ? `- 大小球：线 ${totalLine.line} · 大 ${totalLine.overOdds} / 小 ${totalLine.underOdds}` : "- 大小球：未获取大小球盘"}

# 5. 近期状态（最近 5 场）
- ${recentForm}
${recentWinRate ? `- ${recentWinRate}` : "- 近况胜率：未获取（无有效胜率样本，分析时禁止编造或复述 0%，改用上行 W/D/L 战绩串）"}
- 本赛季进球：${seasonGoalsLine}

# 6. H2H 历史交锋
${h2hSection}

# 7. 联赛积分
- ${standingsLines}

</CONTEXT>

<DATA_SOURCES>
赛事数据：market-api.oddfi.io · ${formatNow(now)}
</DATA_SOURCES>`;
}

const inflight = new Map<string, Promise<string>>();

/**
 * 主入口：matchId → CONTEXT 字符串。
 * unstable_cache 包裹由 route 层处理（module scope 难以 mock；route 层包装即可）。
 */
export async function buildMatchContext(
  matchId: string,
  opts: BuildContextOptions = {}
): Promise<string> {
  if (opts.bypassCoalescing) {
    return buildMatchContextRaw(matchId, opts);
  }
  const existing = inflight.get(matchId);
  if (existing) return existing;
  const p = buildMatchContextRaw(matchId, opts).finally(() => inflight.delete(matchId));
  inflight.set(matchId, p);
  return p;
}

async function buildMatchContextRaw(matchId: string, opts: BuildContextOptions): Promise<string> {
  const bundle = await fetchMatchData(matchId, opts);
  if (isAllNull(bundle)) {
    throw new ContextUnavailableError(`All 5 sources failed for matchId=${matchId}`);
  }
  return assembleContext(bundle, matchId);
}

/** test-only helper. Production code must not call. */
export function resetInflightForTest() {
  inflight.clear();
}
