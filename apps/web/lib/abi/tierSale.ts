/**
 * DD-146 TierSale 最小只读 ABI。
 *
 * 仅含 sale-state 直读所需的 public view（已对 mainnet 0x6FF5... 实链验证，见
 * .progress/stash/SCRIPT-001-tiersale-mainnet-probe.mjs，并与 oddfi-ODD/src/modules/token/TierSale.sol 源码核对）。
 * 前端 V1 不直接调写方法（approve/buy 走后端 relay）；此 ABI 只用于 readContract。
 */
export const TIER_SALE_ABI = [
  {
    name: "totalSold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getCurrentTier",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getRemainingByTier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tier", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "soldOut",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "saleClosed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;
