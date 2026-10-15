import type { Config } from "wagmi";
import { subscribeUntil } from "./wallet-store-subscribe";

/**
 * 等 wagmi `config.state.current` 收敛到非空（即 connector connection 恢复）。
 *
 * BUG-013 场景：多扩展环境下 metaMaskSDK 拿到污染 provider 后 emit disconnect →
 * wagmi 把 `state.current` 清成 null → 后续 `signMessageAsync` 抛
 * `ConnectorNotConnectedError`。`trySign` 兜底路径调用本函数主动等收敛而非固定 sleep，
 * 避免赌运气（critic M-1）：state 自愈依赖钱包再次 emit `connect`，与 React commit 无关。
 *
 * 契约：
 * - `state.current` 已非空 → 立即 resolve(true)
 * - 在 `timeoutMs` 内变为非空 → resolve(true)
 * - 超时仍为空 → resolve(false)（调用方应原 error 透传，不掩盖根因）
 *
 * 与 `lib/wallet-chain.ts#waitForStoreChainSync` 正交：前者等 connection 恢复，
 * 后者等 chainId 切换收敛。两者共用底层原语 `subscribeUntil`。
 */
export function waitForConnectorRecovery(config: Config, timeoutMs: number): Promise<boolean> {
  return subscribeUntil(
    config,
    (s) => s.current,
    (current) => Boolean(current),
    timeoutMs
  );
}
