/**
 * DD-105 桥接器：把前端 BetSelection（"Home"/"Draw"/"Away"/"Over"/"Under" 文本）
 * 翻译为合约级 OnchainBetInput（matchId/marketType/outcome/line bigint）。
 *
 * 流程：
 *   1. GET /market/onchain?fixture_id=X 拿当前 fixture 的所有 markets
 *   2. 按 marketType + (handicap|total) 匹配对应 market
 *   3. 用文本 → outcome 索引映射
 *   4. 调 submitOnchainBet 跑 approve+poll+place_bet+poll
 *
 * 测试 seam：deps 全注入。
 */

import { getOnchainMarkets } from "@/lib/api";
import {
  submitOnchainBet,
  type OnchainBetInput,
  type OnchainBetResult,
  type OnchainBetState,
} from "./submit-onchain-bet";
import { computeMinOddsBps } from "./min-odds";
import { USER_SLIPPAGE_BPS_DEFAULT } from "./constants";
import type { BetSelection } from "@/types/betting";
import type { OnchainMarket, OnchainMarketRes } from "@/types/onchain-betting";

export class OnchainMarketNotFoundError extends Error {
  constructor(
    public fixtureId: number,
    public marketType: BetSelection["marketType"],
    /** SportMonks line 字符串（"-0.5" / "2.5"），1X2 为 null */
    public line: string | null
  ) {
    super(
      `[OnchainSelection] No matching onchain market for fixture=${fixtureId} type=${marketType} line=${line}`
    );
    this.name = "OnchainMarketNotFoundError";
  }
}

export class UnsupportedSelectionError extends Error {
  constructor(public selection: BetSelection) {
    super(
      `[OnchainSelection] Unsupported selection: type=${selection.marketType} text=${selection.selection}`
    );
    this.name = "UnsupportedSelectionError";
  }
}

const MARKET_TYPE_CODE: Record<BetSelection["marketType"], number> = {
  "1x2": 0,
  asian_handicap: 1,
  asian_total: 2,
};

/**
 * 盘口字符串 → ×100 整数 basis（与后端 line_basis 同口径）。
 * 兼容 "+0.5" / "-1" / "−1"(unicode 减号) / "2.5" / ".5" / "" 等格式；不可解析返回 null。
 */
function lineToBasis(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const v = raw.trim().replace("−", "-").replace(/^\+/, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * DD-124 / DD-118 line 匹配（数值口径 · DD-128 修主客视角）：
 * 后端 `OnchainMarket.line_value` 恒为「主队视角带符号」盘口（如 "-1" = 主队 -1 / 客队 +1），
 * 单个市场只有一个 line_value，主客两个 outcome 共用。前端 AH 客队选择存的是客队视角线
 * （如 "1"），与后端主队视角互为相反数 —— 必须先取反对齐再比，否则客队（受让）方下注必然
 * 匹配失败（本次 acceptance 实测 fixture 19609127 南非 +1）。Total 不区分主客，不取反。
 *
 * 用 ×100 整数 basis 做数值相等，规避 "1" vs "-1"、"+0.5" vs "0.5"、".5" vs "0.5" 等
 * 符号/格式陷阱。字段缺失（旧后端无 line_value）→ 返回 false → 上层抛
 * OnchainMarketNotFoundError（submit 必须找到 market，宁可显式失败也不静默错下注）。
 *
 * 详见 `.progress/stash/backend-req-onchain-market-line-encoding.md`。
 */
function lineMatches(m: OnchainMarket, targetBasis: number | null): boolean {
  if (targetBasis === null) return false;
  const marketBasis = lineToBasis(m.line_value);
  if (marketBasis === null) return false;
  return marketBasis === targetBasis;
}

export function selectionToOnchainOutcome(sel: BetSelection): number {
  switch (sel.marketType) {
    case "1x2":
      if (sel.selection === "Home") return 0;
      if (sel.selection === "Draw") return 1;
      if (sel.selection === "Away") return 2;
      throw new UnsupportedSelectionError(sel);
    case "asian_handicap":
      if (sel.selection === "Home") return 0;
      if (sel.selection === "Away") return 1;
      throw new UnsupportedSelectionError(sel);
    case "asian_total":
      if (sel.selection === "Over") return 0;
      if (sel.selection === "Under") return 1;
      throw new UnsupportedSelectionError(sel);
    default:
      throw new UnsupportedSelectionError(sel);
  }
}

export function findOnchainMarket(markets: OnchainMarket[], sel: BetSelection): OnchainMarket {
  const targetType = MARKET_TYPE_CODE[sel.marketType];
  const rawLine =
    sel.marketType === "asian_handicap"
      ? sel.handicap
      : sel.marketType === "asian_total"
        ? sel.total
        : undefined;
  // AH 客队选择的盘口为客队视角，取反对齐后端主队视角 line_value（DD-128）；Total 与主客无关不取反。
  const sign = sel.marketType === "asian_handicap" && sel.selection === "Away" ? -1 : 1;
  const baseBasis = lineToBasis(rawLine);
  const targetBasis = baseBasis === null ? null : sign * baseBasis;
  // 1X2 (targetType=0) 无 line 概念，只按 market_type 找；AH/Total 必须靠 line basis 精确匹配。
  const match = markets.find((m) =>
    targetType === 0
      ? m.market_type === 0
      : m.market_type === targetType && lineMatches(m, targetBasis)
  );
  if (!match) {
    throw new OnchainMarketNotFoundError(sel.fixtureId, sel.marketType, rawLine ?? null);
  }
  return match;
}

export interface OnchainSelectionInput {
  selection: BetSelection;
  stakeOdd: string;
  seq: string;
  onState?: (s: OnchainBetState) => void;
  /** DD-117 — preview-signal 返回的锁定赔率（万分位）；缺省走 base_odds 兜底 */
  lockedOddsBps?: string | null;
  /** DD-117 — preview-signal 的降级标志；true 时即使 lockedOddsBps 非空也走 base_odds */
  degraded?: boolean;
  /** 用户滑点万分位（如 100 = 1%）；默认 USER_SLIPPAGE_BPS_DEFAULT */
  slippageBps?: number;
  /** DD-119 P2 — partial 成交可接受下限（ODD wei）；缺省全额。preview.partialFill 时传 acceptedAmount */
  minAcceptedWeiOverride?: string;
  /** DD-140 A1 — 延迟收据模式：place_bet relay 200 即返回，bet receipt 交后台跟踪。透传给 submitOnchainBet */
  deferReceipt?: boolean;
}

interface Deps {
  getOnchainMarkets: (fixtureId: number) => Promise<OnchainMarketRes>;
  submitOnchainBet: (input: OnchainBetInput) => Promise<OnchainBetResult>;
}

const defaultDeps: Deps = {
  getOnchainMarkets,
  submitOnchainBet,
};

export async function submitOnchainBetFromSelection(
  input: OnchainSelectionInput,
  deps: Deps = defaultDeps
): Promise<OnchainBetResult> {
  const res = await deps.getOnchainMarkets(input.selection.fixtureId);
  const market = findOnchainMarket(res.markets, input.selection);
  const outcome = selectionToOnchainOutcome(input.selection);

  // DD-117 §3.4 — min_odds 决策：信号灯锁价可信时用 lockedOdds，否则 base_odds 兜底
  const minOddsBpsOverride = computeMinOddsBps({
    lockedOddsBps: input.lockedOddsBps ?? null,
    baseOddsBps: market.base_odds[outcome],
    slippageBps: input.slippageBps ?? USER_SLIPPAGE_BPS_DEFAULT,
    degraded: input.degraded,
  });

  return deps.submitOnchainBet({
    fixtureId: input.selection.fixtureId,
    matchId: market.match_id,
    marketType: market.market_type,
    outcome,
    line: market.line,
    stakeOdd: input.stakeOdd,
    decimalOdds: input.selection.odds,
    minOddsBpsOverride,
    minAcceptedWeiOverride: input.minAcceptedWeiOverride,
    seq: input.seq,
    onState: input.onState,
    deferReceipt: input.deferReceipt,
  });
}
