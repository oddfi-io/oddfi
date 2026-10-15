/**
 * BUG：前端展示的 AH/AT 盘口线取自 SportMonks 行情主线，但行情线会停盘（stopped）/漂移
 * （如 2.5→2.25），而链上只为「活线 ∩ 合约白名单」开盘——两边错位时用户点到的是
 * 链上不存在的线，提交必抛 OnchainMarketNotFoundError（实测 fixture 19609127：
 * 行情展示 AH -1 / AT 2.5，链上实际只有 AH -1.25）。
 *
 * 本模块提供「以链上可投盘为唯一展示依据」的纯函数：
 * - `hasOnchainLine`：某条线（主队视角）在链上是否存在对应盘
 * - `pickOnchainAlignedLine`：从行情线列表中挑出第一条链上有盘的线（列表卡片用）
 * - `filterLinesToOnchain`：过滤出全部链上有盘的线（详情页多线列表用）
 *
 * 线匹配用 ×100 整数 basis 数值相等（与 submit-onchain-from-selection.ts 同口径），
 * 规避 "1" vs "1.0"、"+0.5" vs "0.5" 等字符串陷阱。OddsLine.lineValue 与后端
 * line_value 均为主队视角，无需取反。
 */

import type { OnchainMarket } from "@/types/onchain-betting";
import type { OddsLine } from "@/lib/parse-odds-lines";
import { isTestFixtureId } from "@/lib/betting/constants";

/**
 * 该 fixture 的下注是否走链上路径（与 BetSummary 的 goesOnchain 分流同口径）：
 * 非测试赛事一律走链上（DD-147：testnet/mainnet 链上行为永久统一，删除 IS_TESTNET 业务闸）。
 * 测试赛事（TEST_FIXTURE_IDS，强制中心化 placeBet）按行情线下注是合法路径，
 * 展示**不得**被链上盘过滤（REV-v1 critic Major#3）。
 * 调用方在门控为 false 时给本模块的函数传 markets=null，即落入"透传现状"分支。
 */
export function shouldAlignToOnchain(fixtureId: number): boolean {
  return !isTestFixtureId(fixtureId);
}

/** SportMonks market_id → 合约 market_type（1=1x2→0, 6=AH→1, 7=AT→2）。 */
const SPORTMONKS_TO_CONTRACT_TYPE: Record<number, number> = {
  1: 0,
  6: 1,
  7: 2,
};

/**
 * 盘口线字符串 → ×100 整数 basis；兼容 "+0.5" / "−1"(unicode 减号) / ".5" / "" 等格式，
 * 不可解析返回 null。与 lib/betting/submit-onchain-from-selection.ts 的 lineToBasis 同口径。
 */
export function lineToBasis(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const v = String(raw).trim().replace("−", "-").replace(/^\+/, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * 判断链上是否存在「该玩法 + 该线（主队视角）」的可投盘。
 * - markets 为 null/空（未加载/无盘）→ false，由调用方决定降级策略
 * - 1x2（sportmonksMarketId=1）无线概念，只看 market_type===0 是否存在
 * - AH/AT 用 basis 数值精确匹配 line_value；后端缺 line_value 的旧数据视为不可匹配
 */
export function hasOnchainLine(
  markets: OnchainMarket[] | null | undefined,
  sportmonksMarketId: number,
  homeLine: string | null | undefined
): boolean {
  if (!markets || markets.length === 0) return false;
  const targetType = SPORTMONKS_TO_CONTRACT_TYPE[sportmonksMarketId];
  if (targetType === undefined) return false;
  if (targetType === 0) return markets.some((m) => m.market_type === 0);
  const targetBasis = lineToBasis(homeLine);
  if (targetBasis === null) return false;
  return markets.some(
    (m) => m.market_type === targetType && lineToBasis(m.line_value) === targetBasis
  );
}

/**
 * 详情页用：过滤出链上有盘的行情线，展示什么 = 能下什么。
 * 透传分支（返回原列表，不进入对齐）：
 * - markets === null：未加载/加载中/接口错误/门控关闭——不闪缺省态、不在降级时误杀展示
 * - markets.length === 0：该赛事链上**零盘**，视为"无链上盘体系"（普通联赛/刚 cutover 的
 *   过渡窗口），整体过滤只会把整场打成横杠，误伤面大于收益（REV-v1 critic Major#3）。
 *   对齐只在"链上确有盘体系、但缺某玩法/某线"时生效。
 */
export function filterLinesToOnchain(
  lines: OddsLine[],
  markets: OnchainMarket[] | null,
  sportmonksMarketId: number
): OddsLine[] {
  if (!markets || markets.length === 0) return lines;
  return lines.filter((l) => hasOnchainLine(markets, sportmonksMarketId, l.lineValue));
}

/**
 * 列表卡片用：从行情线中挑出链上有盘的展示线。
 * 选线优先级（REV-v1 code-reviewer ③ / critic Major#1——不能简单取升序首条，
 * 升序首条是让球最深的盘而非主流线）：
 *   1. 行情主线（preferredLine，SportMonks 选定的 main line）链上有盘 → 用它
 *   2. 否则取与行情主线 basis 距离最近的可投线（保持展示贴近主流盘）
 *   3. 无 preferredLine 时退化为首条可投线
 * 返回三态：undefined = 未加载/零盘/门控关（沿用行情主线）；OddsLine = 对齐线；
 * null = 链上有盘体系但该玩法无任何可投线（渲染横杠缺省）。
 */
export function pickOnchainAlignedLine(
  lines: OddsLine[],
  markets: OnchainMarket[] | null,
  sportmonksMarketId: number,
  preferredLine?: string | null
): OddsLine | null | undefined {
  if (!markets || markets.length === 0) return undefined;
  const bettable = lines.filter((l) => hasOnchainLine(markets, sportmonksMarketId, l.lineValue));
  if (bettable.length === 0) return null;
  const preferredBasis = lineToBasis(preferredLine);
  if (preferredBasis === null) return bettable[0] ?? null;
  let best = bettable[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const l of bettable) {
    const basis = lineToBasis(l.lineValue);
    if (basis === null) continue;
    const dist = Math.abs(basis - preferredBasis);
    if (dist < bestDist) {
      best = l;
      bestDist = dist;
    }
  }
  return best;
}
