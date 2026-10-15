import type { Config } from "wagmi";
import type { Connector } from "wagmi";
import { CORE_CHAIN } from "@/lib/chains";
import { IS_TESTNET } from "@/lib/network-mode";
import { subscribeUntil } from "@/lib/wallet-store-subscribe";

const ENSURE_CHAIN_TIMEOUT_MS = 5_000;

function getStoredChainId(config: Config): number | undefined {
  const current = config.state.current;
  if (!current) return undefined;
  return config.state.connections.get(current)?.chainId;
}

/** 等待 wagmi store.connection.chainId === targetId（事件驱动，非 polling）。 */
async function waitForStoreChainSync(
  config: Config,
  targetId: number,
  timeoutMs: number
): Promise<void> {
  const ok = await subscribeUntil(
    config,
    (s) => {
      const cur = s.current;
      return cur ? s.connections.get(cur)?.chainId : undefined;
    },
    (chainId) => chainId === targetId,
    timeoutMs
  );
  if (!ok) throw new Error("store-chain-sync-timeout");
}

/**
 * 强制让 wagmi store 与钱包 live 都 = CORE_CHAIN.id 才返回。
 *
 * 设计契约（修复 BUG-008）：
 * - 已在目标链（store + live 双 = 97）→ no-op 立即返回
 * - 否则 switchChainAsync → 等 store 收敛 → 等 live 收敛
 * - 任一超时 → 抛 friendly Error（message 形如 "Wallet did not switch to ... in time" 等，便于 wallet-error 兜底）
 *
 * config 通过参数注入（DI），让本模块脱离对具体 wagmiConfig 实例的顶层耦合，
 * 测试可注入 fake config，间接 import 链不触达 wagmi.config 顶层 createConfig。
 */
export async function ensureCoreChain(
  conn: Connector,
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  config: Config
): Promise<void> {
  const target = CORE_CHAIN.id;
  const targetName = IS_TESTNET ? "BSC Testnet" : "BSC Mainnet";

  const liveBefore = await conn.getChainId();
  const storedBefore = getStoredChainId(config);
  if (liveBefore === target && storedBefore === target) return;

  try {
    await switchChainAsync({ chainId: target });
  } catch (err) {
    const isUserReject = err instanceof Error && /reject|denied/i.test(err.message);
    throw new Error(
      isUserReject
        ? `Please switch your wallet to ${targetName} and try again`
        : `Failed to switch to ${targetName} — please switch manually in your wallet`
    );
  }

  try {
    await waitForStoreChainSync(config, target, ENSURE_CHAIN_TIMEOUT_MS);
  } catch {
    throw new Error(`Wallet did not switch to ${targetName} in time — please retry`);
  }

  // 钱包 RPC 没有 "切完" 事件可订阅，只能紧凑 polling（100ms × 5s 上限）。
  const deadline = Date.now() + ENSURE_CHAIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const live = await conn.getChainId();
    if (live === target) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Wallet RPC did not reflect ${targetName} switch — please retry`);
}
