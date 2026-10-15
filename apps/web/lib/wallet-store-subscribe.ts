import type { Config } from "wagmi";

/**
 * 等 wagmi `config.subscribe(selector, listener)` 的 selector 值首次满足 `predicate`，
 * 或在 `timeoutMs` 内一直不满足。
 *
 * 设计要点：
 * - 立即检查一次当前值（避免错过已满足的情况），不订阅 / 不挂定时器
 * - 订阅后命中即清理 timeout + unsubscribe，避免 listener 泄漏
 * - 超时同样清理订阅，resolve(false) 让调用方自行决定是 reject 还是降级
 *
 * 适用场景：
 * - `lib/wallet-recovery.ts` 等 `state.current` 恢复（connector reconnect）
 * - `lib/wallet-chain.ts` 等 `connections[current].chainId` 切换到目标值
 *
 * @returns Promise<boolean> — true: 已满足；false: 超时
 */
export function subscribeUntil<T>(
  config: Config,
  selector: (state: Config["state"]) => T,
  predicate: (value: T) => boolean,
  timeoutMs: number
): Promise<boolean> {
  if (predicate(selector(config.state))) return Promise.resolve(true);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(false);
    }, timeoutMs);

    const unsub = config.subscribe(selector, (value) => {
      if (predicate(value)) {
        clearTimeout(timer);
        unsub();
        resolve(true);
      }
    });
  });
}
