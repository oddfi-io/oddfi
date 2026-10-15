/**
 * DD-130 链上质押（Stake）数据契约
 *
 * 后端：oddfi web-api，文档《2026-05-29 add-liquidity-and-stake-frontend.md》
 * 路由：POST /account/onchain/{stake,unstake,early_unstake}（带 token）
 *       GET  /account/onchain/stake/history（带 token）
 *
 * 金额字段均为 ODD wei 字符串（1e18 精度）；amount_odd 为去尾零十进制串（展示用）。
 * 写接口统一返回 OnchainTxRes（复用 types/onchain-betting.ts）。
 */

import type { OnchainTxRes } from "./onchain-betting";

export type { OnchainTxRes };

/** 质押 — lock_hours 由后端反查 plan_id；测试网可选 8/16/24/32/40/48 */
export interface OnchainStakeReq {
  amount_wei: string;
  lock_hours: number;
  /** DD-141 — 随机幂等 nonce（UUID v4，max 64）；一次点击一个、retry 复用、新点击重生成。 */
  nonce: string;
}

/** 解押 / 提前解押 — 入参一致，仅 endpoint 不同。DD-141：后端按请求内容派生幂等键，前端不传字段。 */
export interface OnchainUnstakeReq {
  position_id: string;
}

/** 质押仓位状态。后端只产出这两个值（service/stake.go）；
 *  「可解押 / 可提前解押」由前端用 now vs end_time 本地推导，后端不给中间态。 */
export type StakeStatus = "active" | "withdrawn";

/**
 * GET /account/onchain/stake/history 的列表项（持仓 + 历史合一，含终态）。
 *
 * ⚠️ 后端 omitempty：active 仓位 `reward_wei` / `withdrawn_time` 字段**不存在**于响应
 * （不是空串/0），故标记为可选。提前解押（withdrawn_early=true）也不带 reward_wei。
 */
export interface StakeHistoryItem {
  position_id: string;
  plan_id: number;
  lock_hours: number;
  amount_wei: string;
  /** 去尾零十进制 ODD 串（如 "100"），展示直接用 */
  amount_odd: string;
  /** 质押时间（unix 秒） */
  start_time: number;
  /** 解锁时间 unlockAt（unix 秒）；到期判断按此 */
  end_time: number;
  status: StakeStatus;
  /** status=withdrawn 时有意义 */
  withdrawn_early: boolean;
  /** 正常解押收益 wei；active / 提前解押时缺省 */
  reward_wei?: string;
  /** 该 active 仓位当前待领收益 wei（REQ-005）；仅 status=active 有，后端读链失败时缺省（omitempty） */
  pending_reward_wei?: string;
  /** 提取时间 unix 秒；active 时缺省 */
  withdrawn_time?: number;
  tx_hash: string;
}

export interface StakeHistoryRes {
  list: StakeHistoryItem[];
}

/** stake/stats 档位项（REQ-005）：multiplier_bps 10000=1x，镜像合约权重常量 */
export interface StakeStatPlan {
  plan_id: number;
  lock_hours: number;
  multiplier_bps: number;
}

/**
 * GET /account/onchain/stake/stats（带 JWT，全局口径）REQ-005。
 * total_staked = 链上 accountedOddBalance；min_stake = 链上 minStakeAmount。
 * ⚠️ reward_pool 语义 + 每档 apy 口径待 PM 确认，本期前端暂不接 reward_pool 展示 / 仍本地估算 APY。
 */
export interface StakeStatsRes {
  total_staked_wei: string;
  total_staked_odd: string;
  reward_pool_wei: string;
  reward_pool_odd: string;
  min_stake_wei: string;
  min_stake_odd: string;
  plans: StakeStatPlan[];
}
