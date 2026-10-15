/**
 * DD-130 链上加流动性（Add Liquidity / Pool）数据契约
 *
 * 后端：oddfi web-api，文档《2026-05-29 add-liquidity-and-stake-frontend.md》
 * 路由：
 *   公开（免鉴权）GET /liquidity/match/pools、GET /liquidity/global/plans
 *   带 token      POST /account/onchain/{deposit_global,deposit_match,request_unbond,withdraw}
 *                 GET  /account/onchain/liquidity/{positions,withdrawable}
 *
 * 金额字段为 ODD wei 字符串（1e18）；*_odd 为去尾零十进制串（展示用）。
 * 写接口统一返回 OnchainTxRes（复用 types/onchain-betting.ts）。
 */

import type { OnchainTxRes } from "./onchain-betting";

export type { OnchainTxRes };

// ── 写请求 ────────────────────────────────────────────────────
/** 全局池加流动性 — plan_id 取自 GET /liquidity/global/plans */
export interface OnchainDepositGlobalReq {
  amount_wei: string;
  plan_id: number;
  /** DD-141 — 随机幂等 nonce（UUID v4，max 64）；一次点击一个、retry 复用、新点击重生成。 */
  nonce: string;
}

/** 比赛池加流动性 — match_id 只能取自 GET /liquidity/match/pools（后端不校验 match_id 有效性） */
export interface OnchainDepositMatchReq {
  match_id: string;
  amount_wei: string;
  /** DD-141 — 随机幂等 nonce（UUID v4，max 64）；一次点击一个、retry 复用、新点击重生成。 */
  nonce: string;
}

/** 申请赎回（第一步）/ 提取（第二步）— 入参一致，仅 endpoint 不同。DD-141：后端派生幂等键，前端不传字段。 */
export interface OnchainLpPositionReq {
  position_id: string;
}

// ── 公开读：比赛池列表 ────────────────────────────────────────
/**
 * 一条可加流动性的比赛池。fixture_name / 队徽 / 时间字段在 spider 未同步时缺省，
 * 缺失时只展示 match_id（后端 omitempty）。
 */
export interface LiquidityMatchPool {
  pool_id: string;
  match_id: string;
  fixture_id: number;
  fixture_name?: string;
  home_team_logo?: string;
  away_team_logo?: string;
  match_start_time?: number;
  match_end_time?: number;
  deposit_close_at?: number;
  min_deposit_wei: string;
  min_deposit_odd: string;
  /** 该比赛池当前活跃本金合计（wei，1e18）= 链上 LiquidityPool.pools(matchId).totalDeposited，后端读权威地址聚合（REQ-004）。无数据返回 "0" */
  total_deposited_wei: string;
  /** 同上，ODD 去尾零展示串 */
  total_deposited_odd: string;
  /** 该比赛全部盘口各方向有效 stake 之和，按 match_id 聚合（wei，1e18）（REQ-004）。无数据返回 "0" */
  total_bet_wei: string;
  /** 同上，ODD 去尾零展示串 */
  total_bet_odd: string;
}

export interface LiquidityMatchPoolsRes {
  list: LiquidityMatchPool[];
}

// ── 公开读：全局池 plan ───────────────────────────────────────
/** 全局池档位 — 完全后端驱动渲染（数量/lock_hours 不可前端硬编码） */
export interface LiquidityGlobalPlan {
  plan_id: number;
  lock_hours: number;
  label: string;
}

export interface LiquidityGlobalPlansRes {
  min_deposit_wei: string;
  min_deposit_odd: string;
  list: LiquidityGlobalPlan[];
}

// ── 带 token 读：我的持仓 ─────────────────────────────────────
export type LpPoolType = "global" | "match";

/**
 * LP 仓位 6 态（后端 model/liquidity.go 常量逐字命名）：
 *   locked       锁仓中（now < unlock_at）        → 倒计时，无按钮
 *   redeemable   已解锁可申请赎回                  → 「申请赎回」request_unbond
 *   unbonding    赎回冷却中（now < withdrawable_at）→ 倒计时，无按钮
 *   withdrawable 可提取                            → 「提取」withdraw
 *   withdrawn    已提取完成                        → 终态
 *   liquidated   已清算（本金被亏损覆盖）          → 终态
 */
export type LpPositionStatus =
  | "locked"
  | "redeemable"
  | "unbonding"
  | "withdrawable"
  | "withdrawn"
  | "liquidated";

/**
 * GET /account/onchain/liquidity/positions 列表项（持仓 + 历史合一，含终态）。
 *
 * ⚠️ `net_pnl_wei` 未提取时为**空串 ""**（不是 "0"，也不是缺省）→ 展示前判空，禁止 parseUnits("")。
 * 各时间字段为 unix 秒，0 表示该阶段未发生 / 不适用。
 * `withdrawable_at` 是后端 epoch 推算值（仅供倒计时展示，真实可提取以 withdrawable 接口为准）。
 */
export interface LiquidityPositionItem {
  position_id: string;
  pool_type: LpPoolType;
  /** pool_type=match 时有 */
  match_id?: string;
  // ── 赛事展示四件套 + fixture_id（fix/liquidity-positions-matchinfo）────
  // 全部 omitempty：仅 pool_type=match 且 spider 已同步该比赛时有值。
  // ⚠️ 区分池子类型必须读 pool_type，禁止用 fixture_name 是否为空推断。
  fixture_id?: number;
  fixture_name?: string;
  home_team_logo?: string;
  away_team_logo?: string;
  /** 开赛时间（unix 秒） */
  match_start_time?: number;
  /** pool_type=global 时有意义 */
  plan_id: number;
  amount_wei: string;
  amount_odd: string;
  status: LpPositionStatus;
  start_time: number;
  unlock_at: number;
  unbond_at: number;
  withdrawable_at: number;
  withdrawn_at: number;
  /** 已提取才有，可负；未提取为空串 "" */
  net_pnl_wei: string;
  tx_hash: string;
}

export interface LiquidityPositionsRes {
  list: LiquidityPositionItem[];
}

// ── 带 token 读：现在真实可提取总额 ───────────────────────────
export interface LiquidityWithdrawableRes {
  withdrawable_wei: string;
  withdrawable_odd: string;
  position_count: number;
}
