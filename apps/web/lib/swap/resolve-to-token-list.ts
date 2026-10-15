import { PLATFORM_TOKEN, PLATFORM_TOKEN_SYMBOL } from "@/lib/platform-token";
import { BSC_TOKENS, BSC_TESTNET_TOKENS, TOKEN_BY_SYMBOL } from "@/lib/token-registry";
import { IS_TESTNET } from "@/lib/network-mode";
import { selectSwapRoute } from "./route-selector";
import type { TokenMeta } from "@/lib/token-registry";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

/**
 * 根据 fromToken 的链路由确定 toToken 可选列表：
 * - Relay 路径（非 BSC）→ 只能换到平台币（TODD），锁定单选
 * - Pancake 路径（BSC / BSC Testnet）→ 可选代币池，排除 fromToken 自身
 */
export function resolveToTokenList(fromToken: TokenMeta): TokenMeta[] {
  const route = selectSwapRoute(fromToken.chainId);
  if (route === "relay") {
    return [PLATFORM_TOKEN];
  }
  // Pancake: testnet 使用 BSC_TESTNET_TOKENS（剔除 ZERO_ADDR 占位），mainnet 使用 BSC_TOKENS
  const pool = IS_TESTNET ? BSC_TESTNET_TOKENS.filter((t) => t.address !== ZERO_ADDR) : BSC_TOKENS;
  return pool.filter((t) => t.address !== fromToken.address);
}

/**
 * 根据 fromToken 确定默认 toToken（DD-075 §3.5）：
 * - Pancake + fromToken === TODD（反向）→ 默认 USDT
 * - 其他 → PLATFORM_TOKEN（Pancake 非 TODD：TODD 本身；Relay：锁定 PLATFORM_TOKEN）
 */
export function resolveDefaultToToken(fromToken: TokenMeta): TokenMeta {
  const route = selectSwapRoute(fromToken.chainId);
  if (route === "pancake" && fromToken.symbol === PLATFORM_TOKEN_SYMBOL) {
    return TOKEN_BY_SYMBOL.USDT ?? resolveToTokenList(fromToken)[0];
  }
  return PLATFORM_TOKEN;
}
