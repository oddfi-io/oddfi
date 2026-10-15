/**
 * DD-137 链上注单 Cash Out（提前兑现 / 撤单）· 纯方案 B（REQ-003）：
 *
 *   报价：getOnchainMarkets(fixtureId) → 按 (market_type, line) 匹配盘口
 *         → quoted_odds[outcome] 当前赔率 + quote_version
 *         → calcCashoutEstimate（合约公式前端复算，链上无兑现预览接口）
 *   提交：onchainCashOut(bet_id, expected_quote_version, quoted_at, min_amount_out)
 *         → tx_hash → poll receipt（镜像 onchain-claim 的 relay 模式）
 *
 * 报价输入全部来自 history `event_info`（REQ-003 后端字段：fixture_id / outcome /
 * market_type_code / line_code / accepted_amount_wei / locked_odds_raw），单次 GET /market/onchain
 * 即可，**已弃用** orders/:id + preview-signal + keccak marketId 推导（方案 A）。
 *
 * 与 onchain-claim 的差异（为何不并入同一文件）：
 *   - 幂等键 = bet_id 服务端自动生成，前端不传 idempotency_key
 *   - 需要报价保护参数（expected_quote_version / quoted_at），合约 30s TTL
 *   - 合约 revert 透传 HTTP 500 + message（QuoteExpired / NotPending / ...），
 *     需按「报价过期可重试」vs「注单不可撤」分类，错误域与 claim 完全不同
 *
 * 金额公式（oddfi-ODD api.md §cashOut，BettingPool@2026-06-03）：
 *   remainingStake   = acceptedAmount - refundedAmount（active 单 refundedAmount=0 → = acceptedAmount）
 *   releasedPayout   = remainingStake × lockedOdds / 1e4
 *   theoreticalValue = releasedPayout × 1e4 / currentOdds
 *   feeBps           = 距开赛 > 30min ? 1000 : 2000
 *   cashOutAmount    = theoreticalValue × (10000 - feeBps) / 10000
 *   约束：返还 ≥ 10 ODD（合约硬下限），注单 Pending + market Open。
 */

import { HTTPError } from "ky";
import { onchainCashOut, getOnchainMarkets } from "@/lib/api";
import { waitForReceipt, type WaitForReceiptResult } from "@/lib/onchain/receipt-poller";
import { mul, div, cmp } from "@/lib/decimal";
import type { OnchainCashOutReq, OnchainMarketRes, OnchainTxRes } from "@/types/onchain-betting";

// ─── 可退金额预估（纯函数） ───────────────────────────────────────────────────

/** 合约 cashOut 硬下限：返还低于 10 ODD 必 revert */
export const CASHOUT_CONTRACT_MIN_ODD = "10";

/** 开赛前 30 分钟分界：之前 fee 10%（1000 bps），之后 20%（2000 bps） */
const FEE_BOUNDARY_MS = 30 * 60 * 1000;
const WEI_PER_ODD = "1000000000000000000";

export interface CashoutEstimateInput {
  /** ODD wei string — 链上实际接受本金（event_info.accepted_amount_wei，或 stake×1e18 回退） */
  acceptedAmountWei: string;
  /** 万分位整数字符串 — 下注时锁定赔率（event_info.locked_odds_raw，或 odds×1e4 回退） */
  lockedOdds: string;
  /** 万分位整数字符串 — 当前报价赔率（/market/onchain quoted_odds[outcome]）；必须 > 0 */
  currentOdds: string;
  /** 开赛时间（ms epoch），决定 feeBps 档位 */
  matchTimeMs: number;
  /** 当前时间（ms epoch）；由调用方注入，保持纯函数可测 */
  nowMs: number;
}

export interface CashoutEstimate {
  /** 人类可读 ODD 预估兑现额（未截断精度，展示层再 formatDisplayAmount） */
  estimateOdd: string;
  /** 1000（开赛 30min 前）| 2000（临近/开赛后） */
  feeBps: 1000 | 2000;
  /** 预估额 < 合约硬下限 10 ODD —— 提交必 revert，UI 应禁用 Confirm */
  belowContractMin: boolean;
}

/**
 * 前端复算合约 cashOut 返还额（**预估值**）。
 *
 * ⚠️ currentOdds 取自 /market/onchain 的 quoted_odds[outcome]（链上展示赔率），与合约
 * cashOut 结算瞬间的赔率可能有微小漂移 —— 展示标注预估，实际到账以链上 BetCashedOut 事件为准。
 */
export function calcCashoutEstimate(input: CashoutEstimateInput): CashoutEstimate {
  const { acceptedAmountWei, lockedOdds, currentOdds, matchTimeMs, nowMs } = input;
  if (cmp(currentOdds, "0") <= 0) {
    // degraded 报价（RPC 故障兜底 lockedOdds="0"）不允许进入金额计算，调用方应禁用 Confirm
    throw new Error("[OnchainCashout] currentOdds must be > 0 — degraded quote not allowed");
  }
  // 方案 B：accepted_amount_wei 已是成交净本金，active 单 refundedAmount=0 → remaining = accepted
  // releasedPayout × 1e4 / currentOdds 中 lockedOdds/1e4 与 ×1e4 抵消 → accepted × locked / current
  const theoreticalWei = div(mul(acceptedAmountWei, lockedOdds), currentOdds);
  const feeBps: 1000 | 2000 = matchTimeMs - nowMs > FEE_BOUNDARY_MS ? 1000 : 2000;
  const estimateWei = div(mul(theoreticalWei, String(10000 - feeBps)), "10000");
  const estimateOdd = div(estimateWei, WEI_PER_ODD);
  return {
    estimateOdd,
    feeBps,
    belowContractMin: cmp(estimateOdd, CASHOUT_CONTRACT_MIN_ODD) < 0,
  };
}

// ─── 报价编排（纯方案 B：单次 GET /market/onchain）────────────────────────────

const ODDS_BASIS_MUL = "10000"; // 人类可读赔率 → 万分位（×1e4）

export type CashoutQuoteUnavailableReason =
  /** /market/onchain 该 fixture 下找不到匹配 (market_type, line) 的盘口（已关/未返回）*/
  | "market-not-found"
  /** 匹配到盘口但 quoted_odds[outcome] 缺失或 <= 0（盘口锁定/降级）—— 报价临时不可用 */
  | "no-live-quote";

export class CashoutQuoteUnavailableError extends Error {
  constructor(public reason: CashoutQuoteUnavailableReason) {
    super(`[OnchainCashout] Quote unavailable — ${reason}`);
    this.name = "CashoutQuoteUnavailableError";
  }
}

export interface CashoutQuoteArgs {
  /** 赛事 ID（event_info.fixture_id）；GET /market/onchain 入参 */
  fixtureId: number;
  /** 合约 outcome 索引（event_info.outcome）；取 quoted_odds[outcome]。0 合法 */
  outcome: number;
  /** 合约 marketType 数值（event_info.market_type_code）；匹配 markets[].market_type。0 合法 */
  marketTypeCode: number;
  /** 合约 line 数值编号（event_info.line_code）；匹配 markets[].line。0 合法 */
  lineCode: number;
  /** accepted 本金原始 wei（event_info.accepted_amount_wei）；缺省回退 betAmountOdd×1e18 */
  acceptedAmountWei?: string;
  /** locked_odds 原始万分位（event_info.locked_odds_raw）；缺省回退 oddsDecimal×1e4 */
  lockedOddsRaw?: string;
  /** 回退用：人类可读本金（event_info.stake / PortfolioBet.betAmount）*/
  betAmountOdd: string;
  /** 回退用：人类可读锁定赔率（event_info.odds / PortfolioBet.odds）*/
  oddsDecimal: string;
  /** 开赛时间 ms epoch（parseFixtureTimeMs(bet.matchTime)）；解析失败传 0 → 保守按 20% fee */
  matchTimeMs: number;
  nowMs: number;
}

export interface CashoutQuote {
  estimate: CashoutEstimate;
  /** 提交 cash_out 用的 expected_quote_version（十进制整数字符串，来自匹配盘口 quote_version）*/
  quoteVersion: string;
}

interface QuoteDeps {
  getOnchainMarkets: (fixtureId: number) => Promise<OnchainMarketRes>;
}

const defaultQuoteDeps: QuoteDeps = { getOnchainMarkets };

/**
 * Cash Out 报价链路（DD-137 纯方案 B）：
 *   GET /market/onchain?fixture_id → markets.find((market_type, line)) → quoted_odds[outcome] → 复算预估额
 *
 * 报价输入全部来自 history event_info（fixture_id/outcome/数值编码/原始 wei/万分位），单次网络请求。
 * Confirm 提交前必须**重新调用本函数取鲜** quoteVersion（合约 30s TTL，DD-137 §3.3）。
 */
export async function fetchCashoutQuote(
  args: CashoutQuoteArgs,
  deps: QuoteDeps = defaultQuoteDeps
): Promise<CashoutQuote> {
  const { markets } = await deps.getOnchainMarkets(args.fixtureId);
  // market_type / line 同为合约 uint8 编码，与 event_info 数值字段同源 → 直接数值相等匹配
  const market = markets.find(
    (m) => m.market_type === args.marketTypeCode && m.line === args.lineCode
  );
  if (!market) {
    throw new CashoutQuoteUnavailableError("market-not-found");
  }
  // 当前展示赔率取 quoted_odds[outcome]（万分位整数）；缺失/<=0 = 盘口锁定或降级，不可报价
  const currentOdds = market.quoted_odds?.[args.outcome];
  if (currentOdds == null || currentOdds <= 0) {
    throw new CashoutQuoteUnavailableError("no-live-quote");
  }

  // 原始 wei/万分位优先（后端 REQ-003 已给，零反算）；缺省时按人类可读值确定性换算
  const acceptedAmountWei = args.acceptedAmountWei ?? mul(args.betAmountOdd, WEI_PER_ODD);
  const lockedOdds = args.lockedOddsRaw ?? mul(args.oddsDecimal, ODDS_BASIS_MUL);

  const estimate = calcCashoutEstimate({
    acceptedAmountWei,
    // 方案 B：accepted_amount_wei 已是成交净本金，active 单 refundedAmount=0 → 不再减
    lockedOdds,
    currentOdds: String(currentOdds),
    matchTimeMs: args.matchTimeMs,
    nowMs: args.nowMs,
  });

  return {
    estimate,
    quoteVersion: String(market.quote_version),
  };
}

// ─── 提交编排 ────────────────────────────────────────────────────────────────

export class OnchainCashoutRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainCashout] Cash out reverted on chain: ${txHash}`);
    this.name = "OnchainCashoutRevertedError";
  }
}

export interface OnchainCashoutInput {
  /** 链上 betId（LedgerRecord.bet_id，0x 前缀或裸 64 位 hex，前端透传） */
  betId: string;
  /** 提交时刻取鲜的报价版本号（preview-signal quoteVersion，十进制整数字符串） */
  expectedQuoteVersion: string;
  /** 报价生成时刻 unix 秒；合约 30s TTL，生成后必须立即提交 */
  quotedAt: number;
  /** 最低可接受兑现额（人类可读 ODD）；缺省 "0" 不设滑点下限 */
  minAmountOut?: string;
}

export interface OnchainCashoutResult {
  txHash: `0x${string}`;
}

interface Deps {
  onchainCashOut: (req: OnchainCashOutReq) => Promise<OnchainTxRes>;
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
}

const defaultDeps: Deps = {
  onchainCashOut,
  waitForReceipt: (hash) => waitForReceipt(hash),
};

export async function submitOnchainCashout(
  input: OnchainCashoutInput,
  deps: Deps = defaultDeps
): Promise<OnchainCashoutResult> {
  const res = await deps.onchainCashOut({
    bet_id: input.betId,
    expected_quote_version: input.expectedQuoteVersion,
    quoted_at: input.quotedAt,
    min_amount_out: input.minAmountOut ?? "0",
  });
  const txHash = res.tx_hash as `0x${string}`;

  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") {
    throw new OnchainCashoutRevertedError(txHash);
  }
  return { txHash };
}

// ─── 错误分类 ────────────────────────────────────────────────────────────────

/**
 * cash_out 失败分类（决定 UI 动作）：
 * - quote-stale：报价过期/版本不符/滑点不足 → 可重试，refetch 报价后引导用户重新 Confirm
 * - not-cancellable：注单已非 Pending / 盘口已锁或关闭 / 非本人 → 终态，刷新列表
 * - already-cashed-out：后端 guard 同步拒绝（HTTP 400，无 tx 上链）且注单已提前兑现 → 终态，刷新列表
 * - state-unverified：后端读链失败且降级配额耗尽（HTTP 503，retryable）→ 不刷新，可原地重试
 * - not-ready：onchain_bet_id 事件索引未回填 → info 提示稍后再试（不算失败）
 * - unknown：网络错误等其它情况
 */
export type CashoutErrorKind =
  | "quote-stale"
  | "not-cancellable"
  | "already-cashed-out"
  | "state-unverified"
  | "not-ready"
  | "unknown";

const QUOTE_STALE_MARKERS = ["quoteexpired", "quoteversionmismatch", "slippageexceeded"];
// 后端 ENH-007 guard：relay 代发前同步校验链上状态，message 前缀稳定（后端单测钉住）。
// "onchain bet not pending"（带空格）≠ 合约 revert 名 "notpending"（无空格），两者都要匹配。
const NOT_PENDING_GUARD_MARKER = "onchain bet not pending";
const ALREADY_CASHED_OUT_MARKER = "state=cashed_out";
const STATE_UNVERIFIED_MARKER = "state unverified";
const NOT_CANCELLABLE_MARKERS = [
  "notpending",
  "marketnotopen",
  "notowner",
  // 故意双重出现：already-cashed-out 分支先行拦截 state=cashed_out，此处兜其余 state 的 guard 拒绝
  NOT_PENDING_GUARD_MARKER,
];

/**
 * 后端把合约 revert 透传为 HTTP 500 + message（如 "QuoteExpired"）；
 * 索引未回填为 HTTP 400 + "onchain bet id not found or not ready..."。
 * 统一从 responseJSON.message（lib/api.ts beforeError 已挂载）+ error.message 子串匹配。
 *
 * 注意：`OnchainCashoutRevertedError`（tx 已广播但链上 revert）**不走本函数**——
 * 它发生在 receipt 轮询阶段而非 HTTP 阶段，由调用方（useOnchainCashout.onError）instanceof 先行拦截。
 */
export function classifyCashoutError(error: unknown): CashoutErrorKind {
  if (!error) return "unknown";

  let msg = "";
  if (error instanceof HTTPError) {
    const json = (error as { responseJSON?: { message?: string; code?: unknown } }).responseJSON;
    msg = `${json?.message ?? ""} ${String(json?.code ?? "")}`;
  }
  if (error instanceof Error) {
    msg += ` ${error.message}`;
  }
  const lower = msg.toLowerCase();

  // 先细后粗：guard 拒绝中 state=cashed_out 单独成类（文案区分「已提前结算」vs 泛用「不可撤」）
  if (lower.includes(NOT_PENDING_GUARD_MARKER) && lower.includes(ALREADY_CASHED_OUT_MARKER)) {
    return "already-cashed-out";
  }
  if (lower.includes(STATE_UNVERIFIED_MARKER)) return "state-unverified";
  if (QUOTE_STALE_MARKERS.some((m) => lower.includes(m))) return "quote-stale";
  if (NOT_CANCELLABLE_MARKERS.some((m) => lower.includes(m))) return "not-cancellable";
  if (lower.includes("not ready") || lower.includes("erronchainbetnotready")) return "not-ready";
  return "unknown";
}
