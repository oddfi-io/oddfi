/**
 * Relay SDK 全局单例初始化
 *
 * 使用 dynamic import，仅在跨链路径触发时加载 SDK，BSC 用户不受任何性能影响。
 *
 * 双模式 baseApiUrl：
 *   NEXT_PUBLIC_RELAY_BASE_URL 已配置 → 走 /api/relay 服务端代理（隐藏未来可能的 API Key）
 *   未配置                            → 直连 MAINNET_RELAY_API（公共端点，无需 API Key）
 */

// Promise 缓存模式：并发调用时只初始化一次，避免 boolean 标志位的竞态问题
let initPromise: Promise<void> | null = null;

export async function getRelayClient() {
  if (!initPromise) {
    initPromise = (async () => {
      const { createClient, MAINNET_RELAY_API, convertViemChainToRelayChain } =
        await import("@relayprotocol/relay-sdk");
      const { bsc, mainnet, polygon, arbitrum, base } = await import("wagmi/chains");

      createClient({
        baseApiUrl: process.env.NEXT_PUBLIC_RELAY_BASE_URL ?? MAINNET_RELAY_API,
        source: "oddfi.io",
        chains: [bsc, mainnet, polygon, arbitrum, base].map(convertViemChainToRelayChain),
      });
    })().catch((err) => {
      // 初始化失败时清除缓存，允许下次调用重试（避免 rejected Promise 永久缓存）
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
  const { getClient } = await import("@relayprotocol/relay-sdk");
  return getClient();
}
