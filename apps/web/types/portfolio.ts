// Portfolio page types — DD-054 §4.4 / DD-087 §3.1
// PortfolioBet is the display-layer type; MockOrder (types/betting.ts) remains for BetSlip.

import type { BusinessType } from "./auth";

/**
 * 注单结算状态单一源（DD-087 §3.1）
 * - 全部小写归一，入口走 `normalizeBetStatus()`
 * - 后端 DB 存储 WON/LOST/PUSH/VOID/PENDING/CANCELLED/CLAIMED 大写；接口 query/active 列表使用 live/pending 小写
 *
 * @deprecated `cashback` / `failed` 为旧 mock 残留，将随 DD-087 Batch 4/5 清理（adapter 不再产出）
 */
export type BetSettlementStatus =
  | "active" // 派生：active 列表行（前端兜底，后端无此原值）
  | "live" // 比赛进行中 / 未结算
  | "pending" // 待开赛 / 待结算
  | "won"
  | "lost"
  | "push" // 走水（盘口推迟）
  | "void" // 退款（赛事/盘口取消）
  | "cashed_out" // 链上提前兑现（cash out，BUG-024）：非 active + 不可领，资金已在撤单 tx 返还
  | "claiming" // DD-140 TC：claim 交易已广播、链上结果未落定（中间态）；约 15min 后 sweep 回 won 或终态 claimed
  | "cashback" // @deprecated DD-087 Batch 4/5 清理
  | "failed"; // @deprecated DD-087 Batch 4/5 清理

/**
 * 链上注单撤单/兑现展示态（ENH-038，对齐后端 `event_info.cash_out_state`，服务端推导、刷新安全）：
 * - `none`：未发起兑现（可点「Cancel」）；后端 omitempty，字段缺失一律当 none
 * - `cashing_out`：已提交 cash_out、链上事件未回写且在 30s 窗口内（按钮禁用、显示「正在取消」）
 * - `cashed_out`：已确认取消（终态，移入 settled，`event_info.status=CASHED_OUT`）
 * 链下注单恒 none。30s 超时回退 none 由后端完成，前端不计时。
 */
export type CashOutState = "none" | "cashing_out" | "cashed_out";

export interface PortfolioBet {
  id: string;
  /** 后端 bet_id 数字原值（来自 ref_id parseInt）— 专供链下 cancel/claim API 调用，缺失则不可取消/领奖 */
  betId?: number;
  /**
   * DD-105 Batch 7 — 链上下注标记。
   * `business_type === "onchain_single"` 时 true,触发 Claim UI 走 onchain 分支
   * (submitOnchainClaim) 而非中心化 claimPrize。
   */
  isOnchain?: boolean;
  /**
   * 链上下注 BettingPool onchain_bet_id (0x hex),由后端事件索引服务回填到
   * `LedgerRecord.bet_id` 顶层字段。仅 `isOnchain=true` 时有值;
   * onchain 行但 onchainBetId 为 undefined 表示事件索引未回填,Claim 按钮禁用 / 显示 PENDING。
   */
  onchainBetId?: string;
  /**
   * 链上注单后端 order_id（onchain_tx_orders.id，来自 history `ref_id="onchain:<id>"` 解析，BUG-024）。
   * 仅 isOnchain=true 行有值。MyBetsView 用它与乐观 pendingOnchainBetsStore 的 `orderId` 在 betId 回填前
   * 就做确定性去重——消除「乐观卡 + history 卡」双卡闪烁（onchainBetId 回填慢于 history 出现）。
   */
  onchainOrderId?: number;
  /**
   * 乐观链上注单「上链中」标记（BUG-024）。仅 MyBetsView 给 pendingOnchainBetsStore 的乐观卡置 true，
   * MyBetCard header 据此渲染「Confirming」badge；history 稳态卡无此标记。
   */
  confirming?: boolean;
  /**
   * DD-137 纯方案 B — 链上 Cash Out 报价输入（来自 history event_info，REQ-003 后端字段）。
   * 仅 isOnchain=true 且事件已回填的行齐全；前端用 fixtureId + outcome + 数值 market/line
   * 直接 GET /market/onchain?fixture_id 取 quoted_odds[outcome] + quote_version 算报价，
   * 不再走 orders/:id + preview-signal。outcome/code/line 的 0 为合法值，判断一律 `!= null`。
   */
  cashoutFixtureId?: number;
  cashoutOutcome?: number;
  cashoutMarketTypeCode?: number;
  cashoutLineCode?: number;
  /** accepted 本金原始 wei；缺省时报价层回退 betAmount×1e18 */
  cashoutAcceptedAmountWei?: string;
  /** locked_odds 原始万分位；缺省时报价层回退 odds×1e4 */
  cashoutLockedOddsRaw?: string;
  homeTeam: { name: string; iconUrl: string };
  awayTeam: { name: string; iconUrl: string };
  leagueTag: string;
  marketTag: string;
  selectionTag: string;
  betAmount: string;
  betAmountUsd: string;
  potentialWin: string;
  potentialWinUsd: string;
  odds: string;
  matchStatus: "live" | "upcoming" | "finished";
  settlementStatus: BetSettlementStatus;
  claimable?: boolean;
  claimAmount?: string;
  claimAmountUsd?: string;
  /**
   * 链上部分成交即时退回金额（event_info.refund_amount，ODD 十进制）。
   * 仅 isOnchain=true 且发生部分成交时非空；betAmount 此时已是真实成交本金（后端回填）。
   * 暂无 USD 孪生字段——退回行固定以 ODD 展示，需要 USD 时再补（simplify 删除了无消费方的 refundAmountUsd）。
   */
  refundAmount?: string;
  cashoutAvailable?: boolean;
  /**
   * 链上撤单/兑现展示态（ENH-038）。adapter 从 `event_info.cash_out_state` 派生，缺省 "none"。
   * `cashing_out` → MyBetCard Cancel 按钮禁用 + 显示「正在取消」；`cashed_out` → 已走 settled（BUG-024）。
   * 仅 isOnchain=true 行有意义；链下行恒 "none"。
   */
  cashoutState?: CashOutState;
  cashoutAmount?: string;
  cashoutAmountUsd?: string;
  /**
   * DD-140 TB — 链上注单派彩税率万分位（来自 event_info.payout_tax_bps）。
   * 仅 isOnchain=true 行有值；链下行为 undefined。缺省兜底 500（5%）。
   * ClaimModal 用此字段算税后净额；CLAIMED 终态改用 actual_payout（权威净额）。
   */
  payoutTaxBps?: number;
  matchTime: string;
  matchScore?: string;
  settledAt?: string;
  createdAt?: string;
  viewOnly?: boolean;
  isMulti?: boolean;
  legCount?: number;
  /**
   * 串关子腿明细（仅 isMulti=true 时有值；DD-115 由 adapter `parlayLegToBetLeg` 填充）。
   * ⚠️ 子腿不携带金额维度字段（betAmount / payout / settledAt 来自父单），
   * adapter 给这些字段填空串，UI 必须按 PortfolioBet.legs 展开行规约渲染 "--"。
   */
  legs?: PortfolioBet[];
  /** 串关分组 ID（DD-115，仅 isMulti=true） */
  parlayGroupId?: string;
  /** 串关父单 ID — 前端识别整张串单的唯一 key（DD-115，仅 isMulti=true） */
  parlayParentId?: number;
  // ─── DD-115 · 比赛比分（后端待补，单注行 + 串关父单都用得到） ────
  /** 主队进球数 */
  homeScore?: number;
  /** 客队进球数 */
  awayScore?: number;
  // ─── DD-115 · 盘口数（后端待补） ────
  /** 盘口数（Asian Handicap / Asian Total 必填，其他玩法可空） */
  handicapLine?: string;
  /**
   * Banner 下注的额外 meta（仅 banner_single 流水有值）。
   * Phase 3 后端补 banner_title 字段后，此字段由后端直接返回；
   * 当前由 lib/banner-portfolio-meta.ts 前端映射 market_type → title 临时填充。
   */
  banner?: {
    /** 后端 market_type 原值，如 "champion_winner" / "golden_ball" */
    code: string;
    /** banner 主标题（前端映射），如 "2026 FIFA World Cup Winner" */
    title: string;
  };
}

/**
 * 历史 Tab 交易类型单一源（DD-087 §4.4）
 * - bet：下注流水（single / parlay / banner_single / onchain_single）
 * - cancel：撤单（cancel_bet）
 * - claim：领奖（claim_prize 默认；按 event_info.status 派生 won/lost/push/void）
 * - won / lost / push / void：claim_prize 派生子类型
 * - deposit / withdraw：资金动作
 * - stake / unstake / add_lp / remove_lp：质押 / 流动性动作（链下 + 链上 *_created/*_deposited 等
 *   归并同一展示类型；Activity 列对齐 Figma 3474:80247 的 STAKE / ADD LP 行）
 */
export type TransactionType =
  | "bet"
  | "cancel"
  | "cashout" // ENH-037 链上撤单（cash out）兑现入账：+兑现额绿色，仅出现在 History 流水
  | "claim"
  | "won"
  | "lost"
  | "push"
  | "void"
  | "deposit"
  | "withdraw"
  | "stake"
  | "unstake"
  | "add_lp"
  | "remove_lp";

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  /** 原始后端 business_type — Market 列根据此值决定是否渲染特殊 ActivityCell */
  businessType: BusinessType;
  /** business_type === "onchain_single" 的派生标记,与 PortfolioBet.isOnchain 对称 */
  isOnchain?: boolean;
  // Match info (bet/cashout/lost/claimed have match context)
  homeTeam?: { name: string; iconUrl: string };
  awayTeam?: { name: string; iconUrl: string };
  marketTag?: string;
  selectionTag?: string;
  odds?: string;
  matchTime?: string;
  // Transaction details
  amount: string;
  amountUsd: string;
  isPositive: boolean;
  time: string;
  status:
    | "completed"
    | "pending"
    | "failed"
    | "in_progress"
    | "reviewing"
    | "appealing"
    | "canceled";
  /**
   * Banner 下注流水的额外 meta（仅 banner_single 类有值）。
   * 与 PortfolioBet.banner 同形：Market 列改用 PortfolioBannerCell（avatar + 标题 + 选项/赔率 tag）。
   * 后端补 banner_title 后由 adapter 直接消费。
   */
  banner?: {
    code: string;
    title: string;
  };
}
