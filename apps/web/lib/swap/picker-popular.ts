import { getTokenByChainAndSymbol, type TokenMeta } from "@/lib/token-registry";

/**
 * Swap TokenPicker — Popular 分组固定展示的代币配置（DD-078 §3.2.1）。
 * 顺序即展示顺序，后续运营可在此文件增删调序。
 * 目标：未登录 / 零资产场景下兜底引导用户选择。
 */
export const POPULAR_TOKEN_IDS: ReadonlyArray<{ chainId: number; symbol: string }> = [
  { chainId: 56, symbol: "BNB" },
  { chainId: 56, symbol: "USDT" },
  { chainId: 56, symbol: "USDC" },
];

/**
 * 按 POPULAR_TOKEN_IDS 顺序解析 TokenMeta。
 * registry 漂移（某 symbol 被移除）时跳过并 console.warn，避免阻塞 UI 渲染。
 */
export function resolvePopularTokens(): TokenMeta[] {
  const result: TokenMeta[] = [];
  for (const { chainId, symbol } of POPULAR_TOKEN_IDS) {
    const meta = getTokenByChainAndSymbol(chainId, symbol);
    if (!meta) {
      console.warn(`[picker-popular] Missing token ${chainId}:${symbol} — skipped`);
      continue;
    }
    result.push(meta);
  }
  return result;
}
