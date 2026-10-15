import { convertOdd, isValidAmount } from "@/lib/decimal";
import { parseFixtureName } from "@/lib/format/fixture";
import { bannerTitleFromMarket } from "@/lib/banner-portfolio-meta";
import { normalizeBetStatus } from "@/lib/normalize-bet-status";
import { LEDGER_STATUS } from "@/types/auth";
import type { BetStatus, BusinessType, LedgerRecord, ParlayLeg } from "@/types/auth";
import type {
  BetSettlementStatus,
  CashOutState,
  PortfolioBet,
  TransactionRecord,
} from "@/types/portfolio";

// 后端 ledger.status 数值 → 前端字符串字面量（缺省/未知 → "completed" 兜底，保持向后兼容）
function mapLedgerStatus(status: number | undefined): TransactionRecord["status"] {
  switch (status) {
    case LEDGER_STATUS.IN_PROGRESS:
      return "in_progress";
    case LEDGER_STATUS.REVIEWING:
      return "reviewing";
    case LEDGER_STATUS.COMPLETED:
      return "completed";
    case LEDGER_STATUS.FAILED:
      return "failed";
    case LEDGER_STATUS.APPEALING:
      return "appealing";
    case LEDGER_STATUS.CANCELED:
      return "canceled";
    default:
      return "completed";
  }
}

// 大写 BetStatus → 前端 BetSettlementStatus 单一源（DD-087 §3.1）
// CLAIMED 在 settled 视图等同 won（已领奖的 won 注单）；CANCELLED 等同 void
const STATUS_TO_SETTLEMENT: Record<BetStatus, BetSettlementStatus> = {
  PENDING: "pending",
  // DD-105 Batch 7 — 链上下注 BetPlaced 事件已回填(bet_id 就绪)但赛事未结算
  // 与 banner_single 小写 "live" 同语义 → cashoutAvailable=true, claimable=false
  LIVE: "live",
  WON: "won",
  LOST: "lost",
  PUSH: "push",
  VOID: "void",
  CLAIMED: "won",
  CANCELLED: "void",
  // BUG-024 — 链上提前兑现：非 active（移出 My Bets）+ 不可领（资金已在撤单 tx 返还，避免误露 Claim 致链上 revert）
  CASHED_OUT: "cashed_out",
  // DD-105 Batch 7 — 链上 tx revert(approve / place_bet),本金未扣,语义最接近 void(无效注单)
  FAILED: "void",
  // DD-140 TC — claim 交易已广播、链上结果未落定；enable_claim 恒 false，约 15min 后 sweep 判定终态
  CLAIMING: "claiming",
};

// DD-087 §4.4 单一源：business_type 映射
// 下注类（single / parlay / banner_single）落地后由 event_info.status 派生 won/lost/push/void —
// 用于"赢/输"筛选时活动列展示对应状态文本（Won / Lost / Push / Void）。
// claim_prize 始终展示为 "claim"，不再按结算状态进一步派生 —— 领奖筛选下统一显示 Claim。
// stake / lp 类（链下 + 链上 *_created/*_deposited 同语义归并）Activity 列展示
// STAKE / UNSTAKE / ADD LP / REMOVE LP，对齐 Figma 3474:80247。
const BUSINESS_TO_TX_TYPE: Record<BusinessType, TransactionRecord["type"]> = {
  single: "bet",
  parlay: "bet",
  banner_single: "bet",
  onchain_single: "bet", // DD-105 Batch 7 — 链上下注,展示语义同链下 single
  onchain_cashout: "cashout", // ENH-037 — 链上撤单兑现入账，+兑现额绿色，仅 History 流水
  claim_prize: "claim",
  cancel_bet: "cancel",
  withdraw: "withdraw",
  cancel_withdraw: "withdraw",
  deposit: "deposit",
  stake: "stake",
  unstake: "unstake",
  add_lp: "add_lp",
  remove_lp: "remove_lp",
  // 链上 Stake / Liquidity 流水（chain_consumer 直写 asset_ledger）— 展示语义同链下对应类型
  stake_created: "stake",
  stake_withdrawn: "unstake",
  liquidity_deposited: "add_lp",
  liquidity_unbond_requested: "remove_lp",
  liquidity_withdrawn: "remove_lp",
  // 链上下注扣款流水行（含手续费），与 onchain_single 成对 — ledgerToTransaction 返回 null 过滤，此映射仅兜底
  bet_placed: "bet",
  // 结算 worker 可领奖入账流水 — ledgerToTransaction 返回 null 过滤，此映射仅满足 Record 完整性兜底
  bet_settle: "bet",
};

const BET_PLACEMENT_TYPES: ReadonlySet<BusinessType> = new Set([
  "single",
  "parlay",
  "banner_single",
  "onchain_single", // DD-105 Batch 7 — 链上下注与链下注单同属 bet placement
]);

export function mapStatus(status: BetStatus | "live" | string): BetSettlementStatus {
  // 优先大写 BetStatus 直查（DB 原值）
  const upper = (status ?? "").trim().toUpperCase();
  if (upper in STATUS_TO_SETTLEMENT) {
    return STATUS_TO_SETTLEMENT[upper as BetStatus];
  }
  // 走通用归一（小写 live / pending / won / lost / push / void / 未知 → "active"）
  return normalizeBetStatus(status);
}

/**
 * business_type → 前端 TransactionRecord.type（DD-087 §4.4）
 *
 * - 下注类（single / parlay / banner_single）：event_info.status 已结算（WON/LOST/PUSH/VOID）
 *   时派生 won/lost/push/void，用于"赢/输"筛选下活动列展示结算结果；未结算保持 "bet"。
 * - claim_prize：始终为 "claim"（领奖筛选展示 Claim，不再按结算状态进一步派生）。
 * - 其他业务类型：直接查表。
 */
export function mapBusinessType(
  bt: BusinessType,
  rawStatus?: string | null
): TransactionRecord["type"] {
  if (BET_PLACEMENT_TYPES.has(bt)) {
    const norm = normalizeBetStatus(rawStatus);
    if (norm === "won" || norm === "lost" || norm === "push" || norm === "void") {
      return norm;
    }
  }
  return BUSINESS_TO_TX_TYPE[bt] ?? "bet";
}

/**
 * fixture_time → ms epoch。后端两种形态："2026-05-30T16:00:00Z" / "2026-05-30 16:00:00"（UTC 无标记）。
 * 解析失败返回 null。DD-137 Cash Out 的 feeBps 档位判定也用它（开赛前 30min 分界）。
 */
export function parseFixtureTimeMs(fixtureTime?: string): number | null {
  if (!fixtureTime) return null;
  const normalized = fixtureTime.includes("T") ? fixtureTime : fixtureTime.replace(" ", "T") + "Z";
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? null : ts;
}

/** 比赛时间 → matchStatus（粗粒度：未开赛 upcoming / 已开赛或过期 finished） */
export function deriveMatchStatus(fixtureTime?: string): PortfolioBet["matchStatus"] {
  const ts = parseFixtureTimeMs(fixtureTime);
  if (ts === null) return "finished";
  return ts > Date.now() ? "upcoming" : "finished";
}

/** amount 可能是 "-100" 负数字符串；展示层统一用绝对值 */
export function absAmount(amount: string): string {
  return amount.startsWith("-") ? amount.slice(1) : amount;
}

/** 链上 history 行 ref_id 前缀（后端 model.AssetRefPrefixOnchainBet，对齐 convertChainOrdersToLedgers）。 */
const ONCHAIN_REF_PREFIX = "onchain:";

/**
 * 从链上 history 行 `ref_id`（形如 `"onchain:<order_id>"`）解析后端 order_id（BUG-024）。
 * 非该前缀 / 解析失败 → undefined（链下行 ref_id 是纯数字 bet_id，不带前缀，自然返回 undefined）。
 */
export function parseOnchainOrderId(refId?: string): number | undefined {
  if (!refId || !refId.startsWith(ONCHAIN_REF_PREFIX)) return undefined;
  const n = Number.parseInt(refId.slice(ONCHAIN_REF_PREFIX.length), 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * 解析后端 `event_info.score` / `parlay_legs[].score` 终场比分串 "主-客"（如 "2-1"）。
 *
 * 后端口径（web-api model/fixture_result.go HistoryScoreForStatus）：
 * 已结算注单透出真实比分、取消/作废恒 "0-0"、未结算/查不到赛果为空串或缺省。
 * 比分是进球数，非负整数，无小数/负号场景。
 *
 * 非法格式（空 / 非 "数字-数字"）→ null：下游 homeScore/awayScore 置 undefined，
 * UI（TeamVsVerticalCell）渲染 "--" 且不画胜方箭头 —— 处理外部 API 不确定性的边界防御。
 */
export function parseScoreString(score?: string | null): { home: number; away: number } | null {
  if (!score) return null;
  const matched = /^(\d+)-(\d+)$/.exec(score.trim());
  if (!matched) return null;
  return { home: Number(matched[1]), away: Number(matched[2]) };
}

/**
 * 取消/作废类注单状态（REV-feat-portfolio-settled-score-v1 Major-1/2）。
 * 后端对这些状态恒发占位 `score="0-0"`（业务约定，不依赖赛果——赛事可能根本没打完），
 * 并非真实终场比分。前端必须过滤掉，置 undefined → UI 渲染 "--"，
 * 否则会展示成与真实 0-0 平局无法区分的"平局"样式。
 */
const CANCELLED_LIKE_STATUSES: ReadonlySet<string> = new Set([
  "CANCELLED",
  "CANCEL",
  "VOID",
  "REFUNDED",
  // BUG-024 — 链上提前兑现，无终场比分（撤单发生在比赛中途），过滤占位比分 → UI 渲染 "--"
  "CASHED_OUT",
]);

/**
 * 链下串关子腿 ParlayLeg → PortfolioBet（DD-115）
 *
 * 调用方先把 `event_info.parlay_legs` 按 `leg_index` 排序后再喂进来。
 * ⚠️ 后端 parlay_legs[] 子腿不携带金额维度字段（stake / payout / settled_at 仅父单层有），
 *     这里把这些字段填空串。**UI 渲染时必须把展开行的 Bet / Payout / Settle time 列显式渲染 "--"，
 *     不能信任 leg.betAmount 这类字段做展示**。
 *
 * @param parentRefId 父单 ledger.ref_id，用于拼 React key 唯一 id（去重 `${parent}-leg-${index}`）
 */
export function parlayLegToBetLeg(leg: ParlayLeg, parentRefId?: string): PortfolioBet {
  const { home, away } = parseFixtureName(leg.fixture_name);
  // 子腿终场比分（后端 parlay_legs[].score "主-客"）；未结算/非法 → undefined，UI 渲染 "--"。
  // 取消/作废子腿后端恒发占位 "0-0"，过滤不展示（见 CANCELLED_LIKE_STATUSES）
  const legScore = CANCELLED_LIKE_STATUSES.has((leg.status ?? "").trim().toUpperCase())
    ? null
    : parseScoreString(leg.score);
  return {
    id: `${parentRefId ?? "parlay"}-leg-${leg.leg_index}-${leg.bet_id}`,
    betId: leg.bet_id,
    homeTeam: { name: home, iconUrl: leg.home_team_logo ?? "" },
    awayTeam: { name: away, iconUrl: leg.away_team_logo ?? "" },
    leagueTag: "",
    marketTag: leg.market_type,
    selectionTag: leg.selection,
    // 金额维度字段父单才有；UI 必须按"展开行规约"渲染 "--"
    betAmount: "",
    betAmountUsd: "",
    potentialWin: "",
    potentialWinUsd: "",
    odds: leg.odds,
    matchStatus: deriveMatchStatus(leg.fixture_time),
    settlementStatus: mapStatus(leg.status),
    matchTime: leg.fixture_time,
    homeScore: legScore?.home,
    awayScore: legScore?.away,
  };
}

/**
 * 下注流水 → PortfolioBet（MyBets / Active / Settled）
 * 非 bet 类 ledger（event_info 为 null）返回 null，调用方需 filter。
 */
export function ledgerToBet(r: LedgerRecord, rate: string | null): PortfolioBet | null {
  if (!r.event_info) return null;
  const info = r.event_info;
  // banner_single 判定容错：后端历史脏数据存在 business_type="single" 但 event_info.type="banner_single"
  // 任一命中即走 banner 分支，标题用 info.selection（如"西班牙"），away 留空
  const isBanner = r.business_type === "banner_single" || info.type === "banner_single";
  const { home, away } = isBanner
    ? { home: info.selection, away: "" }
    : parseFixtureName(info.fixture_name);

  // 派生 settlementStatus 单一源 → 由它驱动 cashoutAvailable / claimable（DD-087 §3.2）
  const settlementStatus = mapStatus(info.status);
  // 后端 DB 大写枚举：CLAIMED 表示"已领"，需在 claimable 中排除（避免重复领奖）
  const rawUpper = (info.status ?? "").trim().toUpperCase();
  const isClaimed = rawUpper === "CLAIMED";
  // active 期（live / pending / active 兜底）的注单可撤 — Cancel 按钮显示条件
  const isActive =
    settlementStatus === "live" || settlementStatus === "pending" || settlementStatus === "active";
  // settled 且未领奖（won / push / void）— Claim 按钮显示条件；lost 不可领；CLAIMED 不可二次领
  // 优先后端 enable_claim（综合 ledger 状态/已领/申诉中等判定）；缺省 → 派生兜底
  const isClaimable =
    r.enable_claim ??
    (!isClaimed &&
      (settlementStatus === "won" || settlementStatus === "push" || settlementStatus === "void"));

  // DD-087 §2.1：claim 显示金额优先用 actual_payout（实际派彩），fallback 到 payout（potential）
  // LOST 时 actual_payout="0"，此时不可领（isClaimable=false 已挡住），不影响展示
  const settledPayout =
    info.actual_payout && info.actual_payout !== "" ? info.actual_payout : info.payout;

  // banner 流水：从 market_type 派生 banner 标题（前端临时映射）；后端补 banner_title 后切真字段
  const bannerTitle = isBanner ? bannerTitleFromMarket(info.market_type) : null;

  // ref_id 是 bet_id 的字符串形态；解析成 number 单独透传供 cancel/claim API 调用
  // 解析失败（NaN / 缺失）→ undefined，调用方需要兜底拦截
  const refIdNum = r.ref_id != null ? Number.parseInt(r.ref_id, 10) : NaN;
  const betId = Number.isFinite(refIdNum) ? refIdNum : undefined;

  // DD-105 Batch 7 — 链上下注标记 + onchain_bet_id 透传(从顶层 r.bet_id 取,见 types/auth.ts)
  // r.bet_id 为 undefined 时表示事件索引未回填,UI 应禁用 Claim 按钮
  const isOnchain = r.business_type === "onchain_single";
  const onchainBetId = isOnchain && r.bet_id ? r.bet_id : undefined;
  // BUG-024 — 链上行 ref_id 形如 "onchain:<order_id>"（后端 convertChainOrdersToLedgers）。
  // 解析出 order_id 供 MyBetsView 在 onchainBetId 回填前就与乐观 store 去重，消除双卡闪烁。
  const onchainOrderId = isOnchain ? parseOnchainOrderId(r.ref_id) : undefined;
  // 链上部分成交即时退回金额（后端信号灯成交回填，event_info.refund_amount）。
  // 非正数（"0"/"0.00"/空/非法）= 无部分成交 → undefined，UI 不渲染退回行；
  // betAmount 此时已是真实成交本金。isValidAmount 兜防后端 decimal 输出格式变体（REV N-1）。
  const refundAmount =
    isOnchain && info.refund_amount && isValidAmount(info.refund_amount)
      ? info.refund_amount
      : undefined;
  // DD-137 纯方案 B：链上单 active 期可撤（POST /account/onchain/cash_out）。
  // 报价走 history event_info 的 fixture_id + 数值 outcome/market/line（REQ-003），不再查 orders/:id。
  // outcome/code/line 的 0 为合法值（主胜 / 1X2），判断一律 `!= null`，禁止 truthy。
  // gating 前提：事件已回填（onchainBetId 存在 + 三个数值编码齐全）；链下单沿用 V1 bet_cancel 路径不变。
  const hasOnchainQuoteInputs =
    info.outcome != null && info.market_type_code != null && info.line_code != null;
  // ENH-038 · 链上撤单展示态（后端 event_info.cash_out_state，服务端推导、刷新安全）。
  // 缺省 / 链下行一律 "none"；cashing_out（正在取消）时按钮禁用，不可再发起兑现。
  const cashoutState: CashOutState = isOnchain ? (info.cash_out_state ?? "none") : "none";
  const cashoutAvailable =
    isActive &&
    cashoutState !== "cashing_out" &&
    (!isOnchain || (onchainBetId !== undefined && hasOnchainQuoteInputs));

  // DD-115 · 串关父单字段（仅 business_type === "parlay" 行有值，对齐 Lark 文档）
  // info.type === "parlay" 兜底保留（DD-087 时期遗留），但首选 business_type
  const isMulti = r.business_type === "parlay" || info.type.toLowerCase() === "parlay";
  // 终场比分：后端落地为 event_info.score "主-客" 串（已结算才有值）。
  // 取消/作废注单后端恒发占位 "0-0"（非真实赛果），过滤不展示（见 CANCELLED_LIKE_STATUSES）。
  // DD-115 预留的 home_score/away_score 数值字段保留为兼容回退，后端未发过该字段时无副作用。
  const isCancelledLike = CANCELLED_LIKE_STATUSES.has(rawUpper);
  const parsedScore = isCancelledLike ? null : parseScoreString(info.score);
  const sortedLegs = info.parlay_legs
    ? [...info.parlay_legs]
        .sort((a, b) => a.leg_index - b.leg_index)
        .map((leg) => parlayLegToBetLeg(leg, r.ref_id))
    : undefined;

  return {
    // ref_id 后端可能重复（脏数据），叠 created_at + odd_id 兜底 React key 唯一性
    id: `${r.ref_id ?? "no-ref"}-${info.odd_id}-${r.created_at}`,
    betId,
    isOnchain,
    onchainBetId,
    onchainOrderId,
    // DD-137 纯方案 B 报价输入（仅 onchain 行有值；0 合法，原样透传不做 falsy 兜底）
    cashoutFixtureId: isOnchain ? info.fixture_id : undefined,
    cashoutOutcome: isOnchain ? info.outcome : undefined,
    cashoutMarketTypeCode: isOnchain ? info.market_type_code : undefined,
    cashoutLineCode: isOnchain ? info.line_code : undefined,
    cashoutAcceptedAmountWei: isOnchain ? info.accepted_amount_wei : undefined,
    cashoutLockedOddsRaw: isOnchain ? info.locked_odds_raw : undefined,
    homeTeam: { name: home, iconUrl: info.home_team_logo ?? "" },
    awayTeam: { name: away, iconUrl: info.away_team_logo ?? "" },
    leagueTag: "",
    marketTag: info.market_type,
    selectionTag: info.selection,
    betAmount: info.stake,
    betAmountUsd: convertOdd(info.stake, rate),
    potentialWin: info.payout,
    potentialWinUsd: convertOdd(info.payout, rate),
    odds: info.odds,
    matchStatus: deriveMatchStatus(info.fixture_time),
    settlementStatus,
    cashoutAvailable,
    cashoutState,
    claimable: isClaimable,
    claimAmount: isClaimable ? settledPayout : undefined,
    claimAmountUsd: isClaimable ? convertOdd(settledPayout, rate) : undefined,
    // DD-140 TB — 透传税率（仅链上行有值，链下行 undefined）
    payoutTaxBps: isOnchain ? (info.payout_tax_bps ?? undefined) : undefined,
    refundAmount,
    matchTime: info.fixture_time,
    settledAt: info.settled_at,
    createdAt: r.created_at,
    isMulti,
    // DD-115 · 串关字段（仅 parlay 行有值）
    legCount: info.leg_count,
    legs: sortedLegs,
    parlayGroupId: info.parlay_group_id,
    parlayParentId: info.parlay_parent_id,
    // 比分：优先 event_info.score 解析值，回退 DD-115 预留数值字段；取消/作废单与缺省均 undefined → UI 渲染 "--"
    homeScore: isCancelledLike ? undefined : (parsedScore?.home ?? info.home_score ?? undefined),
    awayScore: isCancelledLike ? undefined : (parsedScore?.away ?? info.away_score ?? undefined),
    // DD-115 · 盘口数（后端待补）
    handicapLine: info.handicap_line ?? undefined,
    banner: isBanner
      ? {
          code: info.market_type,
          title: bannerTitle ?? info.selection,
        }
      : undefined,
  };
}

/**
 * 任意流水 → TransactionRecord（历史 Tab 全类型混排）
 * event_info == null（withdraw/claim_prize/cancel_bet 等）时，match 字段留空。
 *
 * bet_placed 返回 null（调用方 filter）：它是链上下注的扣款流水行（含手续费，ref_id=tx hash），
 * 与带完整比赛信息的 onchain_single 行成对出现 —— 双行展示是重复噪音，设计稿（Figma 3474:80247）
 * 也无此行样式。后端若停发该类型此过滤自然失效，无副作用。
 *
 * bet_settle 返回 null（调用方 filter）：结算 worker 自动记的可领奖入账流水
 * （oddfi-bet-settle worker.go:341 写 asset_ledger），用户侧已由现有 Claim 按钮（注单 status=WON
 * 未领）体现，不该再当流水行展示。后端若停发该类型此过滤自然失效，无副作用。
 */
export function ledgerToTransaction(
  r: LedgerRecord,
  rate: string | null
): TransactionRecord | null {
  if (r.business_type === "bet_placed" || r.business_type === "bet_settle") return null;
  const info = r.event_info;
  // banner_single 容错：business_type 或 event_info.type 任一命中即走 banner 分支
  const isBanner = r.business_type === "banner_single" || info?.type === "banner_single";
  const team = info
    ? isBanner
      ? { home: info.selection, away: "" }
      : parseFixtureName(info.fixture_name)
    : null;
  const txType = mapBusinessType(r.business_type, info?.status);
  const bannerTitle = isBanner && info ? bannerTitleFromMarket(info.market_type) : null;

  // 结算类（won / lost / void）金额改用 event_info.payout 替代 ledger.amount(stake)：
  // - won：+payout（赢款）
  // - lost：-payout（亏损）
  // - void：+payout（退款，正数）
  // 用户需求：Portfolio 历史 "赢/输/退款" 状态展示结算金额，而非下注流水中的 stake。
  const useEventPayout =
    (txType === "won" || txType === "lost" || txType === "void") && info?.payout;
  const amountAbs = useEventPayout ? absAmount(info!.payout) : absAmount(r.amount);
  const isPositive = useEventPayout
    ? txType === "won" || txType === "void"
    : !r.amount.startsWith("-");

  return {
    // ref_id 后端可能重复，叠 created_at + business_type 兜底 React key 唯一性
    id: `${r.ref_id ?? "no-ref"}-${r.business_type}-${r.created_at}`,
    type: txType,
    businessType: r.business_type,
    isOnchain: r.business_type === "onchain_single",
    homeTeam: team ? { name: team.home, iconUrl: info?.home_team_logo ?? "" } : undefined,
    awayTeam: team ? { name: team.away, iconUrl: info?.away_team_logo ?? "" } : undefined,
    marketTag: info?.market_type,
    selectionTag: info?.selection,
    odds: info?.odds,
    matchTime: info?.fixture_time,
    amount: amountAbs,
    amountUsd: convertOdd(amountAbs, rate),
    isPositive,
    time: r.created_at,
    status: mapLedgerStatus(r.status),
    banner:
      isBanner && info
        ? {
            code: info.market_type,
            title: bannerTitle ?? info.selection,
          }
        : undefined,
  };
}
