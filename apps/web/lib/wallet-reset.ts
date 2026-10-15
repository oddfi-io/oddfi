import type { Config } from "wagmi";

/**
 * 强制清 wagmi store 的 connection state，绕过 connector.disconnect() 方法依赖。
 *
 * 适用场景（BUG-008 后续 wagmi v2 边界 bug 兜底）:
 * 用户在钱包连接中途取消（如取消账户连接 / 签名），wagmi 短暂让 state.current 指向
 * partial connector instance（缺 disconnect/getChainId 等方法）。此时:
 * - `disconnectAsync()` 会抛 `TypeError: connector.disconnect is not a function`
 * - wagmi store 没被清干净 → useAccount.status 卡在 'connected' → 后续 connect 流程脏 state 累积
 *
 * 本工具用 wagmi v2 Config 内部 zustand store 的标准 setState API 直接清状态，
 * 不依赖 connector method 的存在性。
 *
 * Caveat: wagmi Config 类型未在 TypeScript public types 中暴露 setState，
 * 但底层是 zustand store（standard public API）。版本升级时需重新验证。
 */
export function forceWagmiReset(config: Config): void {
  try {
    const setState = (config as unknown as { setState?: (fn: (s: unknown) => unknown) => void })
      .setState;
    if (typeof setState !== "function") {
      console.warn("[wallet-reset] config.setState unavailable — wagmi internal API changed?");
      return;
    }
    setState((state: unknown) => ({
      ...(state as object),
      current: null,
      connections: new Map(),
      status: "disconnected",
    }));
  } catch (err) {
    console.warn("[wallet-reset] forceWagmiReset failed", err);
  }
}
