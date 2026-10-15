import { isCoreChain } from "@/lib/chains";

export type SwapRoute = "pancake" | "relay" | "disabled";

/**
 * 选择资产动作路由：
 * - BSC / BSC Testnet (Core) → Pancake
 * - 其他 EVM → Relay（入金式跨链，to 强制为 BSC 平台币）
 */
export function selectSwapRoute(fromChainId: number): SwapRoute {
  return isCoreChain(fromChainId) ? "pancake" : "relay";
}
