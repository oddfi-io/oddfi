// LiquidityPool ABI subset — DD-090 §3.3
// Only the functions and events consumed by the frontend are included.
export const LIQUIDITY_POOL_ABI = [
  // ── Public Read ─────────────────────────────────────────────
  {
    type: "function",
    name: "totalActiveDeposited",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "minDeposit",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "requestableLiquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextLpPositionId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    // Source: oddfi-ODD/src/modules/liquidity/LiquidityPool.sol struct Pool (10 fields)
    type: "function",
    name: "pools",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "poolType", type: "uint8" }, // 0=Global, 1=Match
          { name: "matchId", type: "bytes32" },
          { name: "exists", type: "bool" },
          { name: "depositOpen", type: "bool" },
          { name: "depositCloseAt", type: "uint64" },
          { name: "unlockAt", type: "uint64" },
          { name: "totalDeposited", type: "uint256" },
          { name: "totalWeight", type: "uint256" },
          { name: "rewardPerWeight", type: "uint256" },
          { name: "lossPerPrincipal", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "depositMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  // ── User Position Read ────────────────────────────────────────
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      {
        // Source: oddfi-ODD/src/modules/liquidity/LiquidityPool.sol struct LpPosition
        // Verified by raw decoding tx 0xf8092dcc... receipt — 12 words returned
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "poolId", type: "uint256" },
          { name: "principal", type: "uint256" },
          { name: "weight", type: "uint256" },
          { name: "unlockAt", type: "uint64" },
          { name: "rewardDebt", type: "uint256" },
          { name: "lossDebt", type: "uint256" },
          { name: "unbondingEpoch", type: "uint32" },
          { name: "frozenRewardPerWeight", type: "uint256" },
          { name: "frozenLossPerPrincipal", type: "uint256" },
          { name: "planId", type: "uint16" },
          { name: "state", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getPositionState",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "state", type: "uint8" }],
  },
  // ── User Write ───────────────────────────────────────────────
  {
    type: "function",
    name: "depositGlobal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "planId", type: "uint16" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "requestUnbond",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  // ── Events ───────────────────────────────────────────────────
  {
    // Source: oddfi-ODD/src/modules/liquidity/LiquidityPool.sol
    // 2 indexed: topic[1]=matchId, topic[2]=poolId
    type: "event",
    name: "MatchPoolOpened",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "poolId", type: "uint256", indexed: true },
      { name: "matchEndTime", type: "uint64", indexed: false },
      { name: "depositCloseAt", type: "uint64", indexed: false },
    ],
  },
  {
    // Source: oddfi-ODD/src/modules/liquidity/LiquidityPool.sol
    // 3 indexed: topic[1]=positionId, topic[2]=poolId, topic[3]=user
    type: "event",
    name: "LiquidityDeposited",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "poolId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "weight", type: "uint256", indexed: false },
      { name: "planId", type: "uint16", indexed: false },
      { name: "unlockAt", type: "uint64", indexed: false },
    ],
  },
  {
    // Source: oddfi-ODD/src/modules/liquidity/LiquidityPool.sol
    type: "event",
    name: "UnbondRequested",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "unbondingEpoch", type: "uint32", indexed: false },
      { name: "frozenRewardPerWeight", type: "uint256", indexed: false },
      { name: "frozenLossPerPrincipal", type: "uint256", indexed: false },
    ],
  },
  {
    // Source: oddfi-ODD/src/modules/liquidity/LiquidityPool.sol
    type: "event",
    name: "LiquidityWithdrawn",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "withdrawAmount", type: "uint256", indexed: false },
      { name: "finalState", type: "uint8", indexed: false },
      { name: "netPnl", type: "int256", indexed: false },
    ],
  },
] as const;

// PoolType enum — matches Solidity enum
export const POOL_TYPE = {
  Global: 0,
  Match: 1,
} as const;

// LpPositionState enum values — matches oddfi-ODD/src/modules/liquidity/LiquidityPool.sol
// 合约 getPositionState 返回的是 effective state（根据 storage state + unlockAt + epoch 动态算）
export const LP_POSITION_STATE = {
  Active: 0, // 已 deposit，未到 unlockAt
  Unbonding: 1, // 已调 requestUnbond，等待 epoch
  Ready: 2, // 已到 unlockAt，可调 requestUnbond（动态状态）
  Withdrawn: 3, // 已提取
  Liquidated: 4, // 损失 ≥ 本金，可提 0
  Withdrawable: 5, // Unbonding + epoch 满足，可调 withdraw
} as const;

export type LpPositionState = (typeof LP_POSITION_STATE)[keyof typeof LP_POSITION_STATE];

// Earliest block to scan for LiquidityDeposited events.
// Fill in actual deploy block after contract deployment.
export const LP_DEPLOY_BLOCK: bigint = 0n;
