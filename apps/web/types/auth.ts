// EOA 登录 Step 1
export interface LoginStep1Req {
  address: string;
  wallet_type: string;
  chain: string;
}

export interface LoginStep1Res {
  data: { nonce: string };
  done: false;
  require: string[];
  session_id: string;
  step: 1;
}

// EOA 登录 Step 2
export interface LoginStep2Req {
  session_id: string;
  address: string;
  wallet_type: string;
  chain: string;
  message: string;
  signature: string;
}

export interface LoginStep2Res {
  data: {
    access_token: { expire_at: number; token: string };
    refresh_token: { expire_at: number; token: string };
  };
  done: true;
  session_id: string;
  step: 2;
}

// 刷新 Token（响应结构与登录步骤不同，data 直接是扁平 token 字段）
export interface RefreshRes {
  access_token: string;
  refresh_token: string;
  expire_at: number;
}

export interface AccountBalanceRes {
  /** 可用余额（可质押 / 可加流动性 / 可下注），去尾零十进制 ODD 串（如 "412.5"），非 wei */
  available_balance: string;
  frozen_balance: string;
  /** DD-130 实测：live 返回此字段（可领取余额） */
  claimable_balance: string;
  bet_lock_balance: string;
  stake_lock_balance: string;
  liq_lock_balance: string;
  total_balance: string;
  /**
   * DD-146 — 站内可用 USDT 余额（DB 账本，去尾零十进制串，非 wei）。
   * 后端 service/auth.go 取 user_balance coin_symbol='usdt' 可用额（dev 已实现）。
   * 与链上 proxy 钱包余额是两套独立账本（参考 project_balance_dual_ledger）；
   * 老接口 / 未升级后端可能缺省，消费方需容错（?? "0"）。
   */
  usdt_available_balance?: string;
}

export interface DepositAddressRes {
  address: string;
  chain: string;
}

// ============================================================
// Withdraw API（DD-063）
// ============================================================

export interface WithdrawApplyReq {
  withdraw_address: string;
  withdraw_sign: string;
  sig_time: number;
  amount: string;
  chain: string;
  wallet_nonce: string;
}

export interface WithdrawApplyRes {
  withdraw_address: string;
  real_amount: string;
  fee: string;
  order_sn: string;
}

export interface WithdrawFeeReq {
  amount: string;
}

export interface WithdrawFeeRes {
  total_amount: string;
  fee: string;
  real_amount: string;
}

export interface WithdrawRecord {
  order_sn: string;
  chain: string;
  amount: string;
  fee: string;
  real_amount: string;
  to_address: string;
  tx_hash: string;
  status: number;
  created_at: string;
}

export interface WithdrawRecordsRes {
  records: WithdrawRecord[];
}

export interface WithdrawCancelReq {
  order: string;
}

// 提现状态枚举 — 与后端 service/withdraw 一致
export const WITHDRAW_STATUS = {
  PENDING_REVIEW: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  REJECTED: 4,
  FAILED: 5,
  CANCELED: 6,
} as const;

export type WithdrawStatus = (typeof WITHDRAW_STATUS)[keyof typeof WITHDRAW_STATUS];

const TERMINAL_STATUSES: ReadonlySet<WithdrawStatus> = new Set([
  WITHDRAW_STATUS.COMPLETED,
  WITHDRAW_STATUS.REJECTED,
  WITHDRAW_STATUS.FAILED,
  WITHDRAW_STATUS.CANCELED,
]);

export function isTerminalWithdrawStatus(status: number | null | undefined): boolean {
  return status != null && TERMINAL_STATUSES.has(status as WithdrawStatus);
}

export function isSuccessWithdrawStatus(status: number | null | undefined): boolean {
  return status === WITHDRAW_STATUS.COMPLETED;
}

export function isFailedWithdrawStatus(status: number | null | undefined): boolean {
  return (
    status === WITHDRAW_STATUS.REJECTED ||
    status === WITHDRAW_STATUS.FAILED ||
    status === WITHDRAW_STATUS.CANCELED
  );
}

export interface WithdrawRecordInfo extends WithdrawRecord {
  audit_at: string;
  finished_at: string;
  updated_at: string;
}

export interface WithdrawRecordInfoReq {
  orders: string[];
}

export interface WithdrawRecordInfoRes {
  list: WithdrawRecordInfo[];
  total: number;
}

// ============================================================
// Portfolio History API（DD-073 — 统一 bet_holding / asset_ledger）
// ============================================================

export type BusinessType =
  | "single"
  | "parlay"
  | "banner_single"
  | "onchain_single" // DD-105 Batch 7 · 后端 fdf73a2 — 链上下注 history 行
  | "onchain_cashout" // ENH-037 · 后端 ENH-037 — 链上撤单（cash out）兑现入账资金流水行（+cashOutAmount）
  | "cancel_bet"
  | "claim_prize"
  | "withdraw"
  | "cancel_withdraw"
  | "deposit"
  | "stake"
  | "unstake"
  | "add_lp"
  | "remove_lp"
  // ─── 链上 Stake / Liquidity 流水（chain_consumer 直写 asset_ledger，ref_id = tx hash，event_info 恒 null）───
  // 命名对齐 user_onchain_action.action_type 小写形态（web-api model/user_onchain_action.go）。
  // 实测已出现：stake_created / liquidity_deposited / bet_placed；
  // *_withdrawn / *_unbond_requested 为同族推定值（chain_consumer 仓库不在本地，待后端确认全集）。
  | "stake_created"
  | "stake_withdrawn"
  | "liquidity_deposited"
  | "liquidity_unbond_requested"
  | "liquidity_withdrawn"
  // 链上下注的扣款流水行（含手续费），与 onchain_single 行成对出现 — 前端过滤不展示
  | "bet_placed"
  // 结算 worker 自动记的可领奖入账流水（oddfi-bet-settle worker.go:341 写 asset_ledger），
  // 用户侧已由 Claim 按钮体现 — 前端过滤不展示；仅供判别，不进 BET_LIKE_TYPES
  | "bet_settle";

// DB 大写枚举（DD-087 §2.2 后端 user.go:984/1148）
// PUSH / VOID 由 ClaimBet 优化（commit 39ca776）扩展
// LIVE / FAILED 由 DD-105 Batch 7 · 后端 fdf73a2 onchain mapChainOrderToHistoryStatus 引入
export type BetStatus =
  | "PENDING"
  | "LIVE"
  | "WON"
  | "LOST"
  | "PUSH"
  | "VOID"
  | "CLAIMED"
  | "CANCELLED"
  // 链上提前兑现（cash out）：spider BetCashedOut consumer 回填，BUG-024。非 active + 不可领。
  | "CASHED_OUT"
  | "FAILED"
  // DD-140 TC：claim 交易已提交、链上结果未落定（中间态）；enable_claim 恒 false。约 15min 后 sweep 判定。
  | "CLAIMING";

/**
 * 链下串关子腿（DD-115 · 后端 20260523-1 · Lark 文档 R06DdokoXoodjNxf08UlBUjvgXe）
 *
 * 仅 `business_type === "parlay"` 时 `event_info.parlay_legs[]` 元素，
 * ⚠️ 子腿不带 `stake` / `payout` / `settled_at`（父单维度才有）。
 */
export interface ParlayLeg {
  bet_id: number;
  odd_id: number;
  status: BetStatus | "live" | string;
  odds: string;
  fixture_name: string;
  fixture_time: string;
  home_team_logo?: string;
  away_team_logo?: string;
  market_type: string;
  selection: string;
  /**
   * 子腿对应赛事终场比分 "主-客"（如 "2-1"）；规则同父单 `LedgerEventInfo.score`。
   * 后端 web-api model/request.go ParlayLegResult.Score（HistoryScoreForStatus 口径）。
   */
  score?: string;
  /** 子腿顺序（0-based） */
  leg_index: number;
}

export interface LedgerEventInfo {
  odd_id: number;
  stake: string;
  // banner_single 后端写"live"（小写），非 BetStatus 大写枚举
  // DB 大写存储 PENDING/WON/LOST/PUSH/VOID/CLAIMED/CANCELLED；前端用 normalizeBetStatus 归一
  status: BetStatus | "live" | string;
  type: "single" | "parlay" | "SINGLE" | "PARLAY" | "banner_single";
  odds: string;
  /** potential payout（赔率 × 本金，结算前的预期值） */
  payout: string;
  /** DD-087 §2.1：实际派彩金额（结算后）— Claim 入账以此为准；WON=赢款 / LOST="0" / PUSH=本金 / VOID=本金 */
  actual_payout?: string;
  /**
   * 链上部分成交（红灯撮合）即时退回金额，ODD 十进制字符串（后端已 shift -18）。
   * 仅 business_type=onchain_single 行可能非空；无部分成交时为 "0" 或缺省。
   * 后端 oddfi-backend@dev 0d68738（信号灯成交回填）。
   */
  refund_amount?: string;
  fixture_name: string;
  fixture_time: string;
  market_type: string;
  selection: string;
  home_team_logo?: string;
  away_team_logo?: string;
  /** 结算时间（settled tab 才有） */
  settled_at?: string;

  // ─── 比赛比分（后端 web-api model/request.go BetHoldingResult.Score）──
  /**
   * 终场比分展示串 "主-客"（如 "2-1"）。后端 HistoryScoreForStatus 口径：
   * - 取消/作废注单（CANCELLED/VOID/REFUNDED）恒 "0-0"；
   * - 已结算注单（WON/LOST/PUSH/CLAIMED）透出 fixture_results 真实终场比分，查不到赛果为空串；
   * - 未结算/进行中一律缺省（omitempty），前端不得把过程态当终场比分。
   * 前端经 adapter `parseScoreString` 解析为 homeScore/awayScore，非法/缺省 → UI 渲染 "--"。
   */
  score?: string;

  // ─── DD-137 · 链上 Cash Out 纯方案 B 报价字段（仅 business_type==="onchain_single" 行有值）─────
  // 后端 REQ-003：前端用这些直接 GET /market/onchain?fixture_id 算撤单报价，弃用 orders/:id + preview-signal。
  /** 赛事 ID；GET /market/onchain?fixture_id 的入参 */
  fixture_id?: number;
  /**
   * 合约 outcome 索引，取 quoted_odds[outcome]。后端 `*uint8`：**0 是合法值（主胜）**，链下行整个字段缺省。
   * ⚠️ 判断必须 `outcome != null`，禁止 `if (outcome)`（0 会 falsy 误判为缺失）。
   */
  outcome?: number;
  /** 合约 marketType 数值（0=1X2/1=亚让/2=大小）；匹配 /market/onchain markets[].market_type。**勿与字符串 market_type 混用**。0 合法，判断用 `!= null`。 */
  market_type_code?: number;
  /** 合约 line 数值编号；匹配 markets[].line。0 合法，判断用 `!= null`。 */
  line_code?: number;
  /** accepted 本金原始 wei（1e18）；事件未回填时缺省，前端回退 stake×1e18 */
  accepted_amount_wei?: string;
  /** locked_odds 原始万分位（1e4）；事件未回填时缺省，前端回退 odds×1e4 */
  locked_odds_raw?: string;

  /**
   * ENH-038 · 链上注单撤单/兑现展示态（服务端推导，刷新安全）。仅 onchain_single / onchain_cashout 行可能有值。
   * `none`（缺省即 none，omitempty）| `cashing_out`（正在取消，按钮禁用）| `cashed_out`（已取消终态，status=CASHED_OUT）。
   * 后端口径见 oddfi-backend `web-api/docs/2026-06-10-frontend-cash_out_state-对接说明.md`。前端只按枚举渲染，不自行计时。
   */
  cash_out_state?: "none" | "cashing_out" | "cashed_out";

  /**
   * DD-140 TB — 链上注单派彩税率（万分位，如 500 = 5%）。
   * 仅 onchain_single 行（链上行）恒有值，链下行不下发（undefined）。
   * 净额 = payout × (1 − payout_tax_bps / 10000)。缺省兜底 500（5%）。
   * actual_payout 字段（CLAIMED 终态）才是链上权威净额，优先展示 actual_payout。
   */
  payout_tax_bps?: number;

  // ─── DD-115 · 比赛比分数值字段（后端最终未采用，落地为上方 score 串；留作兼容回退）──
  /** 主队进球数；缺省时前端 Match 列展示 "--"，胜方箭头隐藏 */
  home_score?: number | null;
  /** 客队进球数 */
  away_score?: number | null;

  // ─── DD-115 · 盘口数（后端待补） ────────────────────────────────
  /** Asian Handicap / Asian Total 盘口数字（如 "0.5"、"-1.5"）；其他玩法可空 */
  handicap_line?: string | null;

  // ─── DD-115 · 链下串关父单字段（后端 20260523-1）─────────────────
  // 仅 business_type === "parlay" 行有值。
  /** 串关分组 ID（同一串关所有子腿一致） */
  parlay_group_id?: string;
  /** 串关父单 ID（= ref_id 数字形态） */
  parlay_parent_id?: number;
  /** 子腿数量 */
  leg_count?: number;
  /** 总赔率（= event_info.odds，冗余字段） */
  parlay_total_odds?: string;
  /** 子腿列表 */
  parlay_legs?: ParlayLeg[];
}

/**
 * 流水状态（账本级别，对齐后端 HistoryLedgerStatus 枚举）
 * 1 Processing 进行中 / 2 Reviewing 审核中 / 3 Completed 成功
 * 4 Failed 失败 / 5 Appealing 申诉中 / 6 Canceled 已取消
 */
export const LEDGER_STATUS = {
  IN_PROGRESS: 1,
  REVIEWING: 2,
  COMPLETED: 3,
  FAILED: 4,
  APPEALING: 5,
  CANCELED: 6,
} as const;
export type LedgerStatus = (typeof LEDGER_STATUS)[keyof typeof LEDGER_STATUS];

export interface LedgerRecord {
  business_type: BusinessType;
  amount: string;
  balance_before?: string;
  balance_after?: string;
  ref_id?: string;
  /** 流水状态（数值枚举见 LEDGER_STATUS）；老接口/老数据可能缺省 */
  status?: number;
  /** 后端综合判定的可领标记（settled 注单专用）；缺省时前端按 settlementStatus 派生兜底 */
  enable_claim?: boolean;
  /**
   * DD-105 Batch 7 — 链上下注合约 betId（BettingPool onchain_bet_id 0x hex）。
   * 仅 `business_type === "onchain_single"` 行有值；链下行 / 链上行事件索引未回填前为 undefined。
   * 后端字段位置(顶层 `bet_id *string`)实测自 oddfi-backend@dev fdf73a2
   * (web-api/internal/model/response.go:86 + service/auth_onchain_history.go convertChainOrdersToLedgers)。
   * Claim 入口 `lib/betting/onchain-claim.ts::getOnchainBetId(record)` 读这里。
   */
  bet_id?: string;
  event_info: LedgerEventInfo | null;
  created_at: string;
}

export interface PortfolioHistoryParams {
  tab?: "active" | "settled";
  // DD-082 — type 支持单值或逗号分隔多值（如 "stake,unstake"），后端按逗号分割构造 SQL IN
  type?: string;
  search?: string;
  begin_date?: string;
  end_date?: string;
  order_by?: "created_at" | "amount" | "payout";
  sort?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface PortfolioHistoryRes {
  total: number;
  asset_ledgers: LedgerRecord[];
}
