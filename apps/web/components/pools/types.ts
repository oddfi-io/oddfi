export interface PoolVault {
  token: string;
  totalSupply: string;
  apy: string;
  myBalance: string;
}

export type SportCategory =
  | "all"
  | "football"
  | "basketball"
  | "tennis"
  | "cricket"
  | "others"
  | "ufc"
  | "more";

export interface PoolMarket {
  id: number;
  match: string;
  matchDate: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  sport: SportCategory;
  hot: boolean;
  totalSupply: string;
  volume24h: string;
  estApy: string;
  myBalance: string;
  favorite: boolean;
}

export type LockPeriod = 30 | 60 | 90;

// Position UI 状态 — 一一对应合约 6 个 LpPositionState（lib/abi/liquidityPool.ts）
// Figma node 3559:170823 (Active) / 3559:170826 (Ready) 之外的 4 个状态沿用同款 PoolTag 系统不同配色
//   active        锁定中，未到 unlockAt           → 操作列：Locked
//   ready         到期可调 requestUnbond          → 操作列：Redeem 按钮
//   unbonding     已 requestUnbond，等 epoch 满足 → 操作列：Pending
//   withdrawable  Unbonding 完成，可调 withdraw   → 操作列：Withdraw 按钮
//   withdrawn     已提取完成                      → 操作列：—
//   liquidated    亏损吃光本金（提款 0）          → 操作列：—
export type PositionStatus =
  | "active"
  | "ready"
  | "unbonding"
  | "withdrawable"
  | "withdrawn"
  | "liquidated";

export interface Position {
  id: number;
  match: string;
  matchDate: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  hot?: boolean;
  deposited: string;
  currentValue: string;
  pnl: number;
  unlockAmount: string;
  daysLeft: number;
  status: PositionStatus;
}

export type ReturnResult = "house_won" | "house_lost";

export interface ReturnRecord {
  id: number;
  match: string;
  matchDate: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  date: string;
  result: ReturnResult;
  marginEarned: string;
  lossAbsorbed: string;
  netPnl: string;
  netPnlPositive: boolean;
}
